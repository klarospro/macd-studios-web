'use client'

import { useActionState, useState } from 'react'
import { Field, Input, Select, Button } from '@/components/admin/ui'
import type { Client } from '@/lib/admin/types'
import { createQuickPayment, type ActionState } from './actions'

const CONCEPT_TEMPLATES = [
  'Página web',
  'App',
  'Automatización',
  'Sistema automático',
  'Servicio',
  'Préstamo',
  'Inversión',
]

export default function QuickForm({ clients }: { clients: Pick<Client, 'id' | 'name' | 'company'>[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createQuickPayment, undefined)
  const [isNewClient, setIsNewClient] = useState(false)
  const [concept, setConcept] = useState('')

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Cliente">
        {isNewClient ? (
          <div className="space-y-2">
            <Input name="new_client_name" placeholder="Nombre del cliente" required />
            <Input name="new_client_email" type="email" placeholder="Email (opcional)" />
            <button
              type="button"
              onClick={() => setIsNewClient(false)}
              className="text-xs text-zinc-500 hover:text-[#D4AF37]"
            >
              ← elegir cliente existente
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Select name="client_id" defaultValue="">
              <option value="" disabled>
                Selecciona un cliente
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` — ${c.company}` : ''}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => setIsNewClient(true)}
              className="text-xs text-zinc-500 hover:text-[#D4AF37]"
            >
              + cliente nuevo
            </button>
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Monto *">
          <Input name="amount" type="number" min="0" step="0.01" required />
        </Field>
        <Field label="Moneda">
          <Select name="currency" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
      </div>

      <Field label="Concepto *" hint="Se usará como descripción de la línea de servicio en la factura">
        <div className="space-y-2">
          <Select
            value=""
            onChange={(e) => e.target.value && setConcept(e.target.value)}
          >
            <option value="" disabled>
              Plantilla…
            </option>
            {CONCEPT_TEMPLATES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            name="concept"
            placeholder="Ej. Mantenimiento web — Septiembre"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            required
          />
        </div>
      </Field>

      {state?.error && (
        <p className="text-sm text-[#e05555] bg-[#8B1A1A]/10 border border-[#8B1A1A]/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Generando…' : 'Registrar pago y generar factura'}
      </Button>
    </form>
  )
}
