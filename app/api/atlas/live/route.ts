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

/**
 * Estado en vivo del motor + historial de operaciones + balance de la cuenta.
 *
 * Filtra SIEMPRE por venue. Sin ese filtro la curva de equity mezclaba dos
 * cuentas distintas (`deriv-demo`, plana, y `deriv-paper`, viva) en una sola
 * línea con forma de sierra que no describía a ninguna de las dos.
 */
export async function GET(req: NextRequest) {
  const secret = adminSecret()
  if (!secret || req.nextUrl.searchParams.get('token') !== secret)
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = atlasDb()

  // Qué cuentas existen y cuál mostrar. Por defecto, la que tiene el apunte más
  // reciente: es la que está operando ahora.
  const ultimas = await db
    .from('equity_log')
    .select('venue_id, at')
    .order('at', { ascending: false })
    .limit(200)
  if (ultimas.error) return NextResponse.json({ error: ultimas.error.message }, { status: 500 })

  const venues = [...new Set((ultimas.data ?? []).map((r) => r.venue_id as string))]
  const pedido = req.nextUrl.searchParams.get('venue')
  const venue = pedido && venues.includes(pedido) ? pedido : (venues[0] ?? 'deriv-paper')

  const [positions, equity, primera, trades] = await Promise.all([
    db.from('atlas_positions').select('*').eq('venue', venue).order('symbol', { ascending: true }),
    db.from('equity_log').select('at, equity').eq('venue_id', venue).order('at', { ascending: false }).limit(500),
    // El balance de partida: el primer apunte de esta cuenta, no el más antiguo
    // de los 500 traídos arriba — si la cuenta lleva semanas, no cabrían.
    db.from('equity_log').select('at, equity').eq('venue_id', venue).order('at', { ascending: true }).limit(1),
    db
      .from('atlas_sleeve_trades')
      .select('id, sleeve, symbol, side, setup_id, abierto_en, cerrado_en, precio_entrada, precio_salida, pnl, motivo_salida, risk_amount, simulada')
      .order('abierto_en', { ascending: false })
      .limit(120),
  ])

  if (positions.error) return NextResponse.json({ error: positions.error.message }, { status: 500 })

  const hist = (equity.data ?? []).slice().reverse()
  const rows = positions.data ?? []
  const totalPnl = rows.reduce((s, p) => s + (Number(p.profit) || 0), 0)
  const openRisk = rows.reduce((s, p) => s + (Number(p.risk_amount) || 0), 0)

  const balanceInicial = primera.data?.[0]?.equity != null ? Number(primera.data[0].equity) : null
  const balanceActual = hist.length ? Number(hist[hist.length - 1].equity) : null
  const variacion = balanceInicial != null && balanceActual != null ? balanceActual - balanceInicial : null

  // Métricas del historial: solo operaciones CERRADAS. Contar las abiertas como
  // si fueran resultado sería contar ganancias que aún pueden desaparecer.
  const historial = trades.data ?? []
  const cerradas = historial.filter((t) => t.cerrado_en && t.pnl != null)
  const ganadoras = cerradas.filter((t) => Number(t.pnl) > 0)
  const sumaG = ganadoras.reduce((s, t) => s + Number(t.pnl), 0)
  const sumaP = Math.abs(cerradas.filter((t) => Number(t.pnl) <= 0).reduce((s, t) => s + Number(t.pnl), 0))

  return NextResponse.json({
    venue,
    venues,
    positions: rows,
    equity: balanceActual,
    equityHistory: hist.map((r) => Number(r.equity)),
    totalPnl,
    openRisk,
    updatedAt: hist.length ? hist[hist.length - 1].at : null,
    balance: {
      inicial: balanceInicial,
      actual: balanceActual,
      desde: primera.data?.[0]?.at ?? null,
      variacion,
      variacionPct: balanceInicial ? ((variacion ?? 0) / balanceInicial) * 100 : null,
    },
    historial,
    resumen: {
      total: historial.length,
      abiertas: historial.length - cerradas.length,
      cerradas: cerradas.length,
      ganadoras: ganadoras.length,
      aciertosPct: cerradas.length ? (ganadoras.length / cerradas.length) * 100 : null,
      pnlRealizado: cerradas.reduce((s, t) => s + Number(t.pnl), 0),
      profitFactor: sumaP > 0 ? sumaG / sumaP : null,
    },
  })
}
