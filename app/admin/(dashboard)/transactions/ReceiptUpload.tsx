'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { uploadTransactionReceipt } from './actions'

export default function ReceiptUpload({ transactionId, hasReceipt }: { transactionId: string; hasReceipt: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const fd = new FormData()
          fd.set('file', file)
          startTransition(async () => {
            const result = await uploadTransactionReceipt(transactionId, fd)
            if (result?.error) toast.error(result.error)
            else {
              toast.success('Recibo subido')
              router.refresh()
            }
          })
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="text-xs text-zinc-500 hover:text-[#D4AF37] underline underline-offset-2"
      >
        {pending ? 'Subiendo…' : hasReceipt ? 'Reemplazar recibo' : 'Subir recibo'}
      </button>
    </>
  )
}
