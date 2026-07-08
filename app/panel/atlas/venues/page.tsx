'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

/* ------------------------------------------------------------------ *
 * Plantilla de VENUES — da de alta un broker/exchange (Deriv/Polymarket/MT5/otro)
 * rellenando una ficha. Guarda SOLO metadatos; la clave API nunca se persiste:
 * la plantilla genera la línea .env.local para pegar en el VPS.
 * ------------------------------------------------------------------ */

interface Venue {
  id?: string
  name: string
  kind: string
  market: string | null
  capital: number
  currency: string
  symbols: string | null
  env_var: string | null
  status: string
  is_demo: boolean
  notes: string | null
}

type EnvField = { k: string; hint: string; secret: boolean }
type Preset = { label: string; market: string; envVar: string; symbols: string; env: EnvField[] }

const PRESETS: Record<string, Preset> = {
  deriv: {
    label: 'Deriv', market: 'Forex / Cripto', envVar: 'DERIV_API_TOKEN', symbols: 'BTCUSD, XAUUSD, EURUSD',
    env: [
      { k: 'DERIV_APP_ID', hint: '1089', secret: false },
      { k: 'DERIV_API_TOKEN', hint: 'token DEMO · scope read+trade', secret: true },
    ],
  },
  polymarket: {
    label: 'Polymarket', market: 'Predicción', envVar: 'POLYMARKET_API_KEY', symbols: '',
    env: [
      { k: 'POLYMARKET_API_KEY', hint: 'CLOB API key', secret: true },
      { k: 'POLYMARKET_API_SECRET', hint: 'secret del CLOB', secret: true },
      { k: 'POLYMARKET_WALLET', hint: '0x… (no secreto)', secret: false },
    ],
  },
  mt5: {
    label: 'MT5', market: 'Índices / Forex', envVar: 'MT5_PASSWORD', symbols: 'US30, NAS100',
    env: [
      { k: 'MT5_LOGIN', hint: 'nº de cuenta', secret: false },
      { k: 'MT5_SERVER', hint: 'Broker-Server', secret: false },
      { k: 'MT5_PASSWORD', hint: 'contraseña de la cuenta', secret: true },
    ],
  },
  otro: { label: 'Otro', market: '', envVar: '', symbols: '', env: [] },
}

const KIND_COLOR: Record<string, string> = { deriv: '#2dd4bf', polymarket: '#8b7ff0', mt5: '#4E97DE', otro: '#97a4b2' }
const STATUS: Record<string, { label: string; color: string }> = {
  activo: { label: 'Activo', color: '#5BC08C' },
  pausado: { label: 'Pausado', color: '#e0a35b' },
  sin_conectar: { label: 'Sin conectar', color: '#97a4b2' },
}

const money = (n: number, c = 'USD') =>
  `${c === 'USD' ? '$' : ''}${Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}${c !== 'USD' ? ' ' + c : ''}`

const emptyVenue = (kind = 'deriv'): Venue => ({
  name: '', kind, market: PRESETS[kind].market, capital: 0, currency: 'USD',
  symbols: PRESETS[kind].symbols, env_var: PRESETS[kind].envVar, status: 'sin_conectar', is_demo: true, notes: '',
})

