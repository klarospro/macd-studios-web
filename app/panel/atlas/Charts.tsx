'use client'

import { useRef, useState } from 'react'

export interface ChartSeries {
  name: string
  color: string
  values: number[]
  fill?: boolean
  /** Índice de la curva donde el circuit breaker paró el sistema */
  haltAt?: number | null
}

const W = 1000
const M = { t: 16, r: 58, b: 22, l: 14 }

function group(int: string) {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function money(n: number) {
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  return `${n < 0 ? '-' : ''}$${group(int)},${dec}`
}

/**
 * Curva de líneas SVG (misma lógica que template.html): grid horizontal,
 * ticks de $ a la derecha, área rellena opcional, punto final, marca de HALT
 * y crosshair + tooltip al pasar el puntero.
 */
export function LineChart({
  series,
  height = 300,
  base,
  ariaLabel,
}: {
  series: ChartSeries[]
  height?: number
  base?: number
  ariaLabel: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const H = height
  const iw = W - M.l - M.r
  const ih = H - M.t - M.b
  const all = series.flatMap((s) => s.values)
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = (hi - lo) * 0.14 || 1
  const yMin = lo - pad
  const yMax = hi + pad
  const maxLen = Math.max(...series.map((s) => s.values.length))
  const x = (i: number) => M.l + (maxLen > 1 ? i / (maxLen - 1) : 0.5) * iw
  const y = (v: number) => M.t + (1 - (v - yMin) / (yMax - yMin)) * ih

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const bb = svgRef.current?.getBoundingClientRect()
    if (!bb || bb.width === 0) return
    const px = ((e.clientX - bb.left) / bb.width) * W
    const i = Math.max(0, Math.min(maxLen - 1, Math.round(((px - M.l) / iw) * (maxLen - 1))))
    setHover(i)
  }

  const gridLevels = [0, 1, 2, 3, 4].map((g) => yMin + (g / 4) * (yMax - yMin))
  const flip = hover != null && hover > maxLen * 0.6

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="block h-auto w-full touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {gridLevels.map((v, g) => (
          <g key={g}>
            <line x1={M.l} x2={M.l + iw} y1={y(v)} y2={y(v)} stroke="#24303C" strokeOpacity={0.55} />
            <text
              x={M.l + iw + 7}
              y={y(v) + 4}
              fill="#55636F"
              fontSize={11}
              fontFamily="var(--font-mono, ui-monospace, monospace)"
            >
              {'$' + group(String(Math.round(v / 100) * 100))}
            </text>
          </g>
        ))}

        {base != null && (
          <line x1={M.l} x2={M.l + iw} y1={y(base)} y2={y(base)} stroke="#24303C" strokeDasharray="3 4" />
        )}

        {series.map((s) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
          const li = s.values.length - 1
          return (
            <g key={s.name}>
              {s.fill && (
                <polygon
                  points={`${M.l},${y(yMin)} ${pts} ${x(li)},${y(yMin)}`}
                  fill={s.color}
                  opacity={0.11}
                />
              )}
              <polyline
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={x(li)} cy={y(s.values[li])} r={4} fill={s.color} stroke="#131A23" strokeWidth={2} />
              {s.haltAt != null && (
                <circle
                  cx={x(s.haltAt)}
                  cy={y(s.values[Math.min(s.haltAt, li)])}
                  r={4.5}
                  fill="none"
                  stroke="#E0736A"
                  strokeWidth={2}
                />
              )}
            </g>
          )
        })}

        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} stroke="#24303C" opacity={0.9} />
        )}
      </svg>

      {hover != null && (
        <div
          className={`pointer-events-none absolute top-2 z-10 rounded-lg border border-[#24303C] bg-[#18212C] px-3 py-2 font-mono text-xs text-[#EDF1F6] shadow-[0_8px_24px_rgba(0,0,0,0.45)] ${
            flip ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3'
          }`}
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          {series.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-4 whitespace-nowrap">
              <span style={{ color: s.color }}>{s.name}</span>
              <b>{money(s.values[Math.min(hover, s.values.length - 1)])}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Sparkline de equity por instrumento (misma lógica que template.html). */
export function Spark({ values, color }: { values: number[]; color: string }) {
  const SW = 120
  const SH = 28
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const r = hi - lo || 1
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * (SW - 2) + 1 : SW / 2)
  const y = (v: number) => SH - 2 - ((v - lo) / r) * (SH - 4)
  const last = values.length - 1
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} className="inline-block h-7 w-[118px]" aria-hidden="true">
      <polyline
        points={values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
      />
      <circle cx={x(last).toFixed(1)} cy={y(values[last]).toFixed(1)} r={2.3} fill={color} />
    </svg>
  )
}
