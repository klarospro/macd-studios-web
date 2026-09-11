'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from './ui'

export default function DeleteButton({
  action,
  confirmMessage = '¿Seguro que quieres eliminar esto? No se puede deshacer.',
  redirectTo,
  label = 'Eliminar',
}: {
  action: () => Promise<{ error?: string } | undefined>
  confirmMessage?: string
  redirectTo?: string
  label?: string
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Button
      type="button"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (!confirm(confirmMessage)) return
        startTransition(async () => {
          const result = await action()
          if (result?.error) {
            toast.error(result.error)
            return
          }
          toast.success('Eliminado correctamente')
          if (redirectTo) router.push(redirectTo)
          router.refresh()
        })
      }}
    >
      {pending ? 'Eliminando…' : label}
    </Button>
  )
}
