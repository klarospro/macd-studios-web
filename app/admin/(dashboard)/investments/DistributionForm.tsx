'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Field, Input, Button } from '@/components/admin/ui'
import { recordDistribution, type ActionState } from './actions'

export default function DistributionForm({ investmentId }: { investmentId: string }) {
  const action = recordDistribution.bind(null, investmentId)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined)
  const router = useRouter()
  const isFirstRun = useRef(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    if (state?.error) toast.error(state.error)
    else if (!pending) {
      toast.success('Pago registrado')
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
        <Field label="Monto">
          <Input type="number" name="amount" min="0" step="0.01" required />
        </Field>
      </div>
      <Field label="Concepto">
        <Input name="concept" placeholder="Ej. Cuota 3/12 — principal" />
      </Field>
      {state?.error && <p className="text-sm text-[#e05555]">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Registrar pago / repago'}
      </Button>
    </form>
  )
}
