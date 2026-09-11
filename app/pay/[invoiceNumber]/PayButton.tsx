'use client'

import { useState } from 'react'

export default function PayButton({ invoiceNumber }: { invoiceNumber: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'invoice_payment', invoiceNumber }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo iniciar el pago')
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar el pago')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full bg-[#D4AF37] text-[#0A0A0A] font-semibold rounded-lg px-4 py-3 hover:bg-[#E8C766] transition-colors disabled:opacity-50"
      >
        {loading ? 'Redirigiendo…' : 'Pagar con tarjeta'}
      </button>
      {error && <p className="text-sm text-[#e05555] mt-2 text-center">{error}</p>}
    </div>
  )
}
