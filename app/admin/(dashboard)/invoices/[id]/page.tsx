import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card } from '@/components/admin/ui'
import InvoiceForm from '../InvoiceForm'
import InvoiceActions from '../InvoiceActions'
import { updateInvoice } from '../actions'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireSession()

  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).single()
  if (!invoice) notFound()

  const [{ data: items }, { data: clients }] = await Promise.all([
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
    supabase.from('clients').select('id, name, company').order('name'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={invoice.invoice_number}
        subtitle={`Creada el ${invoice.created_at.slice(0, 10)}`}
        action={<InvoiceActions id={id} status={invoice.status} />}
      />
      <Card className="max-w-4xl">
        <InvoiceForm clients={clients ?? []} invoice={invoice} items={items ?? []} action={updateInvoice.bind(null, id)} />
      </Card>
    </div>
  )
}
