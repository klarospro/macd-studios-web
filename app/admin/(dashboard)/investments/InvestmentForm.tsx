'use client'

import { useActionState } from 'react'
import { Field, Input, Select, Textarea, Button } from '@/components/admin/ui'
import type { Investment } from '@/lib/admin/types'

export default function InvestmentForm({
  investment,
  action,
}: {
  investment?: Investment
  action: (prev: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nombre del inversor">
          <Input name="investor_name" defaultValue={investment?.investor_name} required />
        </Field>
        <Field label="Relación">
          <Select name="relationship" defaultValue={investment?.relationship ?? 'external'}>
            <option value="owner">Owner</option>
            <option value="family">Family</option>
            <option value="external">External Investor</option>
          </Select>
        </Field>
        <Field label="Tipo">
          <Select name="type" defaultValue={investment?.type ?? 'capital_contribution'}>
            <option value="capital_contribution">Capital Contribution (equity)</option>
            <option value="loan">Loan (deuda)</option>
          </Select>
        </Field>
        <Field label="Estado">
          <Select name="status" defaultValue={investment?.status ?? 'active'}>
            <option value="active">Active</option>
            <option value="fully_repaid">Fully Repaid</option>
            <option value="converted_to_equity">Converted to Equity</option>
            <option value="defaulted">Defaulted</option>
          </Select>
        </Field>
        <Field label="Monto">
          <Input type="number" name="amount" min="0" step="0.01" defaultValue={investment?.amount} required />
        </Field>
        <Field label="Moneda">
          <Select name="currency" defaultValue={investment?.currency ?? 'USD'}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
        <Field label="Fecha">
          <Input type="date" name="date" defaultValue={investment?.date ?? today} required />
        </Field>
        <Field label="Tasa de interés % (si es préstamo)">
          <Input type="number" name="interest_rate" step="0.01" defaultValue={investment?.interest_rate ?? ''} />
        </Field>
        <Field label="Fecha de vencimiento del repago">
          <Input type="date" name="repayment_due_date" defaultValue={investment?.repayment_due_date ?? ''} />
        </Field>
        <Field label="Calendario de pagos">
          <Input name="repayment_schedule" defaultValue={investment?.repayment_schedule ?? ''} placeholder="Ej. mensual, 12 cuotas" />
        </Field>
      </div>

      <Field label="Contrato / acuerdo (PDF)" hint={investment?.contract_url ? 'Ya hay un contrato subido — sube uno nuevo para reemplazarlo' : undefined}>
        <input
          type="file"
          name="contract"
          accept="application/pdf"
          className="block w-full text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs hover:file:bg-white/20"
        />
      </Field>

      <Field label="Notas">
        <Textarea name="notes" rows={2} defaultValue={investment?.notes ?? ''} />
      </Field>

      {state?.error && (
        <p className="text-sm text-[#e05555] bg-[#8B1A1A]/10 border border-[#8B1A1A]/30 rounded-lg px-3 py-2">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : investment ? 'Guardar cambios' : 'Registrar inversión'}
      </Button>
    </form>
  )
}
