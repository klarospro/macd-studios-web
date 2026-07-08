'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

const TIPOS = [
  { id: 'inversor', t: 'Inversor', d: 'Confía capital para gestión bajo la metodología.' },
  { id: 'accionista', t: 'Accionista', d: 'Participa de la firma como socio.' },
  { id: 'plantilla', t: 'Plantilla', d: 'Quiere licenciar el sistema para uso propio.' },
]

type State = 'idle' | 'sending' | 'ok' | 'error'

export default function SolicitudForm() {
  const [tipo, setTipo] = useState('inversor')
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
      phone: fd.get('phone'),
      address: fd.get('address'),
      capital: fd.get('capital'),
      currency: fd.get('currency'),
      account_type: tipo,
      agenda: fd.get('agenda'),
      message: fd.get('message'),
    }
    try {
      const res = await fetch('/api/atlas/solicitud', {
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
          Solicitud recibida.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[16px] font-light leading-relaxed text-atlas-muted">
          Gracias. Revisaremos su solicitud y le contactaremos para agendar una conversación privada.
          Al aprobarse recibirá el <span className="text-atlas-ink">dossier de la firma</span> y acceso
          a su <span className="text-atlas-ink">dashboard de metodología</span>.
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
        <p className="kicker mb-4 text-[11px] text-atlas-gold">Solicitud de acceso</p>
        <h1 className="text-[clamp(2rem,4.4vw,3.2rem)] font-normal leading-[1.06] text-atlas-ink">
          Comencemos una conversación privada.
        </h1>
        <p className="mt-4 max-w-md text-[15.5px] font-light leading-relaxed text-atlas-muted">
          Cuéntenos quién es y qué busca. Revisamos cada solicitud personalmente; no hay compromiso.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* Tipo de cuenta */}
        <fieldset>
          <legend className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-atlas-muted">
            Perfil
          </legend>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {TIPOS.map((o) => {
              const active = tipo === o.id
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => setTipo(o.id)}
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
          <Field label="Teléfono" name="phone" type="tel" autoComplete="tel" placeholder="+34 …" />
          <Field label="Dirección" name="address" autoComplete="street-address" placeholder="Ciudad, país" />
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <Field label="Capital a gestionar (aprox.)" name="capital" inputMode="numeric" placeholder="50.000" />
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

        <Field label="¿Cuándo le viene bien hablar?" name="agenda" placeholder="Ej. semana del 14, mañanas" />

        <div>
          <label htmlFor="message" className="mb-2 block text-[12px] font-medium uppercase tracking-[0.14em] text-atlas-muted">
            Mensaje (opcional)
          </label>
          <textarea
            id="message"
            name="message"
            rows={3}
            placeholder="Cuéntenos su objetivo…"
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
          {state === 'sending' ? 'Enviando…' : 'Enviar solicitud'}
        </button>

        <p className="pt-2 text-[11.5px] font-light leading-relaxed text-atlas-muted/70">
          Sus datos se tratan de forma confidencial y solo para evaluar la solicitud. Esto no constituye
          oferta ni asesoramiento financiero; toda gestión se valida primero en entornos de prueba.
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
