'use client'

import { useActionState, useState } from 'react'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { Field, Input, Select, Textarea, Button } from '@/components/admin/ui'
import { CATEGORY_GROUPS } from '@/lib/admin/types'
import { createTransaction, type ActionState } from './actions'

export default function TransactionForm({ onCreated }: { onCreated?: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTransaction, undefined)
  const [isRelatedParty, setIsRelatedParty] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (state?.success) {
      toast.success('Transacción registrada')
      onCreated?.()
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state, onCreated])

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fecha">
          <Input type="date" name="date" defaultValue={today} required />
        </Field>
        <Field label="Moneda">
          <Select name="currency" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
      </div>

      <Field label="Categoría">
        <Select name="category" defaultValue="" required>
          <option value="" disabled>
            Selecciona una categoría
          </option>
          {CATEGORY_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      <Field label="Descripción">
        <Input name="description" required />
      </Field>

      <Field label="Monto">
        <Input type="number" name="amount" min="0" step="0.01" required />
      </Field>

      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <input
          type="checkbox"
          name="is_related_party"
          checked={isRelatedParty}
          onChange={(e) => setIsRelatedParty(e.target.checked)}
          className="accent-[#D4AF37]"
        />
        Transacción con related party (relevante para Form 5472)
      </label>

      {isRelatedParty && (
        <Field label="Nombre del related party">
          <Input name="related_party_name" required={isRelatedParty} />
        </Field>
      )}

      <Field label="Notas">
        <Textarea name="notes" rows={2} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Registrar transacción'}
      </Button>
    </form>
  )
}
