import { PageHeader, Card } from '@/components/admin/ui'
import ClientForm from '../ClientForm'
import { createClient } from '../actions'

export default function NewClientPage() {
  return (
    <div>
      <PageHeader title="Nuevo cliente" />
      <Card className="max-w-3xl">
        <ClientForm action={createClient} />
      </Card>
    </div>
  )
}
