import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card, Table, Th, EmptyState } from '@/components/admin/ui'
import ProspectForm from './ProspectForm'
import ProspectRow from './ProspectRow'
import type { Prospect } from '@/lib/admin/types'

export const revalidate = 0

export default async function ProspectsPage() {
  const { supabase } = await requireSession()
  const { data: prospects } = await supabase
    .from('prospects')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Propuestas"
        subtitle="Pipeline de ventas de MACD Studios — clientes potenciales de la agencia, no clientes ya facturables."
      />

      <Card>
        <ProspectForm />
      </Card>

      {!prospects?.length ? (
        <EmptyState title="Sin propuestas todavía" hint="Agrega la primera arriba." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Cliente potencial</Th>
              <Th>Contacto</Th>
              <Th>Servicio</Th>
              <Th className="text-right">Monto</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {(prospects as Prospect[]).map((p) => (
              <ProspectRow key={p.id} prospect={p} />
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
