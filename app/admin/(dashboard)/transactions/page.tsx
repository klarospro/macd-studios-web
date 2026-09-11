import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Table, Th, Td, EmptyState, Badge, Select, Input, money } from '@/components/admin/ui'
import DeleteButton from '@/components/admin/DeleteButton'
import SyncButton from './SyncButton'
import NewTransactionPanel from './NewTransactionPanel'
import ReceiptUpload from './ReceiptUpload'
import { deleteTransaction } from './actions'
import { CATEGORY_GROUPS } from '@/lib/admin/types'
import type { Transaction } from '@/lib/admin/types'

export const revalidate = 0

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; type?: string; related?: string; from?: string; to?: string }>
}) {
  const { supabase } = await requireSession()
  const params = await searchParams

  let query = supabase.from('transactions').select('*').order('date', { ascending: false }).limit(200)
  if (params.category) query = query.eq('category', params.category)
  if (params.type) query = query.eq('type', params.type)
  if (params.related === 'yes') query = query.eq('is_related_party', true)
  if (params.from) query = query.gte('date', params.from)
  if (params.to) query = query.lte('date', params.to)

  const { data: transactions } = await query

  return (
    <div>
      <PageHeader title="Transacciones" subtitle={`${transactions?.length ?? 0} registro(s)`} action={<SyncButton />} />

      <div className="mb-6">
        <NewTransactionPanel />
      </div>

      <form className="flex flex-wrap gap-3 mb-4">
        <Select name="category" defaultValue={params.category ?? ''} className="max-w-[220px]">
          <option value="">Todas las categorías</option>
          {CATEGORY_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <Select name="type" defaultValue={params.type ?? ''} className="max-w-[140px]">
          <option value="">Todos los tipos</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </Select>
        <Select name="related" defaultValue={params.related ?? ''} className="max-w-[180px]">
          <option value="">Related party: todos</option>
          <option value="yes">Solo related party</option>
        </Select>
        <Input type="date" name="from" defaultValue={params.from} className="max-w-[160px]" />
        <Input type="date" name="to" defaultValue={params.to} className="max-w-[160px]" />
        <button type="submit" className="text-sm text-[#D4AF37] hover:underline">
          Filtrar
        </button>
      </form>

      {!transactions?.length ? (
        <EmptyState title="Sin transacciones todavía" hint="Regístralas manualmente o sincroniza desde Mercury." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Categoría</Th>
              <Th>Descripción</Th>
              <Th>Related party</Th>
              <Th className="text-right">USD</Th>
              <Th>Recibo</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {(transactions as Transaction[]).map((tx) => (
              <tr key={tx.id} className="hover:bg-white/[0.02]">
                <Td className="text-zinc-500 whitespace-nowrap">{tx.date}</Td>
                <Td>
                  <Badge tone={tx.type === 'income' ? 'positive' : 'negative'}>{tx.category}</Badge>
                  {tx.mercury_synced && (
                    <span className="ml-1">
                      <Badge tone="muted">mercury</Badge>
                    </span>
                  )}
                </Td>
                <Td className="text-white">{tx.description}</Td>
                <Td className="text-zinc-400">{tx.is_related_party ? tx.related_party_name || 'Sí' : '—'}</Td>
                <Td className={`text-right tabular-nums ${tx.type === 'income' ? 'text-emerald-400' : 'text-[#e05555]'}`}>
                  {tx.type === 'income' ? '+' : '-'}
                  {money(tx.usd_amount)}
                </Td>
                <Td>
                  <ReceiptUpload transactionId={tx.id} hasReceipt={!!tx.receipt_url} />
                </Td>
                <Td>
                  <DeleteButton action={deleteTransaction.bind(null, tx.id)} label="×" confirmMessage="¿Eliminar esta transacción?" />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
