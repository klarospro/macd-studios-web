'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Position {
  id: number
  venue: string
  symbol: string
  side: string
  size: number
  entry_price: number | null
  stop_price: number | null
  risk_amount: number | null
  profit: number | null
  opened_at: string | null
}
interface Live {
  positions: Position[]
  equity: number | null
  equityHistory: number[]
  totalPnl: number
  openRisk: number
  updatedAt: string | null
}

const REFRESH_MS = 8000
const TEAL = '#2dd4bf', BLUE = '#4E97DE', PURPLE = '#8b7ff0', GREEN = '#5BC08C', RED = '#E0736A'
const ASSET_COLORS = [TEAL, BLUE, PURPLE, '#e0a35b', GREEN]

const money = (n: number | null | undefined) =>
  n == null ? '—' : `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/* ---------- mini-gráficos ---------- */
function Area({ values, color = TEAL, h = 180 }: { values: number[]; color?: string; h?: number }) {
  if (values.length < 2) return <div className="grid h-full place-items-center text-xs text-[#55636F]">Sin histórico aún</div>
  const w = 600
  const lo = Math.min(...values), hi = Math.max(...values)
  const pad = (hi - lo) * 0.15 || 1
  const yMin = lo - pad, yMax = hi + pad
  const x = (i: number) => (i / (values.length - 1)) * w
  const y = (v: number) => h - ((v - yMin) / (yMax - yMin)) * h
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ac" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#ac)" />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    </svg>
  )
}

function Spark({ values, color = TEAL }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const w = 120, h = 34
  const lo = Math.min(...values), hi = Math.max(...values), r = hi - lo || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - lo) / r) * (h - 4) - 2}`).join(' ')
  return <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth={2} /></svg>
}

function Donut({ pct, color = TEAL, label }: { pct: number; color?: string; label: string }) {
  const r = 26, c = 2 * Math.PI * r, dash = (Math.max(0, Math.min(100, pct)) / 100) * c
  return (
    <div className="relative h-[64px] w-[64px] flex-none">
      <svg viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#1c2733" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[12px] font-semibold tabular-nums">{label}</div>
    </div>
  )
}

/* ---------- tiles ---------- */
function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#1c2733] bg-[#111823] p-5">
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[#97a4b2]">{label}</div>
      {children}
    </div>
  )
}

