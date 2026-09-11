'use client'

const W = 700
const H = 220
const PAD = { t: 16, r: 16, b: 24, l: 44 }

export interface MonthPoint {
  label: string
  income: number
  expense: number
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export default function IncomeExpenseChart({ data }: { data: MonthPoint[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]))
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const groupW = innerW / data.length
  const barW = Math.min(22, groupW / 3)

  const ticks = 4
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * i)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {tickValues.map((t, i) => {
        const y = PAD.t + innerH - (t / max) * innerH
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#1c1c1c" strokeWidth={1} />
            <text x={PAD.l - 8} y={y + 3} textAnchor="end" fontSize={9} fill="#666">
              {money(t)}
            </text>
          </g>
        )
      })}

      {data.map((d, i) => {
        const x = PAD.l + i * groupW + groupW / 2
        const incomeH = (d.income / max) * innerH
        const expenseH = (d.expense / max) * innerH
        return (
          <g key={i}>
            <rect x={x - barW - 2} y={PAD.t + innerH - incomeH} width={barW} height={incomeH} fill="#D4AF37" rx={2} />
            <rect x={x + 2} y={PAD.t + innerH - expenseH} width={barW} height={expenseH} fill="#8B1A1A" rx={2} />
            <text x={x} y={H - 6} textAnchor="middle" fontSize={9} fill="#888">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
