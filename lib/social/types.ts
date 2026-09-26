export type ContentStatus =
  | 'idea'
  | 'guion'
  | 'produccion'
  | 'revision'
  | 'aprobado'
  | 'publicado'
  | 'descartado'
  | 'error'

export type Slide = { title: string; body?: string }

export type ContentItem = {
  id: string
  created_at: string
  updated_at: string
  status: ContentStatus
  format: 'reel' | 'carrusel'
  platforms: ('instagram' | 'tiktok')[]
  pillar: string | null
  title: string
  hook: string | null
  script: string | null
  slides: Slide[] | null
  caption: string | null
  hashtags: string | null
  cta: string | null
  media_url: string | null
  media_urls: string[] | null
  scheduled_for: string | null
  published_at: string | null
  instagram_media_id: string | null
  tiktok_publish_id: string | null
  last_error: string | null
  notes: string | null
  created_by: string | null
}

export type SocialAccount = {
  id: string
  platform: 'instagram' | 'tiktok'
  external_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  followers: number | null
  following: number | null
  posts_count: number | null
  likes_total: number | null
  last_synced_at: string | null
  last_error: string | null
}

export type SocialPost = {
  id: string
  platform: 'instagram' | 'tiktok'
  external_id: string
  media_type: string | null
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  posted_at: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
}
