import { requireSession } from '@/lib/admin/dal'
import { buildAnnualReport } from '@/lib/admin/reports'
import { PageHeader, Card, StatCard, Table, Th, Td, EmptyState, money } from '@/components/admin/ui'

export const revalidate = 0

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { supabase } = await requireSession()
  const { year: yearParam } = await searchParams
  const year = Number(yearParam) || new Date().getFullYear()

  const report = await buildAnnualReport(supabase, year)
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reportes fiscales"
        subtitle="Form 5472, P&L anual y balance sheet — MACD Studios LLC"
        action={
          <div className="flex gap-2">
            <a
              href={`/admin/reports/pdf?year=${year}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white border border-[#222] hover:bg-white/10 transition-colors"
            >
              Exportar PDF
            </a>
            <a
              href={`/admin/reports/excel?year=${year}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white border border-[#222] hover:bg-white/10 transition-colors"
            >
              Exportar Excel
            </a>
          </div>
        }
      />

      <div className="flex gap-2">
        {years.map((y) => (
          <a
            key={y}
            href={`/admin/reports?year=${y}`}
            className={`text-sm px-3 py-1.5 rounded-lg ${y === year ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'bg-white/5 text-zinc-400'}`}
          >
            {y}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ingresos" value={money(report.totalIncome)} tone="positive" />
        <StatCard label="Gastos" value={money(report.totalExpense)} tone="negative" />
        <StatCard label="Beneficio neto" value={money(report.netProfit)} tone="gold" />
        <StatCard label="Related party total" value={money(report.relatedParty.grandTotal)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">P&L — Ingresos por categoría</h2>
          {Object.entries(report.incomeByCategory).length === 0 ? (
            <EmptyState title="Sin ingresos este año" />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {Object.entries(report.incomeByCategory).map(([cat, total]) => (
                <li key={cat} className="flex justify-between border-b border-[#1a1a1a] pb-1.5">
                  <span className="text-zinc-400">{cat}</span>
                  <span className="tabular-nums text-emerald-400">{money(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">P&L — Gastos por categoría</h2>
          {Object.entries(report.expenseByCategory).length === 0 ? (
            <EmptyState title="Sin gastos este año" />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {Object.entries(report.expenseByCategory).map(([cat, total]) => (
                <li key={cat} className="flex justify-between border-b border-[#1a1a1a] pb-1.5">
                  <span className="text-zinc-400">{cat}</span>
                  <span className="tabular-nums text-[#e05555]">{money(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Balance sheet</h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-xs uppercase text-zinc-600 mb-2">Activos</div>
            <div className="flex justify-between py-1 border-b border-[#1a1a1a]">
              <span className="text-zinc-400">Balance Mercury</span>
              <span className="tabular-nums">{report.balanceSheet.mercuryBalance != null ? money(report.balanceSheet.mercuryBalance) : '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#1a1a1a]">
              <span className="text-zinc-400">Cuentas por cobrar</span>
              <span className="tabular-nums">{money(report.balanceSheet.accountsReceivable)}</span>
            </div>
            <div className="flex justify-between py-1.5 font-semibold text-[#D4AF37]">
              <span>Total</span>
              <span className="tabular-nums">{money(report.balanceSheet.assets)}</span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-600 mb-2">Pasivos</div>
            <div className="flex justify-between py-1 border-b border-[#1a1a1a]">
              <span className="text-zinc-400">Préstamos pendientes</span>
              <span className="tabular-nums">{money(report.balanceSheet.outstandingLoans)}</span>
            </div>
            <div className="flex justify-between py-1.5 font-semibold text-[#D4AF37]">
              <span>Total</span>
              <span className="tabular-nums">{money(report.balanceSheet.liabilities)}</span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-600 mb-2">Equity</div>
            <div className="flex justify-between py-1 border-b border-[#1a1a1a]">
              <span className="text-zinc-400">Capital contribuido</span>
              <span className="tabular-nums">{money(report.balanceSheet.totalCapitalContributions)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#1a1a1a]">
              <span className="text-zinc-400">Distribuciones</span>
              <span className="tabular-nums">-{money(report.balanceSheet.totalDistributions)}</span>
            </div>
            <div className="flex justify-between py-1.5 font-semibold text-[#D4AF37]">
              <span>Total</span>
              <span className="tabular-nums">{money(report.balanceSheet.equity)}</span>
            </div>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">
          Form 5472 — Related party transactions ({report.relatedParty.byParty.length})
        </h2>
        {!report.relatedParty.byParty.length ? (
          <EmptyState title="Sin transacciones con related parties este año" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Related party</Th>
                <Th>Nº transacciones</Th>
                <Th className="text-right">Total USD</Th>
              </tr>
            </thead>
            <tbody>
              {report.relatedParty.byParty.map((entry) => (
                <tr key={entry.name}>
                  <Td className="text-white">{entry.name}</Td>
                  <Td className="text-zinc-400">{entry.transactions.length}</Td>
                  <Td className="text-right tabular-nums">{money(entry.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}
