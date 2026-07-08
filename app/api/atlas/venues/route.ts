import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { atlasDb } from '@/lib/atlas-supabase'

// Mismo gate de admin que el resto del panel Atlas.
function adminSecret(): string | undefined {
  const fromEnv = process.env.ATLAS_ADMIN_SECRET?.trim()
  if (fromEnv) return fromEnv
  try {
    const txt = readFileSync(join(process.cwd(), 'ATLAS-AI', '.env.local'), 'utf8')
    const m = txt.match(/^ATLAS_ADMIN_SECRET=(.*)$/m)
    if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {
    /* noop */
  }
  return process.env.NODE_ENV !== 'production' ? 'atlas-dev' : undefined
}

function authed(req: NextRequest, token?: string): boolean {
  const secret = adminSecret()
  return !!secret && token === secret
}

// Campos permitidos (nunca aceptamos secretos: no hay campo para la clave API).
interface VenueInput {
  id?: string
  name?: string
  kind?: string
  market?: string
  capital?: number
  currency?: string
  symbols?: string
  env_var?: string
  status?: string
  is_demo?: boolean
  notes?: string
}

function clean(v: VenueInput) {
  return {
    name: String(v.name ?? '').slice(0, 120),
    kind: String(v.kind ?? 'otro').slice(0, 40),
    market: v.market ? String(v.market).slice(0, 80) : null,
    capital: Number.isFinite(Number(v.capital)) ? Number(v.capital) : 0,
    currency: String(v.currency ?? 'USD').slice(0, 8),
    symbols: v.symbols ? String(v.symbols).slice(0, 400) : null,
    env_var: v.env_var ? String(v.env_var).slice(0, 80) : null,
    status: ['activo', 'pausado', 'sin_conectar'].includes(String(v.status)) ? String(v.status) : 'sin_conectar',
    is_demo: v.is_demo !== false,
    notes: v.notes ? String(v.notes).slice(0, 1000) : null,
    updated_at: new Date().toISOString(),
  }
}

export async function GET(req: NextRequest) {
  if (!authed(req, req.nextUrl.searchParams.get('token') ?? undefined))
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data, error } = await atlasDb().from('atlas_venues').select('*').order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ venues: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as VenueInput & { token?: string }
  if (!authed(req, body.token ?? req.nextUrl.searchParams.get('token') ?? undefined))
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!body.name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const db = atlasDb()
  const row = clean(body)
  const res = body.id
    ? await db.from('atlas_venues').update(row).eq('id', body.id).select().single()
    : await db.from('atlas_venues').insert(row).select().single()
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  return NextResponse.json({ venue: res.data })
}

export async function DELETE(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? undefined
  if (!authed(req, token)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  const { error } = await atlasDb().from('atlas_venues').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
