import { NextRequest, NextResponse } from 'next/server'
import { supabase as serviceDb } from '@/lib/supabase'
import type { ContentItem } from '@/lib/social/types'

// Cron de la mañana (vercel.json): Viernes le escribe a Moisés por Telegram qué toca hoy.
// Variables en Vercel: VIERNES_BOT_TOKEN y VIERNES_CHAT_ID (el mismo ID que VIERNES_OWNER_ID).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const token = process.env.VIERNES_BOT_TOKEN
  const chatId = process.env.VIERNES_CHAT_ID
  if (!token || !chatId) return NextResponse.json({ skipped: 'Viernes sin configurar' })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  const { data } = await serviceDb
    .from('content_items')
    .select('*')
    .eq('scheduled_for', today)
    .neq('status', 'descartado')
  const items = (data ?? []) as ContentItem[]

  const { count: pendingScripts } = await serviceDb
    .from('content_items')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'guion')

  const lines = ['☀️ Buenos días, jefe. Esto toca hoy:']
  if (!items.length) {
    lines.push('', 'No hay pieza programada. Genera el plan en Contenido o sube algo espontáneo.')
  }
  for (const it of items) {
    lines.push('', `${it.format === 'reel' ? '🎥 Reel para grabar' : '🖼️ Carrusel'}: ${it.title}`)
    if (it.format === 'reel' && it.hook) lines.push(`Gancho: "${it.hook}"`)
    if (it.format === 'carrusel' && it.slides?.[0]?.image_prompt && !it.slides[0].image) lines.push('Falta la portada de Gemini (el prompt está en el panel).')
    if (it.cta_keyword) lines.push(`Palabra clave: ${it.cta_keyword}`)
    const handRaiser = it.stories?.find((s) => s.tipo === 'hand-raiser')
    if (handRaiser) lines.push(`Story para abrir conversaciones: "${handRaiser.texto}"`)
    lines.push(`Estado: ${it.status}`)
  }
  if (pendingScripts) lines.push('', `📝 Tienes ${pendingScripts} guion(es) esperando tu aprobación.`)
  lines.push('', `Todo el detalle: ${req.nextUrl.origin}/admin/hoy`)

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), disable_web_page_preview: true }),
  })
  return NextResponse.json({ sent: res.ok, items: items.length })
}