export default function VenuesTemplate() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')
  const [venues, setVenues] = useState<Venue[]>([])
  const [form, setForm] = useState<Venue | null>(null)
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`/api/atlas/venues?token=${encodeURIComponent(tok)}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error')
      setVenues(j.venues); setAuthed(true); setError(''); sessionStorage.setItem('atlas_admin', tok)
    } catch (e) { setError((e as Error).message); setAuthed(false) }
  }, [])

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('token') || sessionStorage.getItem('atlas_admin')
    if (s) { setToken(s); load(s) }
  }, [load])

  const tok = () => sessionStorage.getItem('atlas_admin') || token

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch('/api/atlas/venues', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, token: tok() }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al guardar')
      setForm(null); setSecrets({}); load(tok())
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }

  const del = async (id?: string) => {
    if (!id || !confirm('¿Eliminar este venue?')) return
    await fetch(`/api/atlas/venues?id=${id}&token=${encodeURIComponent(tok())}`, { method: 'DELETE' })
    load(tok())
  }

  const startNew = (kind: string) => { setForm(emptyVenue(kind)); setSecrets({}) }
  const preset = form ? PRESETS[form.kind] ?? PRESETS.otro : PRESETS.otro

  // Bloque .env generado en el cliente (nunca se envía al servidor).
  const envBlock = useMemo(() => {
    return preset.env
      .filter((f) => secrets[f.k]?.trim())
      .map((f) => `${f.k}=${secrets[f.k].trim()}`)
      .join('\n')
  }, [preset, secrets])

  const totalCapital = venues.reduce((s, v) => s + Number(v.capital || 0), 0)

  /* ---------- Auth ---------- */
  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0e14] px-6 font-sans text-[#eef4f3]">
        <form onSubmit={(e) => { e.preventDefault(); load(token) }} className="w-full max-w-sm rounded-2xl border border-[#1c2733] bg-[#111823] p-7">
          <div className="mb-1 text-lg font-semibold tracking-tight">Atlas · Venues</div>
          <p className="mb-5 text-sm text-[#97a4b2]">Acceso del administrador.</p>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Clave de administrador" autoFocus
            className="h-11 w-full rounded-lg border border-[#1c2733] bg-[#0a0e14] px-3 text-sm outline-none focus:border-[#2dd4bf]/60" />
          {error && <p className="mt-3 text-xs text-[#E0736A]">{error}</p>}
          <button type="submit" className="mt-4 h-11 w-full rounded-lg bg-[#2dd4bf] text-sm font-semibold text-[#08201d] hover:opacity-90">Entrar</button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] px-4 py-7 font-sans text-[#eef4f3] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* header + nav */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#2dd4bf] to-[#4E97DE] text-[15px] font-bold text-[#08201d]">A</div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Venues · plantilla de conexiones</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#97a4b2]">Broker · API · capital — multi-venue</div>
            </div>
          </div>
          <nav className="flex gap-2 text-[13px]">
            <a href="/panel/atlas/live" className="rounded-full border border-[#1c2733] px-3.5 py-1.5 text-[#97a4b2] hover:border-[#2dd4bf]/50 hover:text-[#eef4f3]">Dashboard en vivo</a>
            <span className="rounded-full border border-[#2dd4bf]/40 bg-[#2dd4bf]/10 px-3.5 py-1.5 text-[#7fe9dd]">Venues</span>
          </nav>
        </div>

        {/* resumen */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Tile label="Venues"><div className="text-[26px] font-semibold tabular-nums">{venues.length}</div></Tile>
          <Tile label="Capital asignado"><div className="text-[26px] font-semibold tabular-nums text-[#7fe9dd]">{money(totalCapital)}</div></Tile>
          <Tile label="Activos"><div className="text-[26px] font-semibold tabular-nums text-[#5BC08C]">{venues.filter((v) => v.status === 'activo').length}</div></Tile>
          <Tile label="En demo"><div className="text-[26px] font-semibold tabular-nums">{venues.filter((v) => v.is_demo).length}/{venues.length}</div></Tile>
        </div>

        {/* añadir: presets */}
        {!form && (
          <div className="mb-5 rounded-2xl border border-[#1c2733] bg-[#111823] p-5">
            <div className="mb-3 font-mono text-[10.5px] uppercase tracking-wider text-[#97a4b2]">Añadir venue — elige un tipo (autorrellena la ficha)</div>
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(PRESETS).map(([k, p]) => (
                <button key={k} onClick={() => startNew(k)}
                  className="flex items-center gap-2 rounded-xl border border-[#1c2733] bg-[#0a0e14] px-4 py-2.5 text-sm font-medium transition-colors hover:border-[#2dd4bf]/50">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[k] }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* formulario */}
        {form && (
          <div className="mb-5 rounded-2xl border border-[#2dd4bf]/30 bg-[#111823] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[15px] font-semibold">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[form.kind] }} />
                {form.id ? 'Editar' : 'Nuevo'} venue · {preset.label}
              </div>
              <button onClick={() => { setForm(null); setSecrets({}) }} className="text-[13px] text-[#97a4b2] hover:text-[#eef4f3]">Cancelar</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="p. ej. Deriv demo principal" className={inputCls} /></Field>
              <Field label="Tipo">
                <select value={form.kind} onChange={(e) => { const k = e.target.value; setForm({ ...form, kind: k, market: PRESETS[k].market, env_var: PRESETS[k].envVar, symbols: PRESETS[k].symbols }); setSecrets({}) }} className={inputCls}>
                  {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Mercado"><input value={form.market ?? ''} onChange={(e) => setForm({ ...form, market: e.target.value })} placeholder="Forex / Cripto / Predicción…" className={inputCls} /></Field>
              <Field label="Símbolos"><input value={form.symbols ?? ''} onChange={(e) => setForm({ ...form, symbols: e.target.value })} placeholder="BTCUSD, XAUUSD, EURUSD" className={inputCls} /></Field>
              <Field label="Capital asignado">
                <div className="flex gap-2">
                  <input type="number" value={form.capital} onChange={(e) => setForm({ ...form, capital: Number(e.target.value) })} className={inputCls} />
                  <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={`${inputCls} w-20`} />
                </div>
              </Field>
              <Field label="Estado">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                  {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Variable de entorno de la API (nombre, sin el valor)"><input value={form.env_var ?? ''} onChange={(e) => setForm({ ...form, env_var: e.target.value })} placeholder="DERIV_API_TOKEN" className={`${inputCls} font-mono`} /></Field>
              <Field label="Cuenta">
                <label className="flex h-11 items-center gap-2.5 rounded-lg border border-[#1c2733] bg-[#0a0e14] px-3 text-sm">
                  <input type="checkbox" checked={form.is_demo} onChange={(e) => setForm({ ...form, is_demo: e.target.checked })} className="accent-[#2dd4bf]" />
                  {form.is_demo ? 'Demo / paper (seguro)' : 'Real — requiere aprobación'}
                </label>
              </Field>
              <div className="md:col-span-2">
                <Field label="Notas"><input value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="cualquier detalle: broker concreto, límites, etc." className={inputCls} /></Field>
              </div>
            </div>

            {/* Generador de secretos (cliente, no se guarda) */}
            {preset.env.length > 0 && (
              <div className="mt-5 rounded-xl border border-[#1c2733] bg-[#0a0e14]/60 p-4">
                <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-[#97a4b2]">Clave API — genera la línea para el .env del VPS</div>
                <p className="mb-3 text-[12px] text-[#7fe9dd]">🔒 Esto NO se guarda en la base de datos. Rellena, copia el bloque y pégalo en <span className="font-mono">/opt/atlas/ATLAS-AI/.env.local</span>.</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {preset.env.map((f) => (
                    <label key={f.k} className="block">
                      <span className="font-mono text-[11px] text-[#97a4b2]">{f.k}{f.secret && ' 🔒'}</span>
                      <input type={f.secret ? 'password' : 'text'} value={secrets[f.k] ?? ''} onChange={(e) => setSecrets({ ...secrets, [f.k]: e.target.value })} placeholder={f.hint} className={`${inputCls} mt-1 font-mono`} />
                    </label>
                  ))}
                </div>
                {envBlock && (
                  <div className="mt-3">
                    <pre className="overflow-x-auto rounded-lg border border-[#1c2733] bg-[#05080c] p-3 font-mono text-[12px] text-[#7fe9dd]">{envBlock}</pre>
                    <button onClick={() => navigator.clipboard?.writeText(envBlock)} className="mt-2 rounded-lg border border-[#1c2733] px-3 py-1.5 text-[12px] text-[#97a4b2] hover:border-[#2dd4bf]/50 hover:text-[#eef4f3]">Copiar bloque .env</button>
                  </div>
                )}
              </div>
            )}

            {error && <p className="mt-4 text-xs text-[#E0736A]">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button disabled={saving || !form.name.trim()} onClick={save} className="rounded-lg bg-[#2dd4bf] px-5 py-2.5 text-sm font-semibold text-[#08201d] hover:opacity-90 disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar venue'}</button>
              <button onClick={() => { setForm(null); setSecrets({}) }} className="rounded-lg border border-[#1c2733] px-5 py-2.5 text-sm text-[#97a4b2] hover:text-[#eef4f3]">Cancelar</button>
            </div>
          </div>
        )}

        {/* lista de venues */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => {
            const st = STATUS[v.status] ?? STATUS.sin_conectar
            return (
              <div key={v.id} className="flex flex-col rounded-2xl border border-[#1c2733] bg-[#111823] p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg text-[13px] font-bold text-[#08201d]" style={{ background: KIND_COLOR[v.kind] ?? '#97a4b2' }}>{(PRESETS[v.kind]?.label ?? v.kind).slice(0, 1)}</span>
                    <div>
                      <div className="text-[15px] font-semibold leading-tight">{v.name}</div>
                      <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#97a4b2]">{PRESETS[v.kind]?.label ?? v.kind} · {v.market ?? '—'}</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px]" style={{ color: st.color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />{st.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 border-t border-[#1c2733]/60 py-3 text-[12.5px]">
                  <span className="text-[#97a4b2]">Capital</span><span className="text-right font-semibold tabular-nums text-[#7fe9dd]">{money(v.capital, v.currency)}</span>
                  <span className="text-[#97a4b2]">Cuenta</span><span className="text-right">{v.is_demo ? 'Demo' : 'Real'}</span>
                  <span className="text-[#97a4b2]">API env</span><span className="truncate text-right font-mono text-[11px]" title={v.env_var ?? ''}>{v.env_var ?? '—'}</span>
                </div>
                {v.symbols && <div className="mb-3 flex flex-wrap gap-1.5">{v.symbols.split(',').map((s) => <span key={s} className="rounded-full border border-[#1c2733] px-2 py-0.5 text-[11px] text-[#97a4b2]">{s.trim()}</span>)}</div>}
                <div className="mt-auto flex gap-2 pt-1">
                  <button onClick={() => { setForm({ ...v }); setSecrets({}) }} className="flex-1 rounded-lg border border-[#1c2733] py-2 text-[12.5px] text-[#97a4b2] hover:border-[#2dd4bf]/50 hover:text-[#eef4f3]">Editar</button>
                  <button onClick={() => del(v.id)} className="rounded-lg border border-[#1c2733] px-3 py-2 text-[12.5px] text-[#E0736A] hover:border-[#E0736A]/50">Eliminar</button>
                </div>
              </div>
            )
          })}
          {venues.length === 0 && !form && (
            <div className="col-span-full rounded-2xl border border-dashed border-[#1c2733] py-14 text-center text-sm text-[#97a4b2]">
              Aún no hay venues. Elige un tipo arriba para dar de alta el primero.
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-[#55636F]">
          Las claves API se guardan solo en el <span className="font-mono">.env.local</span> del VPS, nunca en esta base de datos.
          Un venue en <b className="text-[#97a4b2]">real</b> requiere aprobación explícita antes de operar con dinero de verdad.
        </p>
      </div>
    </div>
  )
}

/* ---------- piezas ---------- */
const inputCls = 'h-11 w-full rounded-lg border border-[#1c2733] bg-[#0a0e14] px-3 text-sm text-[#eef4f3] outline-none focus:border-[#2dd4bf]/60'

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#1c2733] bg-[#111823] p-5">
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[#97a4b2]">{label}</div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-[#97a4b2]">{label}</span>
      {children}
    </label>
  )
}
