import { BlurReveal } from './motion'

// Curva de equity SIMULADA (base 100), mensual ~6 años. Ilustrativa.
const EQUITY = [
  100, 102, 105, 103, 108, 112, 110, 115, 118, 121, 119, 124, 128, 133, 131, 138,
  142, 140, 133, 129, 135, 141, 146, 150, 149, 155, 161, 167, 164, 172, 178, 185,
  182, 190, 197, 205, 202, 209,
]

const ANUAL = [
  { y: '2020', r: 18.2 },
  { y: '2021', r: 22.4 },
  { y: '2022', r: -6.1 },
  { y: '2023', r: 14.7 },
  { y: '2024', r: 19.3 },
  { y: '2025', r: 8.5 },
]

const METRICAS = [
  { k: 'Retorno anualizado', v: '+14.8%' },
  { k: 'Máx. caída (drawdown)', v: '−11.2%' },
  { k: 'Mejor año', v: '+22.4%' },
  { k: 'Peor año', v: '−6.1%' },
]

// --- Geometría del área SVG ---
const W = 720
const H = 240
const lo = Math.min(...EQUITY)
const hi = Math.max(...EQUITY)
const pad = (hi - lo) * 0.12
const yMin = lo - pad
const yMax = hi + pad
const px = (i: number) => (i / (EQUITY.length - 1)) * W
const py = (v: number) => H - ((v - yMin) / (yMax - yMin)) * H
const line = EQUITY.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
const area = `${px(0)},${H} ${line} ${px(EQUITY.length - 1)},${H}`
const maxAbs = Math.max(...ANUAL.map((a) => Math.abs(a.r)))

export default function Historial() {
  return (
    <section id="historial" className="relative border-t border-atlas-line/50 py-28 md:py-40">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <BlurReveal className="mb-14 md:mb-20">
          <p className="kicker mb-6 text-[11px] text-atlas-gold">Historial de la metodología</p>
          <h2 className="max-w-2xl text-[clamp(2rem,4.4vw,3.4rem)] font-normal leading-[1.08] text-atlas-ink">
            Crecimiento compuesto, con las caídas bajo control.
          </h2>
        </BlurReveal>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Curva de equity */}
          <BlurReveal>
            <div className="h-full rounded-2xl border border-atlas-line bg-atlas-panel/40 p-6 sm:p-7">
              <div className="mb-5 flex items-baseline justify-between">
                <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-atlas-muted">
                  Equity simulada · base 100
                </span>
                <span className="fig text-[15px] text-atlas-goldsoft">+109%</span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Curva de equity simulada, crecimiento compuesto con drawdowns controlados">
                <defs>
                  <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={area} fill="url(#eqFill)" />
                <polyline
                  points={line}
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle cx={px(EQUITY.length - 1)} cy={py(EQUITY[EQUITY.length - 1])} r={4} fill="#7fe9dd" />
              </svg>
            </div>
          </BlurReveal>

          {/* Métricas */}
          <BlurReveal delay={0.1}>
            <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-0">
              {METRICAS.map((m, i) => (
                <div
                  key={m.k}
                  className={`flex flex-col justify-center rounded-2xl border border-atlas-line bg-atlas-panel/40 p-5 lg:rounded-none lg:border-0 lg:border-b lg:border-atlas-line/60 lg:px-1 ${
                    i === METRICAS.length - 1 ? 'lg:border-b-0' : ''
                  }`}
                >
                  <div className="display-num text-[clamp(1.8rem,3vw,2.4rem)] text-atlas-ink">{m.v}</div>
                  <div className="mt-1 text-[12.5px] font-light text-atlas-muted">{m.k}</div>
                </div>
              ))}
            </div>
          </BlurReveal>
        </div>

        {/* Retornos anuales */}
        <BlurReveal delay={0.15}>
          <div className="mt-5 rounded-2xl border border-atlas-line bg-atlas-panel/40 p-6 sm:p-7">
            <div className="mb-6 text-[12px] font-medium uppercase tracking-[0.14em] text-atlas-muted">
              Retorno por año · simulado
            </div>
            <div className="grid grid-cols-6 gap-3 sm:gap-5">
              {ANUAL.map((a) => {
                const pos = a.r >= 0
                const h = (Math.abs(a.r) / maxAbs) * 100
                return (
                  <div key={a.y} className="flex flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end justify-center">
                      <div
                        className={`w-7 rounded-t ${pos ? 'bg-atlas-gold/70' : 'bg-red-400/60'}`}
                        style={{ height: `${Math.max(h, 6)}%` }}
                      />
                    </div>
                    <span className={`fig text-[12.5px] ${pos ? 'text-atlas-goldsoft' : 'text-red-300'}`}>
                      {pos ? '+' : ''}
                      {a.r}%
                    </span>
                    <span className="text-[11.5px] font-light text-atlas-muted">{a.y}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </BlurReveal>

        <BlurReveal delay={0.2}>
          <p className="mt-8 text-[11.5px] font-light leading-relaxed text-atlas-muted/70">
            Datos <span className="text-atlas-muted">simulados</span> con fines ilustrativos (backtest de
            la metodología, sin comisiones ni deslizamiento garantizados). Los resultados pasados o
            simulados no garantizan resultados futuros. No es asesoramiento de inversión.
          </p>
        </BlurReveal>
      </div>
    </section>
  )
}
