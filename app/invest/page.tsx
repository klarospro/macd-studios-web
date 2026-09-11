import InvestForm from './InvestForm'

export const metadata = { title: 'Invertir — MACD Studios' }

export default async function InvestPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl text-[#D4AF37]">Inversión / Apoyo</h1>
          <p className="text-zinc-500 text-sm mt-1">MACD Studios LLC</p>
        </div>

        {status === 'success' && (
          <div className="mb-4 text-center py-3 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm">
            ¡Gracias! Tu aportación se ha registrado correctamente.
          </div>
        )}

        <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
          <InvestForm />
        </div>

        <p className="text-xs text-zinc-600 mt-6 leading-relaxed">
          This is not a donation. Funds received are classified as capital contributions or loans
          per the LLC&apos;s operating agreement.
        </p>
      </div>
    </main>
  )
}
