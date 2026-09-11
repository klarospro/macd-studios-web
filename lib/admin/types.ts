export interface Client {
  id: string
  name: string
  company: string | null
  tax_id: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  zip_code: string | null
  email: string | null
  phone: string | null
  preferred_currency: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type PaymentMethod = 'Wire Transfer' | 'Stripe' | 'PayPal' | 'Crypto' | 'Cash'

export interface Invoice {
  id: string
  client_id: string | null
  invoice_number: string
  issue_date: string
  due_date: string
  currency: string
  exchange_rate: number
  subtotal: number
  tax_total: number
  total: number
  status: InvoiceStatus
  payment_method: string | null
  stripe_payment_link: string | null
  stripe_payment_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  clients?: Pick<Client, 'id' | 'name' | 'company' | 'email'> | null
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
  sort_order: number
}

export type TransactionType = 'income' | 'expense'

export const REVENUE_CATEGORIES = ['Client Payment', 'Trading Profit', 'Consulting Fee', 'Hosting/Server Fee'] as const
export const EXPENSE_CATEGORIES = [
  'Software/Tools',
  'Server/Hosting Cost',
  'Prop Firm Evaluation',
  'Trading Fee',
  'Marketing',
  'Legal/Accounting',
  'Registered Agent',
  'Bank Fee',
  'Travel',
  'Education',
  'Equipment',
  'Other',
] as const
export const CAPITAL_CATEGORIES = ['Owner Investment', 'Third-Party Investment'] as const
export const DISTRIBUTION_CATEGORIES = ['Owner Draw', 'Investor Payout'] as const
export const LOAN_RECEIVED_CATEGORIES = ['Family Loan', 'Business Loan', 'Investor Loan'] as const
export const LOAN_REPAYMENT_CATEGORIES = ['Principal Repayment', 'Interest Payment'] as const

export const ALL_CATEGORIES = [
  ...REVENUE_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...CAPITAL_CATEGORIES,
  ...DISTRIBUTION_CATEGORIES,
  ...LOAN_RECEIVED_CATEGORIES,
  ...LOAN_REPAYMENT_CATEGORIES,
] as const

export const CATEGORY_GROUPS: { group: string; type: TransactionType; categories: readonly string[] }[] = [
  { group: 'Revenue', type: 'income', categories: REVENUE_CATEGORIES },
  { group: 'Capital Contribution', type: 'income', categories: CAPITAL_CATEGORIES },
  { group: 'Loan Received', type: 'income', categories: LOAN_RECEIVED_CATEGORIES },
  { group: 'Expense', type: 'expense', categories: EXPENSE_CATEGORIES },
  { group: 'Distribution', type: 'expense', categories: DISTRIBUTION_CATEGORIES },
  { group: 'Loan Repayment', type: 'expense', categories: LOAN_REPAYMENT_CATEGORIES },
]

export function getCategoryType(category: string): TransactionType {
  return CATEGORY_GROUPS.find((g) => (g.categories as readonly string[]).includes(category))?.type ?? 'expense'
}

export interface Transaction {
  id: string
  date: string
  type: TransactionType
  category: string
  subcategory: string | null
  description: string
  amount: number
  currency: string
  usd_amount: number
  exchange_rate: number
  invoice_id: string | null
  trading_account_id: string | null
  investment_id: string | null
  is_related_party: boolean
  related_party_name: string | null
  receipt_url: string | null
  mercury_transaction_id: string | null
  mercury_synced: boolean
  notes: string | null
  created_at: string
}

export type TradingAccountType = 'evaluation' | 'funded' | 'blown'
export type TradingAccountStatus = 'active' | 'passed' | 'failed' | 'payout_pending' | 'closed'

export interface TradingAccount {
  id: string
  platform: string
  account_size: number
  account_type: TradingAccountType
  status: TradingAccountStatus
  purchase_date: string
  purchase_cost: number
  funded_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TradingPnl {
  id: string
  account_id: string
  date: string
  gross_profit: number
  fees: number
  net_profit: number
  is_payout: boolean
  payout_status: 'pending' | 'received' | 'rejected' | null
  notes: string | null
  created_at: string
}

export type InvestmentType = 'capital_contribution' | 'loan'
export type InvestmentRelationship = 'owner' | 'family' | 'external'
export type InvestmentStatus = 'active' | 'fully_repaid' | 'converted_to_equity' | 'defaulted'

export interface Investment {
  id: string
  investor_name: string
  relationship: InvestmentRelationship
  type: InvestmentType
  amount: number
  currency: string
  date: string
  interest_rate: number | null
  repayment_due_date: string | null
  repayment_schedule: string | null
  contract_url: string | null
  status: InvestmentStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Distribution {
  id: string
  investment_id: string
  date: string
  amount: number
  currency: string
  concept: string | null
  receipt_url: string | null
  created_at: string
}
