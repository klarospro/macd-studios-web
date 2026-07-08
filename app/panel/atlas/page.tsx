import type { Metadata } from 'next'
import dashboard from '@/ATLAS-AI/engine/dashboard/sample-data/dashboard.json'
import account from '@/ATLAS-AI/engine/dashboard/sample-data/account.json'
import { LineChart, Spark } from './Charts'

export const metadata: Metadata = {
  title: 'Atlas AI · Panel de gestión',
  description: 'Gestión automatizada de capital — cuenta demo y rendimiento de la estrategia TSMOM.',
}

// ---- Helpers deterministas (mismo formato en server y client) ----
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function money(n: number) {
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  return `${n < 0 ? '-' : ''}$${group(int)},${dec}`
}

const fmt = (n: number, d = 1) => (n >= 0 ? '+' : '') + n.toFixed(d)

const isoDay = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10)

function instFromLongcode(lc: string): string {
  const m =
    lc.match(/(?:increase|decrease) in ([^,]+?), multiplied/i) ||
    lc.match(/in ([A-Za-z0-9/() ]+?) (?:Index|is|after)/i)
  return m ? m[1].trim() : '—'
}

// ---- Datos (JSON de muestra versionados; sin llamadas externas) ----
const curves = dashboard.curves as Record<string, number[]>
const updated = dashboard.generatedAt.slice(0, 10)

