import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card, Table, Th, Td, Badge, EmptyState, money } from '@/components/admin/ui'
import DeleteButton from '@/components/admin/DeleteButton'
import ClientForm from '../ClientForm'
import { updateClient, deleteClient } from '../actions'
import type { Invoice } from '@/lib/admin/types'

const STATUS_TONE = {
  draft: 'muted',
  sent: 'default',
  paid: 'positive',
  overdue: 'negative',
  cancelled: 'muted',
} as const

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireSession()

  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', id)
    .order('issue_date', { ascending: false })

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.name}
        subtitle={client.company ?? undefined}
        action={
          <DeleteButton
            action={deleteClient.bind(null, id)}
            redirectTo="/admin/clients"
            confirmMessage={`¿Eliminar a ${client.name}? Esto no elimina sus facturas.`}
          />
        }
      />

      <Card className="max-w-3xl">
        <ClientForm client={client} action={updateClient.bind(null, id)} />
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">
          Historial de facturas ({invoices?.length ?? 0})
        </h2>
        {!invoices?.length ? (
          <EmptyState title="Sin facturas todavía" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Número</Th>
                <Th>Emisión</Th>
                <Th>Vencimiento</Th>
                <Th>Estado</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {(invoices as Invoice[]).map((inv) => (
                <tr key={inv.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <Link href={`/admin/invoices/${inv.id}`} className="text-white hover:text-[#D4AF37] font-medium">
                      {inv.invoice_number}
                    </Link>
                  </Td>
                  <Td className="text-zinc-400">{inv.issue_date}</Td>
                  <Td className="text-zinc-400">{inv.due_date}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{money(inv.total, inv.currency)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}
