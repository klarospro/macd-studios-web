'use client'

import { useActionState, useRef, useEffect } from 'react'
import { createProspect, type ActionState } from './actions'
import { Input, Select, Button, Field } from '@/components/admin/ui'

export default function ProspectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createProspect, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset()
  }, [pending, state])

  return (
    <form ref={formRef} action={action} className="grid md:grid-cols-6 gap-3 items-end">
      <Field label="Cliente potencial">
        <Input name="client_name" required placeholder="Nombre / empresa" />
      </Field>
      <Field label="Contacto">
        <Input name="contact" placeholder="Email o teléfono" />
      </Field>
      <Field label="Servicio">
        <Input name="service" placeholder="Web, sistema, automatización…" />
      </Field>
      <Field label="Monto (USD)">
        <Input name="amount" type="number" step="0.01" placeholder="0.00" />
      </Field>
      <Field label="Estado">
        <Select name="status" defaultValue="prospecto">
          <option value="prospecto">Prospecto</option>
          <option value="propuesta_enviada">Propuesta enviada</option>
          <option value="negociacion">Negociación</option>
          <option value="ganado">Ganado</option>
          <option value="perdido">Perdido</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : '+ Agregar'}
      </Button>

      {state?.error && <p className="md:col-span-6 text-sm text-[#e05555]">{state.error}</p>}
    </form>
  )
}
