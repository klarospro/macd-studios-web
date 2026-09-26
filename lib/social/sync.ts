import 'server-only'
import { supabase as serviceDb } from '@/lib/supabase'
import { getToken, type Platform } from './tokens'
import { igAccountInsights, igMediaInsights, igProfile, igRecentMedia } from './instagram'
import { ttRecentVideos, ttUser } from './tiktok'

// Usa el service role porque también lo llama el cron diario (sin sesión de admin).

const today = () => new Date().toISOString().slice(0, 10)

async function markError(platform: Platform, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  await serviceDb.from('social_accounts').update({ last_error: msg }).eq('platform', platform)
  return msg
}

export async function syncInstagram() {
  const profile = await igProfile()
  await serviceDb.from('social_accounts').upsert(
    {
      platform: 'instagram',
      external_id: String(profile.user_id),
      username: profile.username,
      display_name: profile.name ?? null,
      avatar_url: profile.profile_picture_url ?? null,
      followers: profile.followers_count ?? null,
      following: profile.follows_count ?? null,
      posts_count: profile.media_count ?? null,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: 'platform' }
  )

  const media = await igRecentMedia(30)
  const rows = []
  for (const m of media) {
    const ins = await igMediaInsights(m.id)
    rows.push({
      platform: 'instagram',
      external_id: m.id,
      media_type: m.media_product_type === 'REELS' ? 'REEL' : m.media_type,
      caption: m.caption ?? null,
      permalink: m.permalink,
      thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
      posted_at: m.timestamp,
      views: ins.views ?? null,
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      shares: ins.shares ?? null,
      saves: ins.saved ?? null,
      synced_at: new Date().toISOString(),
    })
  }
  if (rows.length) await serviceDb.from('social_posts').upsert(rows, { onConflict: 'platform,external_id' })

  const acc = await igAccountInsights()
  await serviceDb.from('social_metrics_daily').upsert(
    {
      platform: 'instagram',
      date: today(),
      followers: profile.followers_count ?? null,
      reach: acc.reach ?? null,
      views: acc.views ?? null,
      profile_views: acc.profile_views ?? null,
      engagement: acc.accounts_engaged ?? null,
    },
    { onConflict: 'platform,date' }
  )
  return { posts: rows.length }
}

export async function syncTikTok() {
  const user = await ttUser()
  await serviceDb.from('social_accounts').upsert(
    {
      platform: 'tiktok',
      external_id: user.open_id,
      username: user.username ?? null,
      display_name: user.display_name ?? null,
      avatar_url: user.avatar_url ?? null,
      followers: user.follower_count ?? null,
      following: user.following_count ?? null,
      posts_count: user.video_count ?? null,
      likes_total: user.likes_count ?? null,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: 'platform' }
  )

  const videos = await ttRecentVideos(20)
  const rows = videos.map((v) => ({
    platform: 'tiktok',
    external_id: v.id,
    media_type: 'VIDEO',
    caption: v.video_description || v.title || null,
    permalink: v.share_url ?? null,
    thumbnail_url: v.cover_image_url ?? null,
    posted_at: new Date(v.create_time * 1000).toISOString(),
    views: v.view_count ?? null,
    likes: v.like_count ?? null,
    comments: v.comment_count ?? null,
    shares: v.share_count ?? null,
    duration_s: v.duration ?? null,
    synced_at: new Date().toISOString(),
  }))
  if (rows.length) await serviceDb.from('social_posts').upsert(rows, { onConflict: 'platform,external_id' })

  await serviceDb.from('social_metrics_daily').upsert(
    {
      platform: 'tiktok',
      date: today(),
      followers: user.follower_count ?? null,
      views: rows.reduce((s, r) => s + (r.views ?? 0), 0),
      engagement: user.likes_count ?? null,
    },
    { onConflict: 'platform,date' }
  )
  return { posts: rows.length }
}

// Sincroniza las plataformas conectadas; un fallo en una no frena la otra.
export async function syncAll() {
  const result: Record<string, string> = {}
  for (const [platform, fn] of [
    ['instagram', syncInstagram],
    ['tiktok', syncTikTok],
  ] as const) {
    if (!(await getToken(platform))) {
      result[platform] = 'no conectado'
      continue
    }
    try {
      const r = await fn()
      result[platform] = `ok (${r.posts} publicaciones)`
    } catch (e) {
      result[platform] = `error: ${await markError(platform, e)}`
    }
  }
  return result
}
