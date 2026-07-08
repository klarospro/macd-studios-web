import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { content_id, token } = await req.json()

  if (token !== process.env.PANEL_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  await supabase
    .from('content_generated')
    .update({ status: 'rejected' })
    .eq('id', content_id)

  await supabase.from('logs').insert({
    event_type: 'content_rejected',
    source: 'panel',
    payload: { content_id },
    result: 'Rechazado por operador',
    status: 'success'
  })

  return NextResponse.json({ ok: true })
}
