'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/components/admin/ui'
import TransactionForm from './TransactionForm'

export default function NewTransactionPanel() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        + Nueva transacción
      </Button>
    )
  }

  return (
    <Card className="mb-6 max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Nueva transacción</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-sm">
          Cerrar
        </button>
      </div>
      <TransactionForm
        onCreated={() => {
          setOpen(false)
          router.refresh()
        }}
      />
    </Card>
  )
}
