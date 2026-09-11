'use client'

import { useActionState } from 'react'
import { Field, Input, Select, Textarea, Button } from '@/components/admin/ui'
import type { Client } from '@/lib/admin/types'
import type { ActionState } from './actions'

export default function ClientForm({
  client,
  action,
}: {
  client?: Client
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nombre *">
          <Input name="name" defaultValue={client?.name} required />
        </Field>
        <Field label="Empresa">
          <Input name="company" defaultValue={client?.company ?? ''} />
        </Field>
        <Field label="Tax ID / NIF / EIN">
          <Input name="tax_id" defaultValue={client?.tax_id ?? ''} />
        </Field>
        <Field label="Moneda preferida">
          <Select name="preferred_currency" defaultValue={client?.preferred_currency ?? 'USD'}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={client?.email ?? ''} />
        </Field>
        <Field label="Teléfono">
          <Input name="phone" defaultValue={client?.phone ?? ''} />
        </Field>
        <Field label="Dirección">
          <Input name="address" defaultValue={client?.address ?? ''} />
        </Field>
        <Field label="Ciudad">
          <Input name="city" defaultValue={client?.city ?? ''} />
        </Field>
        <Field label="Estado / Provincia">
          <Input name="state" defaultValue={client?.state ?? ''} />
        </Field>
        <Field label="País">
          <Input name="country" defaultValue={client?.country ?? 'US'} />
        </Field>
        <Field label="Código postal">
          <Input name="zip_code" defaultValue={client?.zip_code ?? ''} />
        </Field>
      </div>

      <Field label="Notas">
        <Textarea name="notes" rows={3} defaultValue={client?.notes ?? ''} />
      </Field>

      {state?.error && (
        <p className="text-sm text-[#e05555] bg-[#8B1A1A]/10 border border-[#8B1A1A]/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : client ? 'Guardar cambios' : 'Crear cliente'}
      </Button>
    </form>
  )
}
