'use client'

import { useState } from 'react'

export default function InvestForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'investment',
          investmentType: form.get('concept'),
          amount: Number(form.get('amount')),
          currency: 'usd',
          investorName: form.get('name'),
          investorEmail: form.get('email'),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo iniciar el pago')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la solicitud')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">Nombre</label>
        <input
          name="name"
          required
          className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#D4AF37]"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">Email</label>
        <input
          name="email"
          type="email"
          required
          className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#D4AF37]"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">Monto (USD)</label>
        <input
          name="amount"
          type="number"
          min="1"
          step="0.01"
          required
          className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#D4AF37]"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">Concepto</label>
        <select
          name="concept"
          className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#D4AF37]"
        >
          <option value="capital_contribution">Inversión (capital)</option>
          <option value="loan">Préstamo</option>
        </select>
      </div>

      {error && <p className="text-sm text-[#e05555]">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#D4AF37] text-[#0A0A0A] font-semibold rounded-lg px-4 py-3 hover:bg-[#E8C766] transition-colors disabled:opacity-50"
      >
        {loading ? 'Redirigiendo…' : 'Continuar al pago'}
      </button>
    </form>
  )
}
