'use client'

import { useCallback, useEffect, useState } from 'react'

interface Application {
  id: number
  created_at: string
  name: string
  email: string
  phone: string | null
  address: string | null
  capital: number | null
  currency: string | null
  account_type: string
  agenda: string | null
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'border-[#D2A05A]/40 text-[#D2A05A]',
  approved: 'border-[#5BC08C]/40 text-[#5BC08C]',
  rejected: 'border-[#E0736A]/40 text-[#E0736A]',
}

export default function SolicitudesPanel() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [rows, setRows] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  const load = useCallback(async (tok: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/atlas/solicitudes?token=${encodeURIComponent(tok)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setRows(data.rows)
      setAuthed(true)
      sessionStorage.setItem('atlas_admin', tok)
    } catch (e) {
      setError((e as Error).message)
      setAuthed(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = sessionStorage.getItem('atlas_admin')
    if (saved) {
      setToken(saved)
      load(saved)
    }
  }, [load])

  async function act(id: number, status: 'approved' | 'rejected') {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)))
    await fetch('/api/atlas/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, token }),
    }).catch(() => null)
  }

  const money = (n: number | null, cur: string | null) =>
    n == null ? '—' : `${cur === 'EUR' ? '€' : '$'}${n.toLocaleString('es-ES')}`
  const day = (iso: string) => iso.slice(0, 10)

  const shown = rows.filter((r) => filter === 'all' || r.status === filter)
  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
  }

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0B0F14] px-6 font-sans text-[#EDF1F6]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            load(token)
          }}
          className="w-full max-w-sm rounded-2xl border border-[#24303C] bg-[#131A23] p-7"
        >
          <div className="mb-1 text-lg font-semibold tracking-tight">Atlas · Panel de solicitudes</div>
          <p className="mb-5 text-sm text-[#8695A6]">Acceso restringido al administrador.</p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Clave de administrador"
            autoFocus
            className="h-11 w-full rounded-lg border border-[#24303C] bg-[#0B0F14] px-3 text-sm outline-none focus:border-[#2dd4bf]/60"
          />
          {error && <p className="mt-3 text-xs text-[#E0736A]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 h-11 w-full rounded-lg bg-[#2dd4bf] text-sm font-semibold text-[#08201d] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] px-5 py-8 font-sans text-[#EDF1F6] sm:px-8 lg:px-11">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Solicitudes de acceso</h1>
            <p className="mt-0.5 text-sm text-[#8695A6]">Inscripciones de inversores · aprobar o rechazar</p>
          </div>
          <button
            onClick={() => load(token)}
            className="rounded-lg border border-[#24303C] px-3 py-1.5 text-xs text-[#8695A6] transition-colors hover:text-[#EDF1F6]"
          >
            ↻ Actualizar
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'border-[#2dd4bf]/50 bg-[#2dd4bf]/10 text-[#2dd4bf]'
                  : 'border-[#24303C] text-[#8695A6] hover:text-[#EDF1F6]'
              }`}
            >
              {{ all: 'Todas', pending: 'Pendientes', approved: 'Aprobadas', rejected: 'Rechazadas' }[f]}{' '}
              <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#24303C] bg-[#131A23]">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left">
                {['Fecha', 'Nombre', 'Contacto', 'Perfil', 'Capital', 'Agenda', 'Estado', ''].map((h) => (
                  <th
                    key={h}
                    className="border-b border-[#24303C] px-3 py-3 font-mono text-[10.5px] font-medium uppercase tracking-wider text-[#8695A6]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-[#8695A6]">
                    Sin solicitudes {filter !== 'all' ? 'en este estado' : 'todavía'}.
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-[#24303C]/50 align-top last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-3 text-[#8695A6]">{day(r.created_at)}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{r.name}</div>
                    {r.address && <div className="text-xs text-[#8695A6]">{r.address}</div>}
                    {r.message && <div className="mt-1 max-w-[26ch] text-xs text-[#55636F]">{r.message}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <a href={`mailto:${r.email}`} className="text-[#2dd4bf] hover:underline">
                      {r.email}
                    </a>
                    {r.phone && <div className="text-xs text-[#8695A6]">{r.phone}</div>}
                  </td>
                  <td className="px-3 py-3 capitalize text-[#8695A6]">{r.account_type}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{money(r.capital, r.currency)}</td>
                  <td className="px-3 py-3 text-xs text-[#8695A6]">{r.agenda || '—'}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase ${
                        STATUS_STYLE[r.status]
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {r.status !== 'approved' && (
                      <button
                        onClick={() => act(r.id, 'approved')}
                        className="mr-1.5 rounded-md border border-[#5BC08C]/40 px-2.5 py-1 text-xs text-[#5BC08C] transition-colors hover:bg-[#5BC08C]/10"
                      >
                        Aprobar
                      </button>
                    )}
                    {r.status !== 'rejected' && (
                      <button
                        onClick={() => act(r.id, 'rejected')}
                        className="rounded-md border border-[#E0736A]/40 px-2.5 py-1 text-xs text-[#E0736A] transition-colors hover:bg-[#E0736A]/10"
                      >
                        Rechazar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-[#55636F]">
          Datos confidenciales de inscripción. Acceso solo administrador · Atlas AI · MACD Studios
        </p>
      </div>
    </div>
  )
}
