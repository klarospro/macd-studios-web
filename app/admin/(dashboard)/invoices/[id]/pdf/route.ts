import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/dal'
import { renderInvoicePdf } from '@/lib/admin/pdf/InvoiceDocument'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireSession()

  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).single()
  if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

  const [{ data: client }, { data: items }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', invoice.client_id).single(),
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
  ])

  const pdfBuffer = await renderInvoicePdf(invoice, client ?? null, items ?? [])

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  })
}
