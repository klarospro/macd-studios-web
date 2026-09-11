import type { Transaction } from './types'

export interface RelatedPartySummary {
  categoryTotals: Record<string, number>
  byParty: { name: string; total: number; transactions: Transaction[] }[]
  grandTotal: number
}

const REPORTABLE_CATEGORIES = [
  'Owner Investment',
  'Third-Party Investment',
  'Owner Draw',
  'Investor Payout',
  'Family Loan',
  'Business Loan',
  'Investor Loan',
  'Principal Repayment',
  'Interest Payment',
  'Client Payment',
  'Consulting Fee',
]

/** Agrupa las transacciones related-party del año por categoría y por related party, en USD. */
export function summarizeRelatedPartyTransactions(transactions: Transaction[]): RelatedPartySummary {
  const relevant = transactions.filter((t) => t.is_related_party)

  const categoryTotals: Record<string, number> = {}
  for (const cat of REPORTABLE_CATEGORIES) categoryTotals[cat] = 0
  for (const tx of relevant) {
    categoryTotals[tx.category] = (categoryTotals[tx.category] ?? 0) + tx.usd_amount
  }

  const partyMap = new Map<string, { name: string; total: number; transactions: Transaction[] }>()
  for (const tx of relevant) {
    const name = tx.related_party_name || 'Sin nombre'
    if (!partyMap.has(name)) partyMap.set(name, { name, total: 0, transactions: [] })
    const entry = partyMap.get(name)!
    entry.total += tx.usd_amount
    entry.transactions.push(tx)
  }

  return {
    categoryTotals,
    byParty: [...partyMap.values()].sort((a, b) => b.total - a.total),
    grandTotal: relevant.reduce((s, t) => s + t.usd_amount, 0),
  }
}
