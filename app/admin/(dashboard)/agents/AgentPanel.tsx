'use client'

import { useActionState } from 'react'
import { Card, Button, Input, Select } from '@/components/admin/ui'
import type { AgentState } from './actions'

type Field = { name: string; placeholder: string; type?: 'text' | 'select'; options?: string[] }

export default function AgentPanel({
  title,
  description,
  action,
  fields,
  buttonLabel = 'Generar',
}: {
  title: string
  description: string
  action: (prev: AgentState, formData: FormData) => Promise<AgentState>
  fields?: Field[]
  buttonLabel?: string
}) {
  const [state, formAction, pending] = useActionState<AgentState, FormData>(action, undefined)

  return (
    <Card>
      <h2 className="text-white font-medium">{title}</h2>
      <p className="text-sm text-zinc-500 mt-1 mb-4">{description}</p>

      <form action={formAction} className="space-y-3">
        {fields?.map((f) =>
          f.type === 'select' ? (
            <Select key={f.name} name={f.name} defaultValue="">
              <option value="" disabled>
                {f.placeholder}
              </option>
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input key={f.name} name={f.name} placeholder={f.placeholder} />
          )
        )}

        <Button type="submit" disabled={pending} variant="secondary">
          {pending ? 'Pensando…' : buttonLabel}
        </Button>
      </form>

      {state?.error && (
        <p className="text-sm text-[#e05555] mt-4 bg-[#8B1A1A]/10 border border-[#8B1A1A]/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      {state?.output && (
        <pre className="whitespace-pre-wrap text-sm text-zinc-300 mt-4 bg-[#0A0A0A] border border-[#222] rounded-lg p-4 font-sans leading-relaxed">
          {state.output}
        </pre>
      )}
    </Card>
  )
}
