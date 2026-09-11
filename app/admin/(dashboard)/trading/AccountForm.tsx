'use client'

import { useActionState } from 'react'
import { Field, Input, Select, Textarea, Button } from '@/components/admin/ui'
import type { TradingAccount } from '@/lib/admin/types'

const PLATFORMS = ['Apex', 'FTMO', 'MyFundedFX', 'Topstep', 'Lucid', 'Otro']

export default function AccountForm({
  account,
  action,
}: {
  account?: TradingAccount
  action: (prev: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Plataforma">
          <Select name="platform" defaultValue={account?.platform ?? PLATFORMS[0]}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tamaño de cuenta (USD)">
          <Input type="number" name="account_size" min="0" step="1000" defaultValue={account?.account_size} required />
        </Field>
        <Field label="Tipo">
          <Select name="account_type" defaultValue={account?.account_type ?? 'evaluation'}>
            <option value="evaluation">Evaluation</option>
            <option value="funded">Funded</option>
            <option value="blown">Blown</option>
          </Select>
        </Field>
        <Field label="Estado">
          <Select name="status" defaultValue={account?.status ?? 'active'}>
            <option value="active">Active</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="payout_pending">Payout pending</option>
            <option value="closed">Closed</option>
          </Select>
        </Field>
        <Field label="Fecha de compra">
          <Input type="date" name="purchase_date" defaultValue={account?.purchase_date ?? today} required />
        </Field>
        <Field label="Costo de evaluación (USD)" hint={!account ? 'Se registra automáticamente como Expense' : undefined}>
          <Input type="number" name="purchase_cost" min="0" step="1" defaultValue={account?.purchase_cost ?? 0} required />
        </Field>
        <Field label="Fecha de paso a funded">
          <Input type="date" name="funded_date" defaultValue={account?.funded_date ?? ''} />
        </Field>
      </div>

      <Field label="Notas">
        <Textarea name="notes" rows={2} defaultValue={account?.notes ?? ''} />
      </Field>

      {state?.error && (
        <p className="text-sm text-[#e05555] bg-[#8B1A1A]/10 border border-[#8B1A1A]/30 rounded-lg px-3 py-2">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : account ? 'Guardar cambios' : 'Crear cuenta'}
      </Button>
    </form>
  )
}
