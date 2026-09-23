import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { HONEYPOT_FIELD, isHoneypotTriggered } from '@/lib/antiSpam'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { nombre, email, telefono } = body

  if (isHoneypotTriggered(body[HONEYPOT_FIELD])) return NextResponse.json({ ok: true })
  if (!email || !nombre) return NextResponse.json({ error: 'Nombre y email requeridos' }, { status: 400 })

  const { error } = await supabase.from('bot_leads').insert({
    nombre,
    email,
    telefono: telefono || null,
    problema: 'Registro para ofertas y promociones (web)',
    estado: 'nuevo',
    canal: 'web',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
