'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Field, Input, Select, Textarea, Button } from '@/components/admin/ui'
import { recordTradingPnl, type ActionState } from './actions'

export default function PnlForm({ accountId }: { accountId: string }) {
  const action = recordTradingPnl.bind(null, accountId)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined)
  const [isPayout, setIsPayout] = useState(false)
  const router = useRouter()
  const isFirstRun = useRef(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    if (state?.error) {
      toast.error(state.error)
    } else if (!pending) {
      toast.success('P&L registrado')
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha">
          <Input type="date" name="date" defaultValue={today} required />
        </Field>
        <Field label="Gross profit">
          <Input type="number" name="gross_profit" step="0.01" required />
        </Field>
      </div>
      <Field label="Fees">
        <Input type="number" name="fees" step="0.01" defaultValue={0} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <input type="checkbox" name="is_payout" checked={isPayout} onChange={(e) => setIsPayout(e.target.checked)} className="accent-[#D4AF37]" />
        Es un payout
      </label>

      {isPayout && (
        <Field label="Estado del payout">
          <Select name="payout_status" defaultValue="pending">
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="rejected">Rejected</option>
          </Select>
        </Field>
      )}

      <Field label="Notas">
        <Textarea name="notes" rows={2} />
      </Field>

      {state?.error && <p className="text-sm text-[#e05555]">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Registrar'}
      </Button>
    </form>
  )
}
