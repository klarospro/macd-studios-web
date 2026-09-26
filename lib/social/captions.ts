import type { ContentItem } from './types'

// Texto final que se publica: caption + CTA + hashtags (sin repetir el CTA si ya está en el caption).
export function fullCaption(item: Pick<ContentItem, 'caption' | 'hashtags' | 'cta'>) {
  const cta = item.cta && item.caption?.includes(item.cta) ? null : item.cta
  return [item.caption, cta, item.hashtags].filter(Boolean).join('\n\n')
}
