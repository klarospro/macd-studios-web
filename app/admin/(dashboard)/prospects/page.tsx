import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card, Table, Th, Td, Badge, EmptyState } from '@/components/admin/ui'
import ProspectForm from './ProspectForm'
import ProspectRow from './ProspectRow'
import type { Prospect, BotLead } from '@/lib/admin/types'

export const revalidate = 0

export default async function ProspectsPage() {
  const { supabase } = await requireSession()
  const { data: prospects } = await supabase
    .from('prospects')
    .select('*')
    .order('created_at', { ascending: false })
  const { data: botLeads } = await supabase
    .from('bot_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

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

      <PageHeader
        title="Leads del bot (Telegram)"
        subtitle="Capturados automáticamente por Max en Telegram — solo lectura, pásalos a Propuestas cuando avancen."
      />

      {!botLeads?.length ? (
        <EmptyState title="Sin leads del bot todavía" hint="Aparecerán aquí en cuanto alguien le escriba a @macdstudios_bot." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Empresa</Th>
              <Th>Teléfono</Th>
              <Th>Sector</Th>
              <Th>Plan de interés</Th>
              <Th>País</Th>
              <Th>Estado</Th>
              <Th>Canal</Th>
              <Th>Fecha</Th>
            </tr>
          </thead>
          <tbody>
            {(botLeads as BotLead[]).map((l) => (
              <tr key={l.id}>
                <Td>{l.nombre || '—'}</Td>
                <Td>{l.empresa || '—'}</Td>
                <Td>{l.telefono || '—'}</Td>
                <Td>{l.sector || '—'}</Td>
                <Td>{l.plan_interes || '—'}</Td>
                <Td>{l.pais || '—'}</Td>
                <Td>
                  <Badge tone={l.estado === 'nuevo' ? 'gold' : 'default'}>{l.estado}</Badge>
                </Td>
                <Td>{l.canal}</Td>
                <Td className="text-zinc-500 text-xs">{new Date(l.created_at).toLocaleString('es-ES')}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
