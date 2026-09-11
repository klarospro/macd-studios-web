import Link from 'next/link'
import { requireSession } from '@/lib/admin/dal'
import { PageHeader, LinkButton, StatCard, Table, Th, Td, EmptyState, Badge, money } from '@/components/admin/ui'
import type { TradingAccount } from '@/lib/admin/types'

export const revalidate = 0

export default async function TradingPage() {
  const { supabase } = await requireSession()

  const [{ data: accounts }, { data: pnl }] = await Promise.all([
    supabase.from('trading_accounts').select('*').order('purchase_date', { ascending: false }),
    supabase.from('trading_pnl').select('account_id, net_profit'),
  ])

  const netByAccount = new Map<string, number>()
  for (const row of pnl ?? []) {
    netByAccount.set(row.account_id, (netByAccount.get(row.account_id) ?? 0) + row.net_profit)
  }

  const totalNet = [...netByAccount.values()].reduce((s, v) => s + v, 0)
  const totalEvalCost = (accounts ?? []).reduce((s, a) => s + a.purchase_cost, 0)
  const roi = totalEvalCost > 0 ? (totalNet / totalEvalCost) * 100 : 0

  const counts = {
    active: (accounts ?? []).filter((a) => a.status === 'active').length,
    funded: (accounts ?? []).filter((a) => a.account_type === 'funded').length,
    blown: (accounts ?? []).filter((a) => a.account_type === 'blown').length,
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Trading" subtitle="Cuentas de fondeo" action={<LinkButton href="/admin/trading/new">+ Nueva cuenta</LinkButton>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="P&L global" value={money(totalNet)} tone={totalNet >= 0 ? 'positive' : 'negative'} />
        <StatCard label="ROI" value={`${roi.toFixed(0)}%`} hint={`vs ${money(totalEvalCost)} en evaluaciones`} tone="gold" />
        <StatCard label="Cuentas activas" value={counts.active} />
        <StatCard label="Funded / Blown" value={`${counts.funded} / ${counts.blown}`} />
      </div>

      {!accounts?.length ? (
        <EmptyState title="Sin cuentas de trading todavía" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Plataforma</Th>
              <Th>Tamaño</Th>
              <Th>Tipo</Th>
              <Th>Estado</Th>
              <Th className="text-right">P&L neto</Th>
            </tr>
          </thead>
          <tbody>
            {(accounts as TradingAccount[]).map((a) => {
              const net = netByAccount.get(a.id) ?? 0
              return (
                <tr key={a.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <Link href={`/admin/trading/${a.id}`} className="text-white hover:text-[#D4AF37] font-medium">
                      {a.platform}
                    </Link>
                  </Td>
                  <Td className="text-zinc-400">{money(a.account_size)}</Td>
                  <Td>
                    <Badge tone="muted">{a.account_type}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={a.status === 'active' || a.status === 'passed' ? 'positive' : a.status === 'failed' ? 'negative' : 'default'}>
                      {a.status}
                    </Badge>
                  </Td>
                  <Td className={`text-right tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-[#e05555]'}`}>{money(net)}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </div>
  )
}
