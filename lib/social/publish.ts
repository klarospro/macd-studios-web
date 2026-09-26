import 'server-only'
import { supabase as serviceDb } from '@/lib/supabase'
import { getToken } from './tokens'
import { igPublishCarousel, igPublishReel } from './instagram'
import { ttPublishVideo } from './tiktok'
import type { ContentItem } from './types'
import { fullCaption } from './captions'


// Publica una pieza aprobada en sus plataformas. Si una plataforma falla, la otra sigue y el
// error queda en last_error; la pieza solo pasa a "publicado" si al menos una salió.
export async function publishItem(item: ContentItem) {
  if (item.status !== 'aprobado') throw new Error('Solo se publican piezas aprobadas.')
  const caption = fullCaption(item)
  const errors: string[] = []
  const patch: Partial<ContentItem> = {}

  if (item.platforms.includes('instagram') && !item.instagram_media_id) {
    try {
      if (!(await getToken('instagram'))) throw new Error('Instagram no está conectado')
      if (item.format === 'reel') {
        if (!item.media_url) throw new Error('falta el video')
        patch.instagram_media_id = await igPublishReel(item.media_url, caption)
      } else {
        patch.instagram_media_id = await igPublishCarousel(item.media_urls ?? [], caption)
      }
    } catch (e) {
      errors.push(`Instagram: ${e instanceof Error ? e.message : e}`)
    }
  }

  if (item.platforms.includes('tiktok') && !item.tiktok_publish_id) {
    try {
      if (!(await getToken('tiktok'))) throw new Error('TikTok no está conectado')
      if (item.format !== 'reel' || !item.media_url) throw new Error('por ahora solo se publican videos en TikTok')
      const r = await ttPublishVideo(item.media_url, caption)
      patch.tiktok_publish_id = r.publishId
      if (r.privacy === 'SELF_ONLY') errors.push('TikTok: subido en PRIVADO (app sin auditar) — hazlo público desde la app')
    } catch (e) {
      errors.push(`TikTok: ${e instanceof Error ? e.message : e}`)
    }
  }

  const anyOk = Boolean(patch.instagram_media_id || patch.tiktok_publish_id || item.instagram_media_id || item.tiktok_publish_id)
  await serviceDb
    .from('content_items')
    .update({
      ...patch,
      status: anyOk ? 'publicado' : 'error',
      published_at: anyOk ? new Date().toISOString() : null,
      last_error: errors.length ? errors.join(' · ') : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)

  return { ok: anyOk, errors }
}

// Lo llama el cron: todo lo aprobado con fecha de hoy o anterior.
export async function publishDue() {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await serviceDb
    .from('content_items')
    .select('*')
    .eq('status', 'aprobado')
    .lte('scheduled_for', today)
    .order('scheduled_for')
    .limit(3)
  if (error) throw new Error(error.message)
  const out = []
  for (const item of (data ?? []) as ContentItem[]) {
    out.push({ id: item.id, title: item.title, ...(await publishItem(item)) })
  }
  return out
}
