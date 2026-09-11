import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Transaction } from './types'
import { summarizeRelatedPartyTransactions } from './related-party'
import { getMercuryBalance } from '@/lib/mercury'

export async function buildAnnualReport(supabase: SupabaseClient, year: number) {
  const from = `${year}-01-01`
  const to = `${year + 1}-01-01`

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', from)
    .lt('date', to)
    .order('date')

  const txs = (transactions ?? []) as Transaction[]

  const incomeByCategory: Record<string, number> = {}
  const expenseByCategory: Record<string, number> = {}
  let totalIncome = 0
  let totalExpense = 0

  for (const tx of txs) {
    if (tx.type === 'income') {
      incomeByCategory[tx.category] = (incomeByCategory[tx.category] ?? 0) + tx.usd_amount
      totalIncome += tx.usd_amount
    } else {
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] ?? 0) + tx.usd_amount
      totalExpense += tx.usd_amount
    }
  }

  const netProfit = totalIncome - totalExpense
  const relatedParty = summarizeRelatedPartyTransactions(txs)

  const [{ data: pendingInvoices }, { data: activeLoans }, { data: distributions }] = await Promise.all([
    supabase.from('invoices').select('total, currency, exchange_rate').in('status', ['sent', 'overdue']),
    supabase.from('investments').select('*').eq('type', 'loan').eq('status', 'active'),
    supabase.from('distributions').select('investment_id, amount'),
  ])

  const accountsReceivable = (pendingInvoices ?? []).reduce(
    (s, inv) => s + inv.total * (inv.currency === 'EUR' ? inv.exchange_rate : 1),
    0
  )

  const paidByInvestment = new Map<string, number>()
  for (const d of distributions ?? []) {
    paidByInvestment.set(d.investment_id, (paidByInvestment.get(d.investment_id) ?? 0) + d.amount)
  }
  const outstandingLoans = (activeLoans ?? []).reduce((s, inv) => {
    const paid = paidByInvestment.get(inv.id) ?? 0
    return s + Math.max(0, inv.amount - paid)
  }, 0)

  const { data: allInvestments } = await supabase.from('investments').select('*')
  const totalCapitalContributions = (allInvestments ?? [])
    .filter((i) => i.type === 'capital_contribution')
    .reduce((s, i) => s + i.amount, 0)
  const totalDistributions = txs
    .filter((t) => t.category === 'Owner Draw' || t.category === 'Investor Payout')
    .reduce((s, t) => s + t.usd_amount, 0)

  let mercuryBalance: number | null = null
  try {
    mercuryBalance = (await getMercuryBalance()).total
  } catch {
    mercuryBalance = null
  }

  const assets = (mercuryBalance ?? 0) + accountsReceivable
  const liabilities = outstandingLoans
  const equity = totalCapitalContributions - totalDistributions + netProfit

  return {
    year,
    transactions: txs,
    incomeByCategory,
    expenseByCategory,
    totalIncome,
    totalExpense,
    netProfit,
    relatedParty,
    balanceSheet: {
      mercuryBalance,
      accountsReceivable,
      assets,
      outstandingLoans,
      liabilities,
      totalCapitalContributions,
      totalDistributions,
      equity,
    },
  }
}

export type AnnualReport = Awaited<ReturnType<typeof buildAnnualReport>>
