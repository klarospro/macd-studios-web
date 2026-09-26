'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

// Copia un texto al portapapeles (captions, prompts de Gemini, stories…) desde el móvil o el PC.
export default function CopyButton({ text, label = 'Copiar', className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors',
        done ? 'border-emerald-500/40 text-emerald-400' : 'border-[#222] text-zinc-400 hover:text-white hover:bg-white/5',
        className
      )}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? 'Copiado' : label}
    </button>
  )
}