export default function AtlasPage() {
  // Balance histórico: statement viene de más reciente a más antiguo
  const txChrono = [...account.statement].reverse()
  const balSeries = txChrono.map((t) => t.balanceAfter)

  const p = dashboard.portfolio
  const btcDefault = dashboard.btc.default
  const btcTuned = dashboard.btc.tuned
  const haltIdx =
    btcDefault.haltedAt != null
      ? Math.round((btcDefault.haltedAt / 731) * btcDefault.curve.length)
      : null

  const kpis = [
    {
      label: 'Estrategia · BTC 2 años',
      num: fmt(btcTuned.returnPct) + '%',
      cls: 'text-[#D2A05A]',
      sub: `DD ${btcTuned.maxDd.toFixed(1)}% · ${btcTuned.trades} ops`,
    },
    {
      label: 'Cartera · 5 activos',
      num: fmt(p.avgReturn) + '%',
      cls: p.avgReturn >= 0 ? 'text-[#5BC08C]' : 'text-[#E0736A]',
      sub: `${p.winners}/${p.total} positivos · DD ${p.avgDd.toFixed(1)}%`,
    },
    { label: 'Motor · tests', num: '15/15', cls: 'text-[#5BC08C]', sub: 'typecheck + suite en verde' },
    { label: 'Capa maestra', num: '✓', cls: 'text-[#5BC08C]', sub: 'PortfolioManager · gate 4%' },
  ]

  const maxAbs = Math.max(...dashboard.instruments.map((d) => Math.abs(d.returnPct)))

  return (
    <div className="grid min-h-screen bg-[#0B0F14] font-sans text-[#EDF1F6] antialiased md:grid-cols-[232px_1fr]">
      {/* ---- Sidebar ---- */}
      <aside className="flex flex-row flex-wrap items-center gap-4 border-b border-[#24303C] bg-gradient-to-b from-[#18212C] to-[#131A23] px-5 py-6 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:gap-1.5 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 md:mb-6">
          <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[radial-gradient(circle_at_30%_25%,#D2A05A,#8A642F)] text-[17px] font-extrabold text-[#1A130A]">
            A
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight">Atlas AI</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8695A6]">
              MACD Studios
            </div>
          </div>
        </div>
        <nav className="flex flex-row flex-wrap gap-0.5 md:flex-col">
          {[
            ['#cuenta', 'Cuenta demo'],
            ['#estrategia', 'Estrategia'],
            ['#sistema', 'Sistema'],
            ['#riesgo', 'Riesgo'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-sm font-medium text-[#8695A6] transition-colors hover:bg-[#D2A05A]/10 hover:text-[#EDF1F6]"
            >
              <span className="h-[7px] w-[7px] rounded-[2px] bg-current opacity-70" />
              {label}
            </a>
          ))}
        </nav>
        <div className="mt-auto hidden font-mono text-[11px] text-[#55636F] md:block">
          v1 · {updated}
        </div>
      </aside>

      {/* ---- Main ---- */}
      <main className="max-w-[1120px] p-5 sm:p-8 lg:p-11">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-sans text-2xl font-semibold tracking-tight sm:text-3xl">
              Panel de gestión
            </h1>
            <div className="mt-0.5 text-sm text-[#8695A6]">
              Gestión automatizada de capital · plantilla maestra
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#5BC08C]/40 px-3 py-1 font-mono text-[11px] tracking-wider text-[#5BC08C]">
              ● Cuenta demo · paper
            </span>
            <span className="rounded-full border border-[#24303C] px-3 py-1 font-mono text-[11px] tracking-wider text-[#8695A6]">
              act. {updated}
            </span>
          </div>
        </div>

        {/* ---- Cuenta: hero de balance + curva del historial ---- */}
        <section id="cuenta" className="mb-8 scroll-mt-5">
          <div className="grid gap-[18px] lg:grid-cols-[1.1fr_1.4fr]">
            <div className="rounded-2xl border border-[#24303C] bg-[#131A23] p-[22px]">
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#8695A6]">
                Balance · cuenta demo Deriv
              </div>
              <div className="my-1 text-5xl font-semibold tracking-tighter tabular-nums sm:text-[56px]">
                {money(account.balance)}
              </div>
              <div className="text-[13.5px] text-[#8695A6]">
                Cuenta <b className="font-mono font-semibold text-[#EDF1F6]">{account.accountId}</b> ·
                dinero virtual
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ['Abiertas', String(account.open.length)],
                  ['Transacciones', String(account.statement.length)],
                  ['Broker', 'Deriv'],
                ].map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded-lg border border-[#24303C] bg-[#18212C] px-2.5 py-1 font-mono text-[11px] text-[#8695A6]"
                  >
                    {k} <b className="text-[#EDF1F6]">{v}</b>
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-[#24303C] bg-[#131A23] p-[22px]">
              <SectionTitle>Balance a lo largo del historial</SectionTitle>
              {balSeries.length > 1 && (
                <LineChart
                  series={[{ name: 'Balance', color: '#B58234', values: balSeries, fill: true }]}
                  height={210}
                  ariaLabel="Balance histórico de la cuenta demo"
                />
              )}
            </div>
          </div>
        </section>

        {/* ---- KPIs ---- */}
        <div className="mb-8 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-[13px] border border-[#24303C] bg-[#131A23] px-4 py-[15px]">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-[#8695A6]">
                {k.label}
              </div>
              <div className={`mt-1.5 text-[25px] font-semibold tracking-tight tabular-nums ${k.cls}`}>
                {k.num}
              </div>
              <div className="mt-0.5 text-xs text-[#8695A6]">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ---- Historial de transacciones ---- */}
        <section className="mb-8">
          <div className="rounded-2xl border border-[#24303C] bg-[#131A23] p-[22px]">
            <SectionTitle>Historial de transacciones · cuenta demo</SectionTitle>
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <Th first>Fecha</Th>
                    <Th>Tipo</Th>
                    <Th>Instrumento</Th>
                    <Th>Importe</Th>
                    <Th>Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {account.statement.slice(0, 14).map((t, i) => {
                    const pos = t.amount >= 0
                    const inst = instFromLongcode(t.longcode)
                    return (
                      <tr key={`${t.time}-${i}`} className="border-b border-[#24303C]/50 last:border-b-0">
                        <Td first>{isoDay(t.time)}</Td>
                        <Td>
                          <span
                            className={`rounded-[5px] px-[7px] py-0.5 font-mono text-[10px] ${
                              t.action === 'buy'
                                ? 'bg-[#5BC08C]/15 text-[#5BC08C]'
                                : 'bg-[#4E97DE]/15 text-[#4E97DE]'
                            }`}
                          >
                            {t.action.toUpperCase()}
                          </span>
                        </Td>
                        <Td>
                          <span
                            className="block max-w-[30ch] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#8695A6]"
                            title={inst}
                          >
                            {inst}
                          </span>
                        </Td>
                        <Td>
                          <span className={pos ? 'text-[#5BC08C]' : 'text-[#E0736A]'}>
                            {pos ? '+' : ''}
                            {t.amount.toFixed(2)}
                          </span>
                        </Td>
                        <Td>{money(t.balanceAfter)}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12.5px] text-[#8695A6]">
              Historial real de la cuenta demo{' '}
              <b className="text-[#EDF1F6]">{account.accountId}</b>. Movimientos antiguos de pruebas +
              las operaciones del motor. Durante el mes de demo se llenará con las decisiones de la
              estrategia.
            </p>
          </div>
        </section>

        {/* ---- Estrategia ---- */}
        <section id="estrategia" className="mb-8 scroll-mt-5">
          <div className="rounded-2xl border border-[#24303C] bg-[#131A23] p-[22px]">
            <SectionTitle>Estrategia TSMOM · backtest sobre mercado real</SectionTitle>
            <div className="mb-2 flex flex-wrap gap-[18px] text-[13px] text-[#8695A6]">
              <span className="inline-flex items-center gap-[7px]">
                <i className="h-[11px] w-[11px] rounded-[3px] bg-[#B58234]" />
                Config TSMOM
              </span>
              <span className="inline-flex items-center gap-[7px]">
                <i className="h-[11px] w-[11px] rounded-[3px] bg-[#4E97DE]" />
                Config por defecto (breaker 4)
              </span>
            </div>
            <LineChart
              series={[
                { name: 'TSMOM', color: '#B58234', values: btcTuned.curve, fill: true },
                { name: 'Por defecto', color: '#4E97DE', values: btcDefault.curve, haltAt: haltIdx },
              ]}
              base={10000}
              ariaLabel="Equity de BTC, dos configuraciones"
            />
            <p className="mt-3 text-[12.5px] text-[#8695A6]">
              BTC/USD · 2 años de cierres diarios reales · $10.000 inicial. El breaker de 4 pérdidas{' '}
              <b className="text-[#E0736A]">paró el sistema a mitad</b> — con trend following las rachas
              son normales por diseño; por eso el breaker es configurable por venue.
            </p>
          </div>

          <div className="mt-3.5 rounded-2xl border border-[#24303C] bg-[#131A23] p-[22px]">
            <SectionTitle>TSMOM diversificado · 5 instrumentos reales de Deriv</SectionTitle>
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <Th first>Instrumento</Th>
                    <Th>Ops</Th>
                    <Th>Acierto</Th>
                    <Th>Máx DD</Th>
                    <Th>Retorno</Th>
                    <Th>Equity</Th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.instruments.map((d) => {
                    const pos = d.returnPct >= 0
                    const w = (Math.abs(d.returnPct) / maxAbs) * 84 + 4
                    return (
                      <tr key={d.name} className="border-b border-[#24303C]/50 last:border-b-0">
                        <Td first>
                          <span className="font-semibold">{d.name}</span>
                          {d.halted && (
                            <span className="ml-[7px] rounded-[5px] border border-[#E0736A]/45 px-[5px] py-px font-mono text-[9.5px] text-[#E0736A]">
                              HALT
                            </span>
                          )}
                        </Td>
                        <Td>{d.trades}</Td>
                        <Td>{d.winRate.toFixed(0)}%</Td>
                        <Td>{d.maxDrawdownPct.toFixed(1)}%</Td>
                        <Td>
                          <span className="flex items-center justify-end gap-[9px]">
                            <span className={`font-semibold ${pos ? 'text-[#5BC08C]' : 'text-[#E0736A]'}`}>
                              {fmt(d.returnPct)}%
                            </span>
                            <span
                              className={`h-1.5 min-w-0.5 rounded ${pos ? 'bg-[#5BC08C]' : 'bg-[#E0736A]'}`}
                              style={{ width: `${w}px` }}
                            />
                          </span>
                        </Td>
                        <Td>
                          {curves[d.name] && (
                            <Spark values={curves[d.name]} color={pos ? '#5BC08C' : '#E0736A'} />
                          )}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12.5px] text-[#8695A6]">
              <b className="text-[#D2A05A]">Oro</b> tiró de la cartera;{' '}
              <b className="text-[#E0736A]">EURUSD</b> sangró en lateral hasta que el breaker de drawdown
              lo cortó solo. Cartera diversificada en positivo con menos caída que el peor activo —
              diversificar, medido.
            </p>
          </div>
        </section>

        {/* ---- Sistema + Riesgo ---- */}
        <section id="sistema" className="mb-8 scroll-mt-5">
          <div className="grid gap-3.5 md:grid-cols-2">
            <div className="rounded-2xl border border-[#24303C] bg-[#131A23] p-[22px]">
              <SectionTitle>Arquitectura construida</SectionTitle>
              {(
                [
                  ['done', 'Risk gate + sizing + breakers', 'Kelly fraccionado, drawdown, exposición · 15/15 tests'],
                  ['done', 'Adaptador Deriv demo (WebSocket)', 'connect, balance, order, close · validado'],
                  ['done', 'PortfolioManager multi-venue', 'gate global de riesgo sobre el capital total'],
                  ['done', 'TSMOM + backtest sobre datos reales', 'BTC + índices + oro + forex'],
                  ['done', 'Runner diario + auditoría WORM', 'decisiones con mercado real · log append-only'],
                  ['wip', 'Persistencia Supabase + web pública', 'esquema listo; falta conectar y desplegar'],
                  ['todo', 'Registro de clientes + conexión de brokers', 'fase SaaS · onboarding multi-tenant'],
                ] as const
              ).map(([state, title, desc]) => (
                <div
                  key={title}
                  className="flex items-start gap-3 border-b border-[#24303C]/50 py-2.5 last:border-b-0"
                >
                  <span
                    className={`mt-1.5 h-[9px] w-[9px] flex-none rounded-full ${
                      state === 'done'
                        ? 'bg-[#5BC08C] shadow-[0_0_0_3px_rgba(91,192,140,0.18)]'
                        : state === 'wip'
                          ? 'bg-[#D2A05A] shadow-[0_0_0_3px_rgba(210,160,90,0.18)]'
                          : 'bg-[#55636F]'
                    }`}
                  />
                  <div>
                    <div className="text-[13.5px] font-semibold">{title}</div>
                    <div className="text-xs text-[#8695A6]">{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div id="riesgo" className="scroll-mt-5 rounded-2xl border border-[#24303C] bg-[#131A23] p-[22px]">
              <SectionTitle>Gestión de riesgo</SectionTitle>
              {(
                [
                  ['Riesgo por operación', '1%'],
                  ['Kelly fraccionado', '1/4'],
                  ['Drawdown diario → stop nuevas órdenes', '3%'],
                  ['Drawdown total → HALT + revisión', '10%'],
                  ['Riesgo agregado por cuenta', '5%'],
                  ['Techo de riesgo global (portafolio)', '4%'],
                  ['Posiciones concurrentes máx.', '3'],
                ] as const
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 border-b border-[#24303C]/50 py-2 text-[13px] last:border-b-0"
                >
                  <span className="text-[#8695A6]">{k}</span>
                  <span className="font-mono text-[#D2A05A]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="mt-1.5 border-t border-[#24303C] pt-[18px] text-xs text-[#55636F]">
          <strong className="text-[#8695A6]">Aviso honesto:</strong> historial de la cuenta demo =
          dinero virtual (Deriv). Backtest simplificado (solo cierres, sin comisiones/slippage, muestra
          corta) — resultados pasados no garantizan los futuros. No es asesoramiento de inversión. ·
          Atlas AI · MACD Studios
        </footer>
      </main>
    </div>
  )
}

// ---- Piezas de presentación reutilizadas ----
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-[15px] font-mono text-xs font-semibold uppercase tracking-[0.13em] text-[#8695A6]">
      {children}
    </h2>
  )
}

function Th({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <th
      className={`border-b border-[#24303C] px-2.5 pb-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.05em] text-[#8695A6] ${
        first ? 'text-left' : 'text-right'
      }`}
    >
      {children}
    </th>
  )
}

function Td({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <td className={`p-2.5 tabular-nums ${first ? 'text-left' : 'text-right'}`}>{children}</td>
}
