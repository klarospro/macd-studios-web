import 'server-only'
import { supabase as serviceDb } from '@/lib/supabase'

// Precios de Anthropic en USD por millón de tokens (platform.claude.com/docs/en/about-claude/pricing).
// Lectura de caché = 0,1× entrada; escritura de caché (5 min) = 1,25× entrada. Búsqueda web: $10 / 1.000.
const ANTHROPIC_PRICES: Record<string, { input: number; output: number }> = {
  'claude-fable-5-1': { input: 10, output: 50 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}
const WEB_SEARCH_USD = 10 / 1000

export type AnthropicUsage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  server_tool_use?: { web_search_requests?: number }
}

export function anthropicCost(model: string, u: AnthropicUsage) {
  const p = ANTHROPIC_PRICES[model] ?? ANTHROPIC_PRICES['claude-sonnet-5']
  const m = 1_000_000
  return (
    ((u.input_tokens ?? 0) * p.input) / m +
    ((u.output_tokens ?? 0) * p.output) / m +
    ((u.cache_read_input_tokens ?? 0) * p.input * 0.1) / m +
    ((u.cache_creation_input_tokens ?? 0) * p.input * 1.25) / m +
    (u.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD
  )
}

export type UsageRow = {
  provider: string
  app: string
  feature?: string | null
  model?: string | null
  input_tokens?: number
  output_tokens?: number
  cache_read_tokens?: number
  cache_write_tokens?: number
  web_searches?: number
  cost_usd: number
  meta?: Record<string, unknown> | null
}

// Registrar nunca debe romper la función que gasta: si falla, solo se avisa en el log.
export async function recordUsage(row: UsageRow) {
  try {
    const { error } = await serviceDb.from('ai_usage').insert(row)
    if (error) console.error('[ai_usage]', error.message)
  } catch (e) {
    console.error('[ai_usage]', e)
  }
}

export async function recordAnthropic(model: string, usage: AnthropicUsage | undefined, feature: string, app = 'panel') {
  if (!usage) return
  await recordUsage({
    provider: 'anthropic',
    app,
    feature,
    model,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_read_tokens: usage.cache_read_input_tokens ?? 0,
    cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
    web_searches: usage.server_tool_use?.web_search_requests ?? 0,
    cost_usd: Number(anthropicCost(model, usage).toFixed(6)),
  })
}

// Factura oficial de Anthropic (Cost API, solo cuentas de organización con Admin key).
// Devuelve null si no hay clave o si la cuenta no tiene acceso.
export async function anthropicOfficialCost(days = 30) {
  const key = process.env.ANTHROPIC_ADMIN_KEY
  if (!key) return null
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400_000)
  const byModel: Record<string, number> = {}
  const byDay: Record<string, number> = {}
  const byWorkspace: Record<string, number> = {}
  let total = 0
  let page: string | undefined
  try {
    for (let i = 0; i < 10; i++) {
      const u = new URL('https://api.anthropic.com/v1/organizations/cost_report')
      u.searchParams.set('starting_at', start.toISOString().slice(0, 10) + 'T00:00:00Z')
      u.searchParams.set('ending_at', end.toISOString())
      u.searchParams.append('group_by[]', 'workspace_id')
      u.searchParams.append('group_by[]', 'description')
      u.searchParams.set('limit', '31')
      if (page) u.searchParams.set('page', page)
      const res = await fetch(u, {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        next: { revalidate: 600 },
      })
      if (!res.ok) return { error: `Anthropic Cost API ${res.status}` as const }
      const body = await res.json()
      for (const bucket of body.data ?? []) {
        const day = String(bucket.starting_at).slice(0, 10)
        for (const r of bucket.results ?? []) {
          // amount viene en centavos como texto decimal
          const usd = Number(r.amount ?? 0) / 100
          total += usd
          byDay[day] = (byDay[day] ?? 0) + usd
          const k = r.model ?? r.description ?? 'otro'
          byModel[k] = (byModel[k] ?? 0) + usd
          const ws = r.workspace_id ?? 'default'
          byWorkspace[ws] = (byWorkspace[ws] ?? 0) + usd
        }
      }
      if (!body.has_more) break
      page = body.next_page
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error con la Cost API' }
  }
  // Nombres de los workspaces (un workspace por proyecto: MACD, ATLAS, group365…).
  const names: Record<string, string> = { default: 'Default' }
  try {
    const res = await fetch('https://api.anthropic.com/v1/organizations/workspaces?limit=100', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      next: { revalidate: 3600 },
    })
    if (res.ok) for (const w of (await res.json()).data ?? []) names[w.id] = w.name
  } catch {
    // sin nombres: se muestran los IDs
  }
  const workspaces = Object.fromEntries(Object.entries(byWorkspace).map(([id, v]) => [names[id] ?? id, v]))
  return { total, byModel, byDay, workspaces }
}
