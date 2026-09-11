import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/admin/dal'
import { getSignedDocumentUrl } from '@/lib/admin/storage'
import { PageHeader, Card, StatCard, Table, Th, Td, EmptyState, money } from '@/components/admin/ui'
import DeleteButton from '@/components/admin/DeleteButton'
import InvestmentForm from '../InvestmentForm'
import DistributionForm from '../DistributionForm'
import { updateInvestment, deleteInvestment } from '../actions'
import type { Distribution } from '@/lib/admin/types'

export default async function InvestmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireSession()

  const { data: investment } = await supabase.from('investments').select('*').eq('id', id).single()
  if (!investment) notFound()

  const { data: distributions } = await supabase
    .from('distributions')
    .select('*')
    .eq('investment_id', id)
    .order('date', { ascending: false })

  const totalPaid = (distributions ?? []).reduce((s, d) => s + d.amount, 0)
  const balance = investment.amount - totalPaid

  const contractUrl = investment.contract_url ? await getSignedDocumentUrl(supabase, investment.contract_url) : null

  return (
    <div className="space-y-8">
      <PageHeader
        title={investment.investor_name}
        subtitle={`${investment.type === 'loan' ? 'Préstamo' : 'Capital'} · ${investment.relationship}`}
        action={
          <DeleteButton
            action={deleteInvestment.bind(null, id)}
            redirectTo="/admin/investments"
            confirmMessage={`¿Eliminar la inversión de ${investment.investor_name}?`}
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Monto original" value={money(investment.amount, investment.currency)} tone="gold" />
        <StatCard label="Repagado" value={money(totalPaid, investment.currency)} tone="positive" />
        <StatCard label="Saldo pendiente" value={money(balance, investment.currency)} />
      </div>

      {contractUrl && (
        <a href={contractUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#D4AF37] hover:underline">
          Ver contrato PDF
        </a>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Datos de la inversión</h3>
          <InvestmentForm investment={investment} action={updateInvestment.bind(null, id)} />
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Registrar pago / repago</h3>
          <DistributionForm investmentId={id} />
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Historial de pagos ({distributions?.length ?? 0})</h2>
        {!distributions?.length ? (
          <EmptyState title="Sin pagos registrados todavía" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Concepto</Th>
                <Th className="text-right">Monto</Th>
              </tr>
            </thead>
            <tbody>
              {(distributions as Distribution[]).map((d) => (
                <tr key={d.id}>
                  <Td className="text-zinc-500">{d.date}</Td>
                  <Td className="text-white">{d.concept || '—'}</Td>
                  <Td className="text-right tabular-nums">{money(d.amount, d.currency)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}
