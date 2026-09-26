'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/admin/ui'
import { syncNow } from './actions'

export default function SyncButton() {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncNow()
          toast(Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(' · '))
        })
      }
    >
      {pending ? 'Sincronizando…' : 'Sincronizar ahora'}
    </Button>
  )
}
