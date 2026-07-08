import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { content_id, image_url, token } = await req.json()

  if (token !== process.env.PANEL_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  await supabase
    .from('content_generated')
    .update({ status: 'approved' })
    .eq('id', content_id)

  await supabase.from('logs').insert({
    event_type: 'content_approved',
    source: 'panel',
    payload: { content_id },
    result: 'Aprobado por operador',
    status: 'success'
  })

  // Si hay imagen, disparar publicación en n8n
  if (image_url && process.env.N8N_WEBHOOK_URL) {
    await fetch(`${process.env.N8N_WEBHOOK_URL}/webhook/publish-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.N8N_TOKEN}`
      },
      body: JSON.stringify({ content_id, image_url })
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true })
}
