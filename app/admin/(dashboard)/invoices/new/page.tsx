import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card } from '@/components/admin/ui'
import InvoiceForm from '../InvoiceForm'
import { createInvoice } from '../actions'

export default async function NewInvoicePage() {
  const { supabase } = await requireSession()
  const { data: clients } = await supabase.from('clients').select('id, name, company').order('name')

  return (
    <div>
      <PageHeader title="Nueva factura" />
      <Card className="max-w-4xl">
        <InvoiceForm clients={clients ?? []} action={createInvoice} />
      </Card>
    </div>
  )
}
