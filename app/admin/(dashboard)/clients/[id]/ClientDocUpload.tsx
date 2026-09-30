'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Select } from '@/components/admin/ui'
import { uploadClientDocument } from '../actions'

const MAX_BYTES = 4 * 1024 * 1024

export default function ClientDocUpload({ clientId }: { clientId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState('contracts')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto">
        <option value="contracts">Contrato</option>
        <option value="invoices">Factura</option>
        <option value="receipts">Comprobante / recibo</option>
      </Select>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          if (file.size > MAX_BYTES) {
            toast.error('El archivo pasa de 4 MB. Comprímelo o haz la foto con menos resolución.')
            return
          }
          const fd = new FormData()
          fd.set('file', file)
          fd.set('kind', kind)
          startTransition(async () => {
            const result = await uploadClientDocument(clientId, fd)
            if (result?.error) toast.error(result.error)
            else {
              toast.success('Documento guardado')
              router.refresh()
            }
          })
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="text-sm px-3 py-2 rounded-lg bg-[#D4AF37] text-black font-medium hover:bg-[#c9a430] disabled:opacity-50"
      >
        {pending ? 'Subiendo…' : 'Subir documento'}
      </button>
    </div>
  )
}
