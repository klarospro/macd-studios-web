'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

const PERIODOS = [
  { id: 'trimestral', t: 'Trimestral', d: 'Retiro de ganancias cada trimestre.' },
  { id: 'anual', t: 'Anual', d: 'Retiro de ganancias una vez al año.' },
]

type State = 'idle' | 'sending' | 'ok' | 'error'

export default function RetiroForm() {
  const [periodo, setPeriodo] = useState('trimestral')
  const [state, setState] = useState<State>('idle')
  const [err, setErr] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    setErr('')
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name'),
      email: fd.get('email'),
      period_type: periodo,
      period_label: fd.get('period_label'),
      amount: fd.get('amount'),
      currency: fd.get('currency'),
      notes: fd.get('notes'),
    }
    try {
      const res = await fetch('/api/atlas/retiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar la solicitud.')
      setState('ok')
    } catch (e) {
      setState('error')
      setErr((e as Error).message)
    }
  }

  if (state === 'ok') {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center sm:px-10">
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-full border border-atlas-gold/40 bg-atlas-gold/10">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-atlas-goldsoft" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-normal leading-tight text-atlas-ink">
          Solicitud de retiro recibida.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[16px] font-light leading-relaxed text-atlas-muted">
          Gracias. Revisaremos su solicitud, verificaremos la disponibilidad del periodo y le
          confirmaremos la ejecución del retiro.
        </p>
        <Link
          href="/atlas"
          className="mt-10 inline-flex items-center gap-2 text-[14px] font-medium tracking-wide text-atlas-goldsoft underline-offset-8 hover:underline"
        >
          ← Volver a la firma
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16 sm:px-10 md:py-24">
      <div className="mb-10">
        <Link href="/atlas" className="mb-8 inline-flex items-center gap-2.5" aria-label="ATLAS — Inicio">
          <Image src="/atlas-mark-soft.png" alt="" width={44} height={40} className="h-7 w-auto" />
          <span className="text-[14px] font-medium tracking-[0.38em] text-atlas-ink">ATLAS</span>
        </Link>
        <p className="kicker mb-4 text-[11px] text-atlas-gold">Retiro de ganancias</p>
        <h1 className="text-[clamp(2rem,4.4vw,3.2rem)] font-normal leading-[1.06] text-atlas-ink">
          Solicite el retiro de sus ganancias.
        </h1>
        <p className="mt-4 max-w-md text-[15.5px] font-light leading-relaxed text-atlas-muted">
          Como en un fondo, los retiros se solicitan por periodo (trimestral o anual) y se ejecutan
          tras verificar la disponibilidad. Sin movimientos automáticos.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <fieldset>
          <legend className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-atlas-muted">
            Periodicidad
          </legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {PERIODOS.map((o) => {
              const active = periodo === o.id
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => setPeriodo(o.id)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3.5 text-left transition-all duration-300 ${
                    active
                      ? 'border-atlas-gold/60 bg-atlas-gold/[0.08]'
                      : 'border-atlas-line bg-atlas-panel/40 hover:border-atlas-gold/35'
                  }`}
                >
                  <span className="block text-[14px] font-medium text-atlas-ink">{o.t}</span>
                  <span className="mt-1 block text-[11.5px] font-light leading-snug text-atlas-muted">{o.d}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre completo" name="name" required autoComplete="name" placeholder="Su nombre" />
          <Field label="Correo" name="email" type="email" required autoComplete="email" placeholder="usted@correo.com" />
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <Field label="Importe a retirar (aprox.)" name="amount" inputMode="numeric" placeholder="5.000" />
          <div>
            <label htmlFor="currency" className="mb-2 block text-[12px] font-medium uppercase tracking-[0.14em] text-atlas-muted">
              Divisa
            </label>
            <select
              id="currency"
              name="currency"
              defaultValue="USD"
              className="h-[46px] rounded-xl border border-atlas-line bg-atlas-panel/40 px-3 text-[15px] text-atlas-ink outline-none transition-colors focus:border-atlas-gold/60"
            >
              <option>USD</option>
              <option>EUR</option>
            </select>
          </div>
        </div>

        <Field label="Periodo (opcional)" name="period_label" placeholder="Ej. Q3 2026 o 2026" />

        <div>
          <label htmlFor="notes" className="mb-2 block text-[12px] font-medium uppercase tracking-[0.14em] text-atlas-muted">
            Notas (opcional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Cualquier detalle relevante…"
            className="w-full rounded-xl border border-atlas-line bg-atlas-panel/40 px-3.5 py-3 text-[15px] leading-relaxed text-atlas-ink outline-none transition-colors placeholder:text-atlas-muted/60 focus:border-atlas-gold/60"
          />
        </div>

        {state === 'error' && (
          <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-[13.5px] text-red-200">
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={state === 'sending'}
          className="group relative w-full overflow-hidden rounded-full bg-atlas-goldsoft px-8 py-4 text-[14.5px] font-semibold tracking-wide text-atlas-bg transition-all duration-500 hover:shadow-[0_10px_40px_-8px_rgba(45,212,191,0.45)] disabled:opacity-60 sm:w-auto"
        >
          {state === 'sending' ? 'Enviando…' : 'Solicitar retiro'}
        </button>

        <p className="pt-2 text-[11.5px] font-light leading-relaxed text-atlas-muted/70">
          Esta es una solicitud, no una orden de pago. La ejecución del retiro se confirma tras la
          revisión y verificación de disponibilidad. No constituye asesoramiento financiero.
        </p>
      </form>
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  autoComplete?: string
  inputMode?: 'numeric' | 'text' | 'tel'
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[12px] font-medium uppercase tracking-[0.14em] text-atlas-muted">
        {label} {required && <span className="text-atlas-gold">·</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="h-[46px] w-full rounded-xl border border-atlas-line bg-atlas-panel/40 px-3.5 text-[15px] text-atlas-ink outline-none transition-colors placeholder:text-atlas-muted/60 focus:border-atlas-gold/60"
      />
    </div>
  )
}
