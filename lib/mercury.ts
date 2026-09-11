import 'server-only'

const MERCURY_BASE_URL = 'https://backend.mercury.co/api/v1'

export interface MercuryAccount {
  id: string
  name: string
  availableBalance: number
  currentBalance: number
  type: string
}

export interface MercuryTransaction {
  id: string
  amount: number
  createdAt: string
  postedAt: string | null
  status: string
  counterpartyName: string | null
  bankDescription: string | null
  note: string | null
}

function requireToken(): string {
  const token = process.env.MERCURY_API_TOKEN
  if (!token) {
    throw new Error('MERCURY_API_TOKEN no está configurado en .env.local')
  }
  return token
}

async function mercuryFetch<T>(path: string): Promise<T> {
  const token = requireToken()
  const res = await fetch(`${MERCURY_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Mercury API error ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<T>
}

export async function getMercuryAccounts(): Promise<MercuryAccount[]> {
  const data = await mercuryFetch<{ accounts: MercuryAccount[] }>('/accounts')
  return data.accounts
}

/** Suma el balance disponible de todas las cuentas Mercury. */
export async function getMercuryBalance(): Promise<{ total: number; accounts: MercuryAccount[] }> {
  const accounts = await getMercuryAccounts()
  const total = accounts.reduce((sum, a) => sum + (a.availableBalance ?? 0), 0)
  return { total, accounts }
}

export async function getMercuryTransactions(accountId: string, limit = 50): Promise<MercuryTransaction[]> {
  const data = await mercuryFetch<{ transactions: MercuryTransaction[] }>(
    `/accounts/${accountId}/transactions?limit=${limit}`
  )
  return data.transactions
}

/** Sugerencia de categoría basada en palabras clave de la descripción bancaria. */
export function suggestCategory(description: string): { type: 'income' | 'expense'; category: string } | null {
  const d = description.toLowerCase()
  const rules: Array<{ match: RegExp; type: 'income' | 'expense'; category: string }> = [
    { match: /stripe/, type: 'income', category: 'Client Payment' },
    { match: /vercel/, type: 'expense', category: 'Server/Hosting Cost' },
    { match: /supabase/, type: 'expense', category: 'Server/Hosting Cost' },
    { match: /openai|anthropic/, type: 'expense', category: 'Software/Tools' },
    { match: /apex|ftmo|topstep|myfundedfx|lucid/, type: 'expense', category: 'Prop Firm Evaluation' },
    { match: /wyoming|registered agent/, type: 'expense', category: 'Registered Agent' },
    { match: /monthly fee|maintenance fee/, type: 'expense', category: 'Bank Fee' },
  ]

  for (const rule of rules) {
    if (rule.match.test(d)) return { type: rule.type, category: rule.category }
  }
  return null
}
