import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card, StatCard, Table, Th, Td, EmptyState, Badge, Input, Button } from '@/components/admin/ui'
import { anthropicOfficialCost } from '@/lib/admin/usage'
import { saveBudget } from './actions'

export const revalidate = 0

type Row = {
  created_at: string
  provider: string
  app: string
  feature: string | null
  model: string | null
  input_tokens: number
  output_tokens: number
  web_searches: number
  cost_usd: number
}

const usd = (n: number) => `$${n < 1 && n > 0 ? n.toFixed(3) : n.toFixed(2)}`
const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

function group<K extends string>(rows: Row[], key: (r: Row) => K) {
  const m = new Map<K, { calls: number; cost: number; inT: number; outT: number }>()
  for (const r of rows) {
    const k = key(r)
    const g = m.get(k) ?? { calls: 0, cost: 0, inT: 0, outT: 0 }
    g.calls++
    g.cost += Number(r.cost_usd)
    g.inT += r.input_tokens ?? 0
    g.outT += r.output_tokens ?? 0
    m.set(k, g)
  }
  return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost)
}

export default async function ConsumoPage() {
  const { supabase } = await requireSession()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const since30 = new Date(now)
  since30.setDate(since30.getDate() - 29)
  const from = monthStart < since30 ? monthStart : since30

  const [{ data }, { data: budgets }, official] = await Promise.all([
    supabase
      .from('ai_usage')
      .select('created_at, provider, app, feature, model, input_tokens, output_tokens, web_searches, cost_usd')
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('ai_budgets').select('provider, monthly_usd').order('provider'),
    anthropicOfficialCost(30),
  ])

  const rows = (data ?? []) as Row[]
  const month = rows.filter((r) => new Date(r.created_at) >= monthStart)
  const monthTotal = month.reduce((s, r) => s + Number(r.cost_usd), 0)
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const projection = dayOfMonth ? (monthTotal / dayOfMonth) * daysInMonth : 0
  const byProvider = group(month, (r) => r.provider)
  const byFeature = group(month, (r) => `${r.app} · ${r.feature ?? '—'}` as string)
  const byModel = group(month.filter((r) => r.model), (r) => r.model as string)
  const totalBudget = (budgets ?? []).reduce((s, b) => s + Number(b.monthly_usd), 0)

  // Barras de los últimos 30 días (SVG en servidor).
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(since30)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
  const perDay = days.map((d) => rows.filter((r) => r.created_at.slice(0, 10) === d).reduce((s, r) => s + Number(r.cost_usd), 0))
  const maxDay = Math.max(...perDay, 0.01)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Consumo de IA"
        subtitle="Lo que gastan en APIs el panel, Viernes, el renderer y cualquier app nueva que conectes."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gasto este mes" value={usd(monthTotal)} hint={`${month.length} llamadas`} tone="gold" />
        <StatCard
          label="Proyección fin de mes"
          value={usd(projection)}
          hint={totalBudget ? `presupuesto total ${usd(totalBudget)}` : 'sin presupuesto'}
          tone={totalBudget && projection > totalBudget ? 'negative' : 'positive'}
        />
        <StatCard label="Anthropic (mes)" value={usd(byProvider.find(([p]) => p === 'anthropic')?.[1].cost ?? 0)} />
        <StatCard
          label="Otras APIs (mes)"
          value={usd(byProvider.filter(([p]) => p !== 'anthropic').reduce((s, [, g]) => s + g.cost, 0))}
          hint={byProvider.filter(([p]) => p !== 'anthropic').map(([p]) => p).join(', ') || '—'}
        />
      </div>

      <Card>
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Gasto diario · últimos 30 días</h2>
        <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="w-full h-32">
          {perDay.map((v, i) => (
            <rect key={i} x={i * 10 + 1} width={8} y={80 - (v / maxDay) * 76} height={(v / maxDay) * 76} fill="#D4AF37" opacity={v ? 0.9 : 0.15}>
              <title>{`${days[i]}: ${usd(v)}`}</title>
            </rect>
          ))}
        </svg>
        <div className="flex justify-between text-[11px] text-zinc-600 mt-1">
          <span>{days[0]}</span>
          <span>máx {usd(maxDay)}/día</span>
          <span>{days[29]}</span>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-white font-medium mb-4">Presupuesto mensual por proveedor</h2>
          <div className="space-y-4">
            {(budgets ?? []).map((b) => {
              const spent = byProvider.find(([p]) => p === b.provider)?.[1].cost ?? 0
              const pct = Number(b.monthly_usd) ? Math.min(100, (spent / Number(b.monthly_usd)) * 100) : 0
              return (
                <div key={b.provider}>
                  <div className="flex justify-between text-sm">
                    <span className="text-white capitalize">{b.provider}</span>
                    <span className="text-zinc-400 tabular-nums">
                      {usd(spent)} / {usd(Number(b.monthly_usd))}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 90 ? 'bg-[#e05555]' : pct >= 70 ? 'bg-amber-400' : 'bg-[#D4AF37]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <form action={saveBudget} className="flex gap-2 mt-5">
            <Input name="provider" placeholder="proveedor (anthropic, higgsfield…)" />
            <Input name="monthly_usd" type="number" step="1" min="0" placeholder="$/mes" className="w-28" />
            <Button type="submit" variant="secondary">
              Guardar
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-white font-medium">Factura oficial de Anthropic (30 días)</h2>
          {official === null ? (
            <p className="text-sm text-zinc-500 mt-2">
              Opcional: añade <code className="text-zinc-300">ANTHROPIC_ADMIN_KEY</code> en Vercel (Console → Settings → Admin keys;
              solo cuentas de organización) para ver aquí el total real, incluido lo que no pase por el panel.
            </p>
          ) : 'error' in official ? (
            <p className="text-sm text-[#e05555] mt-2">{official.error}. ¿La cuenta es de organización y la clave es Admin?</p>
          ) : (
            <>
              <div className="text-3xl text-[#D4AF37] font-semibold mt-3 tabular-nums">{usd(official.total)}</div>
              <div className="text-xs uppercase tracking-wide text-zinc-500 mt-4">Por proyecto (workspace)</div>
              <div className="mt-1 space-y-1">
                {Object.entries(official.workspaces)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-white truncate">{k}</span>
                      <span className="text-white tabular-nums">{usd(v)}</span>
                    </div>
                  ))}
              </div>
              <div className="text-xs uppercase tracking-wide text-zinc-500 mt-4">Por modelo</div>
              <div className="mt-3 space-y-1">
                {Object.entries(official.byModel)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-zinc-400 truncate">{k}</span>
                      <span className="text-white tabular-nums">{usd(v)}</span>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-zinc-600 mt-3">
                Registrado por el sistema en 30 días: {usd(rows.reduce((s, r) => s + Number(r.cost_usd), 0))}. La diferencia es
                consumo que no pasa por el registro (consola, otras apps sin conectar).
              </p>
            </>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">¿Qué gasta más? (este mes)</h2>
          {!byFeature.length ? (
            <EmptyState title="Sin consumo registrado todavía" hint="Aparece en cuanto un agente o app haga su primera llamada." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>App · función</Th>
                  <Th className="text-right">Llamadas</Th>
                  <Th className="text-right">Tokens</Th>
                  <Th className="text-right">USD</Th>
                </tr>
              </thead>
              <tbody>
                {byFeature.map(([k, g]) => (
                  <tr key={k}>
                    <Td className="text-white">{k}</Td>
                    <Td className="text-right tabular-nums">{g.calls}</Td>
                    <Td className="text-right tabular-nums text-zinc-400">
                      {tokens(g.inT)} / {tokens(g.outT)}
                    </Td>
                    <Td className="text-right tabular-nums">{usd(g.cost)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Por modelo (este mes)</h2>
          {!byModel.length ? (
            <EmptyState title="—" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Modelo</Th>
                  <Th className="text-right">Llamadas</Th>
                  <Th className="text-right">USD</Th>
                </tr>
              </thead>
              <tbody>
                {byModel.map(([k, g]) => (
                  <tr key={k}>
                    <Td className="text-white">{k}</Td>
                    <Td className="text-right tabular-nums">{g.calls}</Td>
                    <Td className="text-right tabular-nums">{usd(g.cost)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Últimas llamadas</h2>
        {!rows.length ? (
          <EmptyState title="Nada todavía" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cuándo</Th>
                <Th>Proveedor</Th>
                <Th>App · función</Th>
                <Th>Modelo</Th>
                <Th className="text-right">Tokens (in/out)</Th>
                <Th className="text-right">USD</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((r, i) => (
                <tr key={i}>
                  <Td className="text-zinc-500 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}
                  </Td>
                  <Td>
                    <Badge tone={r.provider === 'anthropic' ? 'gold' : 'default'}>{r.provider}</Badge>
                  </Td>
                  <Td className="text-white">
                    {r.app} · {r.feature ?? '—'}
                    {r.web_searches ? <span className="text-xs text-zinc-500"> · {r.web_searches} búsquedas</span> : null}
                  </Td>
                  <Td className="text-zinc-400">{r.model ?? '—'}</Td>
                  <Td className="text-right tabular-nums text-zinc-400">
                    {tokens(r.input_tokens ?? 0)} / {tokens(r.output_tokens ?? 0)}
                  </Td>
                  <Td className="text-right tabular-nums">{usd(Number(r.cost_usd))}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Card>
        <h2 className="text-white font-medium">Conectar una app nueva</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Cualquier app puede reportar su gasto con una llamada. La clave <code className="text-zinc-300">USAGE_INGEST_SECRET</code>{' '}
          va en Vercel y en la app (nunca en el código).
        </p>
        <pre className="text-xs text-zinc-300 bg-[#0A0A0A] border border-[#222] rounded-lg p-4 mt-3 overflow-x-auto">{`POST https://www.macdestudios.com/api/usage
Authorization: Bearer <USAGE_INGEST_SECRET>
{ "provider": "anthropic", "app": "mi-app", "feature": "chat",
  "model": "claude-sonnet-5", "input_tokens": 1200, "output_tokens": 400 }
// otros proveedores: manda "cost_usd" directamente`}</pre>
      </Card>
    </div>
  )
}
