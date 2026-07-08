import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { atlasDb } from '@/lib/atlas-supabase'

// Mismo gate de admin que el panel de solicitudes.
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

export async function GET(req: NextRequest) {
  const secret = adminSecret()
  if (!secret || req.nextUrl.searchParams.get('token') !== secret)
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = atlasDb()
  const [positions, equity] = await Promise.all([
    db.from('atlas_positions').select('*').order('venue', { ascending: true }),
    db.from('equity_log').select('at, equity, venue_id').order('at', { ascending: false }).limit(60),
  ])

  if (positions.error) return NextResponse.json({ error: positions.error.message }, { status: 500 })

  const hist = (equity.data ?? []).slice().reverse()
  const rows = positions.data ?? []
  const totalPnl = rows.reduce((s, p) => s + (Number(p.profit) || 0), 0)
  const openRisk = rows.reduce((s, p) => s + (Number(p.risk_amount) || 0), 0)
  return NextResponse.json({
    positions: rows,
    equity: hist.length ? hist[hist.length - 1].equity : null,
    equityHistory: hist.map((r) => r.equity),
    totalPnl,
    openRisk,
    updatedAt: hist.length ? hist[hist.length - 1].at : null,
  })
}
