import Link from 'next/link'
import { requireSession } from '@/lib/admin/dal'
import { getMercuryBalance } from '@/lib/mercury'
import { PageHeader, StatCard, Card, Table, Th, Td, EmptyState, Badge, money } from '@/components/admin/ui'
import IncomeExpenseChart, { type MonthPoint } from './IncomeExpenseChart'
import type { Transaction, Invoice } from '@/lib/admin/types'

export const revalidate = 0

function monthRange(offset: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

async function getMercuryBalanceSafe() {
  try {
    return await getMercuryBalance()
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const { supabase } = await requireSession()

  const thisMonth = monthRange(0)
  const lastMonth = monthRange(1)

  const [mercury, thisMonthTx, lastMonthTx, recentTx, pendingInvoices, sixMonthTx] = await Promise.all([
    getMercuryBalanceSafe(),
    supabase.from('transactions').select('type, usd_amount').gte('date', thisMonth.start).lt('date', thisMonth.end),
    supabase.from('transactions').select('type, usd_amount').gte('date', lastMonth.start).lt('date', lastMonth.end),
    supabase.from('transactions').select('*').order('date', { ascending: false }).limit(10),
    supabase.from('invoices').select('*, clients(name)').in('status', ['sent', 'overdue']).order('due_date'),
    supabase
      .from('transactions')
      .select('date, type, usd_amount')
      .gte('date', monthRange(5).start)
      .order('date'),
  ])

  const sum = (rows: { type: string; usd_amount: number }[] | null | undefined, type: string) =>
    (rows ?? []).filter((r) => r.type === type).reduce((s, r) => s + r.usd_amount, 0)

  const incomeThisMonth = sum(thisMonthTx.data, 'income')
  const expenseThisMonth = sum(thisMonthTx.data, 'expense')
  const incomeLastMonth = sum(lastMonthTx.data, 'income')
  const expenseLastMonth = sum(lastMonthTx.data, 'expense')

  const chartData: MonthPoint[] = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i
    const range = monthRange(offset)
    const label = new Date(range.start).toLocaleDateString('es-ES', { month: 'short' })
    const rows = (sixMonthTx.data ?? []).filter((r) => r.date >= range.start && r.date < range.end)
    return {
      label,
      income: rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.usd_amount, 0),
      expense: rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.usd_amount, 0),
    }
  })

  const pct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '—'
    const p = ((curr - prev) / prev) * 100
    return `${p >= 0 ? '+' : ''}${p.toFixed(0)}% vs mes anterior`
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" subtitle="MACD Studios LLC" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Balance Mercury"
          value={mercury ? money(mercury.total) : '—'}
          hint={mercury ? `${mercury.accounts.length} cuenta(s)` : 'MERCURY_API_TOKEN no configurado'}
          tone="gold"
        />
        <StatCard label="Ingresos del mes" value={money(incomeThisMonth)} hint={pct(incomeThisMonth, incomeLastMonth)} tone="positive" />
        <StatCard label="Gastos del mes" value={money(expenseThisMonth)} hint={pct(expenseThisMonth, expenseLastMonth)} tone="negative" />
        <StatCard
          label="Facturas pendientes"
          value={pendingInvoices.data?.length ?? 0}
          hint={
            pendingInvoices.data?.length
              ? money(pendingInvoices.data.reduce((s, i) => s + i.total, 0))
              : undefined
          }
        />
      </div>

      <Card>
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Ingresos vs gastos — últimos 6 meses (USD)</h2>
        <IncomeExpenseChart data={chartData} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Últimas transacciones</h2>
          {!recentTx.data?.length ? (
            <EmptyState title="Sin transacciones todavía" hint="Se registran en el módulo de Transacciones." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Descripción</Th>
                  <Th className="text-right">USD</Th>
                </tr>
              </thead>
              <tbody>
                {(recentTx.data as Transaction[]).map((tx) => (
                  <tr key={tx.id}>
                    <Td className="text-zinc-500">{tx.date}</Td>
                    <Td className="text-white">{tx.description}</Td>
                    <Td className={`text-right tabular-nums ${tx.type === 'income' ? 'text-emerald-400' : 'text-[#e05555]'}`}>
                      {tx.type === 'income' ? '+' : '-'}
                      {money(tx.usd_amount)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Facturas pendientes de cobro</h2>
          {!pendingInvoices.data?.length ? (
            <EmptyState title="Nada pendiente" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Factura</Th>
                  <Th>Cliente</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {(pendingInvoices.data as Invoice[]).map((inv) => (
                  <tr key={inv.id}>
                    <Td>
                      <Link href={`/admin/invoices/${inv.id}`} className="text-white hover:text-[#D4AF37]">
                        {inv.invoice_number}
                      </Link>
                    </Td>
                    <Td className="text-zinc-400">{inv.clients?.name ?? '—'}</Td>
                    <Td className="text-right tabular-nums">
                      {money(inv.total, inv.currency)}
                      {inv.status === 'overdue' && (
                        <Badge tone="negative">overdue</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
