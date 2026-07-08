import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { name, email, source, product } = await req.json()

  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  // Guardar en Supabase
  await supabase.from('course_leads').upsert(
    { email, name, source, product, status: 'lead' },
    { onConflict: 'email', ignoreDuplicates: true }
  )

  await supabase.from('logs').insert({
    event_type: 'lead_captured',
    source: 'landing',
    payload: { email, name, source, product },
    result: 'Lead registrado',
    status: 'success'
  })

  // Disparar secuencia email en n8n
  if (process.env.N8N_WEBHOOK_URL) {
    await fetch(`${process.env.N8N_WEBHOOK_URL}/webhook/lead-captured`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.N8N_TOKEN}`
      },
      body: JSON.stringify({ name, email, source, product })
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true })
}
