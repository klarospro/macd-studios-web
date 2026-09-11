import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, money } from '@/components/admin/ui'
import DeleteButton from '@/components/admin/DeleteButton'
import AccountForm from '../AccountForm'
import PnlForm from '../PnlForm'
import { updateTradingAccount, deleteTradingAccount } from '../actions'
import type { TradingPnl } from '@/lib/admin/types'

export default async function TradingAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireSession()

  const { data: account } = await supabase.from('trading_accounts').select('*').eq('id', id).single()
  if (!account) notFound()

  const { data: pnl } = await supabase.from('trading_pnl').select('*').eq('account_id', id).order('date', { ascending: false })

  const netTotal = (pnl ?? []).reduce((s, p) => s + p.net_profit, 0)

  return (
    <div className="space-y-8">
      <PageHeader
        title={account.platform}
        subtitle={`${money(account.account_size)} · P&L neto: ${money(netTotal)}`}
        action={
          <DeleteButton
            action={deleteTradingAccount.bind(null, id)}
            redirectTo="/admin/trading"
            confirmMessage="¿Eliminar esta cuenta de trading?"
          />
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Datos de la cuenta</h3>
          <AccountForm account={account} action={updateTradingAccount.bind(null, id)} />
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Registrar P&L / payout</h3>
          <PnlForm accountId={id} />
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Historial de P&L ({pnl?.length ?? 0})</h2>
        {!pnl?.length ? (
          <EmptyState title="Sin registros de P&L todavía" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th className="text-right">Gross</Th>
                <Th className="text-right">Fees</Th>
                <Th className="text-right">Net</Th>
                <Th>Payout</Th>
              </tr>
            </thead>
            <tbody>
              {(pnl as TradingPnl[]).map((p) => (
                <tr key={p.id}>
                  <Td className="text-zinc-500">{p.date}</Td>
                  <Td className="text-right tabular-nums">{money(p.gross_profit)}</Td>
                  <Td className="text-right tabular-nums text-zinc-500">{money(p.fees)}</Td>
                  <Td className={`text-right tabular-nums ${p.net_profit >= 0 ? 'text-emerald-400' : 'text-[#e05555]'}`}>
                    {money(p.net_profit)}
                  </Td>
                  <Td>
                    {p.is_payout && (
                      <Badge tone={p.payout_status === 'received' ? 'positive' : p.payout_status === 'rejected' ? 'negative' : 'muted'}>
                        {p.payout_status}
                      </Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}
