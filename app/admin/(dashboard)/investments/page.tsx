import Link from 'next/link'
import { requireSession } from '@/lib/admin/dal'
import { PageHeader, LinkButton, StatCard, Table, Th, Td, EmptyState, Badge, money } from '@/components/admin/ui'
import type { Investment } from '@/lib/admin/types'

export const revalidate = 0

export default async function InvestmentsPage() {
  const { supabase } = await requireSession()

  const [{ data: investments }, { data: distributions }] = await Promise.all([
    supabase.from('investments').select('*').order('date', { ascending: false }),
    supabase.from('distributions').select('investment_id, amount'),
  ])

  const paidByInvestment = new Map<string, number>()
  for (const d of distributions ?? []) {
    paidByInvestment.set(d.investment_id, (paidByInvestment.get(d.investment_id) ?? 0) + d.amount)
  }

  const totalCapital = (investments ?? []).filter((i) => i.type === 'capital_contribution').reduce((s, i) => s + i.amount, 0)
  const totalLoans = (investments ?? []).filter((i) => i.type === 'loan').reduce((s, i) => s + i.amount, 0)
  const totalRepaid = [...paidByInvestment.values()].reduce((s, v) => s + v, 0)

  return (
    <div className="space-y-8">
      <PageHeader title="Inversiones y préstamos" action={<LinkButton href="/admin/investments/new">+ Nueva inversión</LinkButton>} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Capital aportado" value={money(totalCapital)} tone="gold" />
        <StatCard label="Préstamos recibidos" value={money(totalLoans)} />
        <StatCard label="Total repagado" value={money(totalRepaid)} tone="positive" />
      </div>

      {!investments?.length ? (
        <EmptyState title="Sin inversiones registradas todavía" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Inversor</Th>
              <Th>Relación</Th>
              <Th>Tipo</Th>
              <Th>Estado</Th>
              <Th className="text-right">Monto</Th>
              <Th className="text-right">Repagado</Th>
            </tr>
          </thead>
          <tbody>
            {(investments as Investment[]).map((inv) => {
              const paid = paidByInvestment.get(inv.id) ?? 0
              return (
                <tr key={inv.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <Link href={`/admin/investments/${inv.id}`} className="text-white hover:text-[#D4AF37] font-medium">
                      {inv.investor_name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={inv.relationship === 'external' ? 'muted' : 'gold'}>{inv.relationship}</Badge>
                  </Td>
                  <Td className="text-zinc-400">{inv.type === 'loan' ? 'Loan' : 'Capital'}</Td>
                  <Td>
                    <Badge tone={inv.status === 'active' ? 'default' : inv.status === 'defaulted' ? 'negative' : 'positive'}>
                      {inv.status}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{money(inv.amount, inv.currency)}</Td>
                  <Td className="text-right tabular-nums text-zinc-400">{money(paid, inv.currency)}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </div>
  )
}
