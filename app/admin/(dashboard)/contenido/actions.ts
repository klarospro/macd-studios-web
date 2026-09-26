'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/admin/dal'
import { callAnthropic } from '@/lib/admin/anthropic'
import { MACD_BUSINESS_CONTEXT } from '@/lib/admin/business-context'
import { MACD_GROWTH_CONTEXT } from '@/lib/admin/growth-context'
import { supabase as serviceDb } from '@/lib/supabase'
import { publishItem } from '@/lib/social/publish'
import type { AgentState } from '../agents/actions'
import type { ContentItem, ContentStatus, Slide, Story } from '@/lib/social/types'

const PILLARS = ['dato-curioso', 'tutorial', 'dolor', 'demo-max', 'caso-real', 'autoridad', 'oferta-auditoria', 'detras-de-camaras']
const CATEGORIES = ['problema', 'solucion', 'trabajar-conmigo', 'personal']

type PlannedItem = {
  format: 'reel' | 'carrusel'
  category: string
  pillar: string
  title: string
  hook: string
  script?: string
  visual_prompt?: string
  slides?: Slide[]
  caption: string
  cta: string
  cta_keyword?: string
  hashtags: string
  stories?: Story[]
}

// Agente estratega + guionista: 7 piezas, una por día, desde mañana.
export async function generateWeekPlan(_prev: AgentState, fd: FormData): Promise<AgentState> {
  const { supabase } = await requireSession()
  const focus = String(fd.get('focus') || '').trim()

  const [{ data: analysis }, { data: top }, { data: last }, { data: refs }] = await Promise.all([
    supabase.from('social_analyses').select('summary').order('created_at', { ascending: false }).limit(1),
    supabase.from('social_posts').select('platform, caption, views, likes, shares, saves').order('views', { ascending: false, nullsFirst: false }).limit(5),
    supabase.from('content_items').select('scheduled_for').not('scheduled_for', 'is', null).order('scheduled_for', { ascending: false }).limit(1),
    supabase.from('social_references').select('username, analysis').not('analysis', 'is', null).order('scanned_at', { ascending: false }).limit(3),
  ])

  const context = [
    analysis?.[0]?.summary ? `ÚLTIMO ANÁLISIS DEL PERFIL:\n${analysis[0].summary}` : 'Todavía no hay análisis del perfil.',
    top?.length
      ? `MEJORES PUBLICACIONES REALES:\n${top.map((p) => `- ${p.platform}: ${p.views ?? '?'} vistas · "${(p.caption ?? '').slice(0, 120)}"`).join('\n')}`
      : '',
    refs?.length
      ? `PATRONES DE CUENTAS DE REFERENCIA (replica estructuras, nunca textos):\n${refs
          .map((r) => `@${r.username}:\n${(r.analysis ?? '').slice(0, 1500)}`)
          .join('\n\n')}`
      : '',
    focus ? `FOCO QUE PIDE MOISÉS ESTA SEMANA: ${focus}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  let raw: string
  try {
    raw = await callAnthropic(
      [
        {
          role: 'system',
          content: `${MACD_BUSINESS_CONTEXT}

${MACD_GROWTH_CONTEXT}

Eres el estratega y guionista de contenido de MACD Studios. Moisés publica 1 pieza al día (Instagram + TikTok) y 3-5 stories diarias.
No menciones precios.

REPARTO (sostenible > perfecto): de las 7 piezas, 3-4 "problema" (el dolor exacto del dueño de inmobiliaria o negocio local), 2 "solucion" (cómo se resuelve, mostrando el sistema real), 1 "trabajar-conmigo" o "personal". Usa "category" = uno de: ${CATEGORIES.join(', ')}. "pillar" = uno de: ${PILLARS.join(', ')}. No repitas el mismo pilar dos días seguidos.

REEL = lo GRABA Moisés a cámara (móvil, material real). "script" en líneas con estas etiquetas, en este orden:
GANCHO: rompe el scroll en 1 frase (directa, incómoda, concreta).
PROBLEMA: la causa real con un ejemplo del día a día (nada de frases vacías).
SOLUCIÓN: el enfoque que cambia el resultado (no una lista de tips).
PRUEBA: SOLO algo real y verificable: Max funcionando en vivo, el propio sistema de MACD, proyectos reales (demo vista-inmobiliaria, Vida Nueva Reus). Si no hay prueba real para ese tema, escribe "PRUEBA: te lo enseño en vivo" — NUNCA inventes cifras ni clientes.
CTA: "Comenta <PALABRA> y te mando <entregable>" (entregable que sí podemos dar: auditoría gratis, enlace para probar a Max, el mapa/guía del carrusel).
[Grabación: plano, lugar y qué se ve en pantalla]
Duración 30-45 s, lenguaje simple, un solo concepto por guion.

CARRUSEL = se genera solo con la plantilla de marca (Moisés solo crea la portada en Gemini). "slides" = 6-8 objetos. Tipos:
- {"title": "..."} portada (índice 0) con "image_prompt": prompt EN INGLÉS para Gemini, ilustración 4:5 SIN TEXTO, estilo "dark cinematic 3D render, black background, gold accents, premium, minimal" que represente el tema (ej. "a glowing smartphone floating with golden chat bubbles and a small robot assistant, isometric 3D").
- {"kind":"mindmap","title":"...","center":"...","branches":[{"label":"...","items":["...","..."]}]} 4-6 ramas, máx 2-3 items cortos (≤3 palabras).
- {"kind":"steps","title":"...","steps":[{"label":"...","detail":"..."}]} 3-5 pasos.
- {"title":"...","body":"..."} texto (título ≤8 palabras, body ≤25).
Los carruseles de "tutorial" o "dato-curioso" deben incluir al menos un mindmap o steps. La última diapositiva repite el CTA con la palabra clave. Datos solo verificables.

"cta" = frase completa del CTA; "cta_keyword" = la PALABRA en mayúsculas (una sola, sin tildes).
"stories" = 3-5 historias para ese día que calientan y generan respuestas: [{"tipo":"hand-raiser|valor|detras|encuesta|cta","texto":"...","sticker":"encuesta/pregunta/cuenta atrás (opcional)"}]. Al menos 1 hand-raiser (pregunta que invita a responder por DM, ej. "¿Cuántos mensajes contestas tarde a la semana? Respóndeme con un número").
Reparto de formatos: 3 reels y 4 carruseles. Captions en español, cercanos, máx 600 caracteres, terminan con el CTA. hashtags: 5-8.
Responde SOLO con un array JSON de 7 objetos con las claves: format, category, pillar, title, hook, script (reel), slides (carrusel), caption, cta, cta_keyword, hashtags, stories. Sin texto antes ni después.`,
        },
        { role: 'user', content: context },
      ],
      'claude-sonnet-5',
      12000
    )
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error con la IA' }
  }

  let items: PlannedItem[]
  try {
    items = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1))
    if (!Array.isArray(items) || !items.length) throw new Error()
  } catch {
    return { error: 'La IA no devolvió un plan válido. Vuelve a intentarlo.' }
  }

  // Empieza el día siguiente a la última pieza ya programada (o mañana).
  const start = new Date()
  start.setUTCDate(start.getUTCDate() + 1)
  const lastDate = last?.[0]?.scheduled_for ? new Date(last[0].scheduled_for) : null
  if (lastDate && lastDate >= start) start.setTime(lastDate.getTime() + 86400_000)

  const rows = items.slice(0, 7).map((it, i) => {
    const d = new Date(start.getTime() + i * 86400_000)
    return {
      status: 'guion' as ContentStatus,
      format: it.format === 'carrusel' ? 'carrusel' : 'reel',
      platforms: it.format === 'carrusel' ? ['instagram'] : ['instagram', 'tiktok'],
      pillar: it.pillar,
      category: CATEGORIES.includes(it.category) ? it.category : null,
      cta_keyword: it.cta_keyword?.toUpperCase() ?? null,
      stories: it.stories ?? null,
      title: it.title,
      hook: it.hook,
      script: it.format === 'reel' ? it.script ?? null : null,
      visual_prompt: it.format === 'reel' ? it.visual_prompt ?? null : null,
      slides: it.format === 'carrusel' ? it.slides ?? null : null,
      caption: it.caption,
      cta: it.cta,
      hashtags: it.hashtags,
      scheduled_for: d.toISOString().slice(0, 10),
      created_by: 'agente-estratega',
    }
  })

  const { error } = await supabase.from('content_items').insert(rows)
  if (error) return { error: `No se pudo guardar el plan: ${error.message}` }
  revalidatePath('/admin/contenido')
  return { output: `Plan creado: ${rows.length} piezas del ${rows[0].scheduled_for} al ${rows[rows.length - 1].scheduled_for}. Revisa los guiones abajo.` }
}

const NEXT: Partial<Record<ContentStatus, ContentStatus>> = {
  idea: 'guion',
  guion: 'produccion',
  revision: 'aprobado',
  error: 'aprobado',
}

export async function advance(formData: FormData) {
  const { supabase } = await requireSession()
  const id = String(formData.get('id'))
  const { data } = await supabase.from('content_items').select('status').eq('id', id).single()
  const to = data && NEXT[data.status as ContentStatus]
  if (!to) return
  await supabase.from('content_items').update({ status: to, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/admin/contenido')
  revalidatePath('/admin/hoy')
}

export async function setStatus(formData: FormData) {
  const { supabase } = await requireSession()
  const id = String(formData.get('id'))
  const status = String(formData.get('status')) as ContentStatus
  if (!['guion', 'produccion', 'revision', 'descartado'].includes(status)) return
  await supabase.from('content_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/admin/contenido')
  revalidatePath('/admin/hoy')
}

export async function saveItem(formData: FormData) {
  const { supabase } = await requireSession()
  const id = String(formData.get('id'))
  const text = (k: string) => {
    const v = formData.get(k)
    return v == null ? undefined : String(v).trim() || null
  }
  const patch: Record<string, unknown> = {
    title: text('title') ?? undefined,
    hook: text('hook'),
    script: text('script'),
    caption: text('caption'),
    cta: text('cta'),
    hashtags: text('hashtags'),
    visual_prompt: text('visual_prompt'),
    scheduled_for: text('scheduled_for'),
    media_url: text('media_url'),
    updated_at: new Date().toISOString(),
  }
  const slides = text('slides')
  if (slides !== undefined) {
    if (slides && slides.startsWith('[')) {
      // Diapositivas avanzadas (mapa mental, pasos, portada con imagen) se editan como JSON.
      try {
        patch.slides = JSON.parse(slides)
      } catch {
        throw new Error('Las diapositivas no son un JSON válido: revisa comas y comillas.')
      }
    } else {
      patch.slides = slides
        ? slides.split('\n').filter(Boolean).map((l) => {
            const [title, ...rest] = l.split('|')
            return { title: title.trim(), body: rest.join('|').trim() || undefined }
          })
        : null
    }
  }
  const mediaUrls = text('media_urls')
  if (mediaUrls !== undefined) patch.media_urls = mediaUrls ? mediaUrls.split(/\s+/).filter(Boolean) : null
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k]

  // Si cambia la descripción del plano de fondo, el clip ya generado deja de valer.
  if ('visual_prompt' in patch) {
    const { data: prev } = await supabase.from('content_items').select('visual_prompt').eq('id', id).single()
    if (prev && prev.visual_prompt !== patch.visual_prompt) patch.broll_url = null
  }

  await supabase.from('content_items').update(patch).eq('id', id)
  revalidatePath('/admin/contenido')
  revalidatePath('/admin/hoy')
}

// URL firmada para que el navegador suba el video/imagen directo a Storage (Vercel no
// acepta cuerpos de más de 4,5 MB en funciones).
export async function createUploadUrl(itemId: string, fileName: string) {
  await requireSession()
  const ext = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { data, error } = await serviceDb.storage.from('content-media').createSignedUploadUrl(path)
  if (error) throw new Error(error.message)
  const { data: pub } = serviceDb.storage.from('content-media').getPublicUrl(path)
  return { path, token: data.token, publicUrl: pub.publicUrl }
}

export async function attachMedia(itemId: string, urls: string[]) {
  const { supabase } = await requireSession()
  const { data } = await supabase.from('content_items').select('format, status').eq('id', itemId).single()
  if (!data) return
  const patch =
    data.format === 'reel'
      ? { media_url: urls[0] }
      : { media_urls: urls }
  await supabase
    .from('content_items')
    .update({ ...patch, status: data.status === 'produccion' ? 'revision' : data.status, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  revalidatePath('/admin/contenido')
  revalidatePath('/admin/hoy')
}

export async function publishNow(formData: FormData) {
  const { supabase } = await requireSession()
  const id = String(formData.get('id'))
  const { data } = await supabase.from('content_items').select('*').eq('id', id).single()
  if (!data) return
  await publishItem(data as ContentItem)
  revalidatePath('/admin/contenido')
  revalidatePath('/admin/hoy')
}

// Portada del carrusel creada por Moisés en Gemini: se guarda en la diapositiva 0 y la pieza
// vuelve a Producción para que el renderer rehaga las imágenes con la portada.
export async function attachCover(itemId: string, url: string) {
  const { supabase } = await requireSession()
  const { data } = await supabase.from('content_items').select('slides, status').eq('id', itemId).single()
  if (!data?.slides?.length) return
  const slides = [...(data.slides as Slide[])]
  slides[0] = { ...slides[0], image: url }
  await supabase
    .from('content_items')
    .update({
      slides,
      media_urls: null,
      status: ['revision', 'aprobado', 'error'].includes(data.status) ? 'produccion' : data.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
  revalidatePath('/admin/hoy')
  revalidatePath('/admin/contenido')
  revalidatePath('/admin/hoy')
}

// Para cuando se publica a mano (redes aún sin conectar por API).
export async function markPublished(formData: FormData) {
  const { supabase } = await requireSession()
  await supabase
    .from('content_items')
    .update({ status: 'publicado', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', String(formData.get('id')))
  revalidatePath('/admin/hoy')
  revalidatePath('/admin/contenido')
  revalidatePath('/admin/hoy')
}
