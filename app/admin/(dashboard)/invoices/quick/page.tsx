import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card } from '@/components/admin/ui'
import QuickForm from './QuickForm'

export default async function QuickInvoicePage() {
  const { supabase } = await requireSession()
  const { data: clients } = await supabase.from('clients').select('id, name, company').order('name')

  return (
    <div>
      <PageHeader title="Pago rápido de cliente" subtitle="Registra un pago ya recibido y genera la factura al instante." />
      <Card className="max-w-lg">
        <QuickForm clients={clients ?? []} />
      </Card>
    </div>
  )
}
