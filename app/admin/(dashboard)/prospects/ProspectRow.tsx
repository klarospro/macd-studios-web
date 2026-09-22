'use client'

import { useTransition } from 'react'
import { Td, Select, Button, money } from '@/components/admin/ui'
import { updateProspectStatus, deleteProspect } from './actions'
import type { Prospect } from '@/lib/admin/types'

export default function ProspectRow({ prospect }: { prospect: Prospect }) {
  const [isPending, startTransition] = useTransition()

  return (
    <tr className="hover:bg-white/[0.02]">
      <Td className="text-white font-medium">{prospect.client_name}</Td>
      <Td className="text-zinc-400">{prospect.contact || '—'}</Td>
      <Td className="text-zinc-400">{prospect.service || '—'}</Td>
      <Td className="text-right tabular-nums text-zinc-300">
        {prospect.amount != null ? money(prospect.amount, prospect.currency) : '—'}
      </Td>
      <Td>
        <Select
          defaultValue={prospect.status}
          disabled={isPending}
          onChange={(e) => {
            const value = e.target.value
            startTransition(() => {
              void updateProspectStatus(prospect.id, value)
            })
          }}
          className="text-xs py-1.5"
        >
          <option value="prospecto">Prospecto</option>
          <option value="propuesta_enviada">Propuesta enviada</option>
          <option value="negociacion">Negociación</option>
          <option value="ganado">Ganado</option>
          <option value="perdido">Perdido</option>
        </Select>
      </Td>
      <Td>
        <a
          href={`/admin/prospects/${prospect.id}/pdf`}
          target="_blank"
          rel="noopener"
          className="text-xs text-[#D4AF37] hover:text-[#E8C766] underline underline-offset-2 mr-3"
        >
          PDF
        </a>
        <Button
          type="button"
          variant="danger"
          disabled={isPending}
          onClick={() => {
            if (confirm(`¿Borrar la propuesta de "${prospect.client_name}"?`)) {
              startTransition(() => {
                void deleteProspect(prospect.id)
              })
            }
          }}
          className="text-xs px-2.5 py-1.5"
        >
          Borrar
        </Button>
      </Td>
    </tr>
  )
}
