'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/admin/ui'
import DeleteButton from '@/components/admin/DeleteButton'
import { sendInvoice, duplicateInvoice, setInvoiceStatus, deleteInvoice } from './actions'
import type { InvoiceStatus } from '@/lib/admin/types'

export default function InvoiceActions({ id, status }: { id: string; status: InvoiceStatus }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/admin/invoices/${id}/pdf`} target="_blank" rel="noopener noreferrer">
        <Button type="button" variant="secondary">
          Descargar PDF
        </Button>
      </a>

      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await sendInvoice(id)
            if (result?.error) toast.error(result.error)
            else toast.success('Factura enviada por email')
          })
        }
      >
        Enviar por email
      </Button>

      {status !== 'paid' && (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setInvoiceStatus(id, 'paid')
              if (result?.error) toast.error(result.error)
              else {
                toast.success('Factura marcada como pagada')
                router.refresh()
              }
            })
          }
        >
          Marcar como pagada
        </Button>
      )}

      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await duplicateInvoice(id)
            if (result.error) toast.error(result.error)
            else if (result.newId) {
              toast.success('Factura duplicada')
              router.push(`/admin/invoices/${result.newId}`)
            }
          })
        }
      >
        Duplicar
      </Button>

      <DeleteButton
        action={deleteInvoice.bind(null, id)}
        redirectTo="/admin/invoices"
        confirmMessage="¿Eliminar esta factura? No se puede deshacer."
      />
    </div>
  )
}