export default function LivePanel() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [d, setD] = useState<Live | null>(null)
  const [error, setError] = useState('')
  const [secs, setSecs] = useState(0)
  const tokRef = useRef('')

  const load = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`/api/atlas/live?token=${encodeURIComponent(tok)}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error')
      setD(j); setAuthed(true); setSecs(0); tokRef.current = tok
      sessionStorage.setItem('atlas_admin', tok)
    } catch (e) { setError((e as Error).message); setAuthed(false) }
  }, [])

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('token')
    const s = fromUrl || sessionStorage.getItem('atlas_admin')
    if (s) { setToken(s); load(s) }
  }, [load])
  useEffect(() => {
    if (!authed) return
    const p = setInterval(() => load(tokRef.current), REFRESH_MS)
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => { clearInterval(p); clearInterval(t) }
  }, [authed, load])

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0e14] px-6 font-sans text-[#eef4f3]">
        <form onSubmit={(e) => { e.preventDefault(); load(token) }} className="w-full max-w-sm rounded-2xl border border-[#1c2733] bg-[#111823] p-7">
          <div className="mb-1 text-lg font-semibold tracking-tight">Atlas · Dashboard</div>
          <p className="mb-5 text-sm text-[#97a4b2]">Acceso del administrador.</p>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Clave de administrador" autoFocus
            className="h-11 w-full rounded-lg border border-[#1c2733] bg-[#0a0e14] px-3 text-sm outline-none focus:border-[#2dd4bf]/60" />
          {error && <p className="mt-3 text-xs text-[#E0736A]">{error}</p>}
          <button type="submit" className="mt-4 h-11 w-full rounded-lg bg-[#2dd4bf] text-sm font-semibold text-[#08201d] hover:opacity-90">Entrar</button>
        </form>
      </div>
    )
  }

  const positions = d?.positions ?? []
  const green = positions.filter((p) => (p.profit ?? 0) >= 0).length
  const pctGreen = positions.length ? (green / positions.length) * 100 : 0
  const pnl = d?.totalPnl ?? 0
  const pnlPct = d?.equity ? (pnl / d.equity) * 100 : 0
  const totalRisk = positions.reduce((s, p) => s + (p.risk_amount ?? 0), 0) || 1

  return (
    <div className="min-h-screen bg-[#0a0e14] px-4 py-7 font-sans text-[#eef4f3] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#2dd4bf] to-[#4E97DE] text-[15px] font-bold text-[#08201d]">A</div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Atlas · Dashboard</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#97a4b2]">Gestión automatizada · Deriv demo</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <a href="/panel/atlas/venues" className="rounded-full border border-[#1c2733] px-3.5 py-1.5 text-[#97a4b2] hover:border-[#2dd4bf]/50 hover:text-[#eef4f3]">Venues</a>
            <span className="flex items-center gap-2 rounded-full border border-[#1c2733] px-3 py-1.5 text-xs text-[#97a4b2]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#5BC08C]" /> en vivo · hace {secs}s
            </span>
          </div>
        </div>

        {/* KPI row */}
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="P/L abierto">
            <div className={`text-[26px] font-semibold tabular-nums ${pnl >= 0 ? 'text-[#5BC08C]' : 'text-[#E0736A]'}`}>{money(pnl)}</div>
            <div className={`text-[12px] ${pnl >= 0 ? 'text-[#5BC08C]' : 'text-[#E0736A]'}`}>{pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</div>
            <div className="mt-2"><Spark values={d?.equityHistory ?? []} color={pnl >= 0 ? GREEN : RED} /></div>
          </Tile>
          <Tile label="En positivo">
            <div className="flex items-center gap-3">
              <Donut pct={pctGreen} color={BLUE} label={`${pctGreen.toFixed(0)}%`} />
              <div className="text-[12px] text-[#97a4b2]">{green} de {positions.length}<br />posiciones en verde</div>
            </div>
          </Tile>
          <Tile label="Equity · cuenta">
            <div className="text-[26px] font-semibold tabular-nums">{money(d?.equity ?? null)}</div>
            <div className="mt-2"><Spark values={d?.equityHistory ?? []} color={TEAL} /></div>
          </Tile>
          <Tile label="Riesgo · posiciones">
            <div className="text-[26px] font-semibold tabular-nums text-[#7fe9dd]">{money(d?.openRisk ?? 0)}</div>
            <div className="mt-1 flex items-end gap-1.5">
              {positions.map((p, i) => (
                <div key={p.id} className="flex-1 rounded-t" style={{ height: `${8 + ((p.risk_amount ?? 0) / totalRisk) * 34}px`, background: ASSET_COLORS[i % ASSET_COLORS.length] }} title={p.symbol} />
              ))}
              {positions.length === 0 && <div className="text-[12px] text-[#55636F]">—</div>}
            </div>
            <div className="mt-1 text-[12px] text-[#97a4b2]">{positions.length}/3 abiertas</div>
          </Tile>
        </div>

        {/* charts row */}
        <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-[#1c2733] bg-[#111823] p-5">
            <div className="mb-3 font-mono text-[10.5px] uppercase tracking-wider text-[#97a4b2]">Curva de equity</div>
            <div className="h-[180px]"><Area values={d?.equityHistory ?? []} color={TEAL} /></div>
          </div>
          <div className="rounded-2xl border border-[#1c2733] bg-[#111823] p-5">
            <div className="mb-3 font-mono text-[10.5px] uppercase tracking-wider text-[#97a4b2]">Desglose por activo</div>
            <div className="space-y-2.5">
              {positions.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 text-[13px]">
                  <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                  <span className="w-16 flex-none font-medium">{p.symbol}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-[#1c2733]">
                    <div className="h-full rounded" style={{ width: `${((p.risk_amount ?? 0) / totalRisk) * 100}%`, background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                  </div>
                  <span className={`w-16 flex-none text-right tabular-nums ${(p.profit ?? 0) >= 0 ? 'text-[#5BC08C]' : 'text-[#E0736A]'}`}>{money(p.profit)}</span>
                </div>
              ))}
              {positions.length === 0 && <div className="text-[13px] text-[#55636F]">Sin posiciones abiertas.</div>}
            </div>
          </div>
        </div>

        {/* trade table */}
        <div className="overflow-x-auto rounded-2xl border border-[#1c2733] bg-[#111823]">
          <div className="border-b border-[#1c2733] px-5 py-3 font-mono text-[10.5px] uppercase tracking-wider text-[#97a4b2]">Posiciones abiertas</div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                {['Activo', 'Dirección', 'Estrategia', 'Entrada', 'Stop', 'Riesgo', 'P/L', 'P/L %', 'Estado'].map((h) => (
                  <th key={h} className="border-b border-[#1c2733] px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[#97a4b2]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#97a4b2]">Sin posiciones abiertas ahora mismo.</td></tr>}
              {positions.map((p) => {
                const win = (p.profit ?? 0) >= 0
                const plPct = p.risk_amount ? ((p.profit ?? 0) / p.risk_amount) * 100 : 0
                return (
                  <tr key={p.id} className="border-b border-[#1c2733]/50 last:border-b-0">
                    <td className="px-4 py-3 font-semibold">{p.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${p.side === 'buy' ? 'bg-[#5BC08C]/15 text-[#5BC08C]' : 'bg-[#E0736A]/15 text-[#E0736A]'}`}>{p.side === 'buy' ? 'Largo' : 'Corto'}</span>
                    </td>
                    <td className="px-4 py-3 text-[#97a4b2]">TSMOM</td>
                    <td className="px-4 py-3 tabular-nums">{p.entry_price ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-[#97a4b2]">{p.stop_price?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-[#7fe9dd]">{money(p.risk_amount)}</td>
                    <td className={`px-4 py-3 font-semibold tabular-nums ${win ? 'text-[#5BC08C]' : 'text-[#E0736A]'}`}>{money(p.profit)}</td>
                    <td className={`px-4 py-3 tabular-nums ${win ? 'text-[#5BC08C]' : 'text-[#E0736A]'}`}>{win ? '+' : ''}{plPct.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[12px] ${win ? 'text-[#5BC08C]' : 'text-[#E0736A]'}`}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: win ? GREEN : RED }} />{win ? 'En verde' : 'En rojo'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-[#55636F]">Cuenta demo (dinero virtual). El motor publica el estado en cada ciclo · refresco cada {REFRESH_MS / 1000}s.</p>
      </div>
    </div>
  )
}
