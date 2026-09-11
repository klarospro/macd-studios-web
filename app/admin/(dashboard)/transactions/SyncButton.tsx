'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/admin/ui'
import { syncFromMercury } from './actions'

export default function SyncButton() {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncFromMercury()
          if (result?.error) toast.error(result.error)
          else {
            toast.success(`${result?.imported ?? 0} transacción(es) importada(s) de Mercury`)
            router.refresh()
          }
        })
      }
    >
      {pending ? 'Sincronizando…' : 'Sync from Mercury'}
    </Button>
  )
}
