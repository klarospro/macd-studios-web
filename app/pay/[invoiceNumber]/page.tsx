import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PayButton from './PayButton'

export const revalidate = 0

function money(n: number, currency: string) {
  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${n.toFixed(2)}`
}

export default async function PayInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceNumber: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const { invoiceNumber } = await params
  const { status } = await searchParams

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(name, company)')
    .eq('invoice_number', invoiceNumber)
    .single()

  if (!invoice) notFound()

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('sort_order')

  const isPaid = invoice.status === 'paid'

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl text-[#D4AF37]">MACD STUDIOS LLC</h1>
          <p className="text-zinc-500 text-sm mt-1">Factura {invoice.invoice_number}</p>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Cliente</span>
            <span>{invoice.clients?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Vencimiento</span>
            <span>{invoice.due_date}</span>
          </div>

          <div className="border-t border-[#222] pt-4 space-y-2">
            {items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-zinc-400">{item.description}</span>
                <span>{money(item.line_total, invoice.currency)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#222] pt-4 flex justify-between items-baseline">
            <span className="text-zinc-400">Total</span>
            <span className="text-2xl font-semibold text-[#D4AF37]">{money(invoice.total, invoice.currency)}</span>
          </div>

          {isPaid ? (
            <div className="text-center py-3 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium">
              Esta factura ya ha sido pagada. Gracias.
            </div>
          ) : (
            <>
              {status === 'cancelled' && (
                <p className="text-xs text-[#e05555] text-center">Pago cancelado. Puedes intentarlo de nuevo.</p>
              )}
              <PayButton invoiceNumber={invoice.invoice_number} />
            </>
          )}
        </div>

        <p className="text-center text-xs text-zinc-700 mt-6">MACD Studios LLC — Wyoming, EE. UU.</p>
      </div>
    </main>
  )
}
