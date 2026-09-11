import Link from 'next/link'
import { requireSession } from '@/lib/admin/dal'
import { PageHeader, LinkButton, Table, Th, Td, EmptyState, Badge, Select, money } from '@/components/admin/ui'
import type { Invoice, InvoiceStatus } from '@/lib/admin/types'

export const revalidate = 0

const STATUS_TONE: Record<InvoiceStatus, 'muted' | 'default' | 'positive' | 'negative'> = {
  draft: 'muted',
  sent: 'default',
  paid: 'positive',
  overdue: 'negative',
  cancelled: 'muted',
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { supabase } = await requireSession()
  const { status } = await searchParams

  let query = supabase
    .from('invoices')
    .select('*, clients(id, name, company, email)')
    .order('issue_date', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data: invoices } = await query

  return (
    <div>
      <PageHeader
        title="Facturas"
        subtitle={`${invoices?.length ?? 0} factura(s)`}
        action={
          <div className="flex gap-2">
            <LinkButton href="/admin/invoices/quick" variant="secondary">
              Pago rápido
            </LinkButton>
            <LinkButton href="/admin/invoices/new">+ Nueva factura</LinkButton>
          </div>
        }
      />

      <form className="mb-4">
        <Select name="status" defaultValue={status ?? ''} className="max-w-xs" onChange={(e) => e.currentTarget.form?.submit()}>
          <option value="">Todos los estados</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </form>

      {!invoices?.length ? (
        <EmptyState title="Sin facturas todavía" hint="Crea tu primera factura." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Número</Th>
              <Th>Cliente</Th>
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
                <Td className="text-zinc-400">{inv.clients?.name ?? '—'}</Td>
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
  )
}
