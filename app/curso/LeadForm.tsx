'use client'

import { useState } from 'react'

export default function LeadForm({ source, product }: { source: string; product: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')

    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, source, product })
    })

    setStatus(res.ok ? 'done' : 'error')
  }

  if (status === 'done') {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">✉️</div>
        <p className="text-[#D4AF37] font-semibold">¡Perfecto, {name || 'crack'}!</p>
        <p className="text-zinc-500 text-sm mt-2">
          Revisa tu email — te mandamos todo ahora mismo.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Tu nombre"
        value={name}
        onChange={e => setName(e.target.value)}
        className="bg-[#0d0d0d] border border-[#333] rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-700 focus:outline-none focus:border-[#D4AF37]/50"
      />
      <input
        type="email"
        placeholder="Tu email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="bg-[#0d0d0d] border border-[#333] rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-700 focus:outline-none focus:border-[#D4AF37]/50"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="bg-[#D4AF37] text-black font-bold py-3 rounded-lg hover:bg-[#E8C766] transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? 'Enviando...' : 'Quiero el sistema →'}
      </button>
      {status === 'error' && (
        <p className="text-red-400 text-xs text-center">Algo falló. Intenta de nuevo.</p>
      )}
      <p className="text-zinc-700 text-xs text-center">Sin spam. Solo lo que prometemos.</p>
    </form>
  )
}
