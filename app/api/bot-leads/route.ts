import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { nombre, empresa, telefono, email, sector, problema, plan_interes, pais, presupuesto, estado, canal } = body

  if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })

  const { error } = await supabase.from('bot_leads').insert({
    nombre,
    empresa: empresa || null,
    telefono: telefono || null,
    email: email || null,
    sector: sector || null,
    problema: problema || null,
    plan_interes: plan_interes || null,
    pais: pais || null,
    presupuesto: presupuesto || null,
    estado: estado || 'nuevo',
    canal: canal || 'telegram',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
