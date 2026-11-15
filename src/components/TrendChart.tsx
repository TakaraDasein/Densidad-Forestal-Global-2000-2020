import { useMemo, useState } from "react"
import { scaleLinear, line, extent } from "d3"
import { LAST_OFFICIAL_YEAR, REFERENCE_YEARS, YEARS, fmtPct, isProjected } from "@/lib/forest"

export interface TrendSeries {
  label: string
  values: (number | null)[]
  color: string
  dashed?: boolean
}

interface TrendChartProps {
  series: TrendSeries[]
  year: number
  baseYear?: number
  height?: number
}

const W = 300
const M = { top: 10, right: 12, bottom: 20, left: 34 }

export default function TrendChart({ series, year, baseYear, height = 150 }: TrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const H = height

  const { x, y, paths } = useMemo(() => {
    const all = series.flatMap(s => s.values.filter((v): v is number => v !== null))
    const [lo, hi] = extent(all) as [number, number]
    const pad = Math.max((hi - lo) * 0.15, 1)
    const x = scaleLinear()
      .domain([YEARS[0], YEARS[YEARS.length - 1]])
      .range([M.left, W - M.right])
    const y = scaleLinear()
      .domain([Math.max(0, lo - pad), Math.min(100, hi + pad)])
      .range([H - M.bottom, M.top])
      .nice()
    const gen = line<number | null>()
      .defined(v => v !== null)
      .x((_, i) => x(YEARS[i]))
      .y(v => y(v as number))
    const cut = YEARS.indexOf(LAST_OFFICIAL_YEAR)
    return {
      x,
      y,
      paths: series.map(s => ({
        official: gen(s.values.map((v, i) => (i <= cut ? v : null))) ?? "",
        projected: gen(s.values.map((v, i) => (i >= cut ? v : null))) ?? "",
      })),
    }
  }, [series, H])

  const yi = YEARS.indexOf(year)
  const shownIdx = hoverIdx ?? yi
  const lastYear = YEARS[YEARS.length - 1]
  const xTicks = YEARS.filter(y => (y % 10 === 0 && lastYear - y > 4) || y === lastYear)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        onMouseMove={e => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const yr = Math.round(x.invert(px))
          const idx = YEARS.indexOf(Math.max(YEARS[0], Math.min(YEARS[YEARS.length - 1], yr)))
          setHoverIdx(idx)
        }}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label={`Evolución de la cobertura forestal ${YEARS[0]}–${YEARS[YEARS.length - 1]}`}
      >
        {y.ticks(4).map(t => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
            <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.5)">
              {t}%
            </text>
          </g>
        ))}
        {xTicks.map(t => (
          <text key={t} x={x(t)} y={H - 5} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)">
            {t}
          </text>
        ))}
        {baseYear !== undefined && baseYear !== year && (
          <line
            x1={x(baseYear)}
            x2={x(baseYear)}
            y1={M.top}
            y2={H - M.bottom}
            stroke="rgba(255,255,255,0.35)"
            strokeDasharray="2 3"
          />
        )}
        <line x1={x(YEARS[shownIdx])} x2={x(YEARS[shownIdx])} y1={M.top} y2={H - M.bottom} stroke="rgba(250,204,21,0.6)" />
        {x(LAST_OFFICIAL_YEAR) < W - M.right && (
          <rect
            x={x(LAST_OFFICIAL_YEAR)}
            y={M.top}
            width={W - M.right - x(LAST_OFFICIAL_YEAR)}
            height={H - M.bottom - M.top}
            fill="rgba(255,255,255,0.05)"
          >
            <title>Proyección (no es dato oficial)</title>
          </rect>
        )}
        {series.map((s, i) => (
          <g key={s.label}>
            <path
              d={paths[i].official}
              fill="none"
              stroke={s.color}
              strokeWidth={i === 0 ? 2.2 : 1.5}
              strokeDasharray={s.dashed ? "4 3" : undefined}
              strokeLinejoin="round"
            />
            <path
              d={paths[i].projected}
              fill="none"
              stroke={s.color}
              strokeWidth={i === 0 ? 2.2 : 1.5}
              strokeDasharray="1.5 2.5"
              strokeLinecap="round"
              opacity={0.8}
            />
            {i === 0 &&
              REFERENCE_YEARS.map(ry => {
                const v = s.values[YEARS.indexOf(ry)]
                return v === null || v === undefined ? null : (
                  <circle key={ry} cx={x(ry)} cy={y(v)} r={1.8} fill={s.color} />
                )
              })}
          </g>
        ))}
        {series.map(s => {
          const v = s.values[shownIdx]
          return v === null ? null : (
            <circle key={s.label} cx={x(YEARS[shownIdx])} cy={y(v)} r={3.2} fill={s.color} stroke="#0b1220" strokeWidth={1.5} />
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/70 mt-1">
        <span className="text-yellow-300/90 font-medium">
          {YEARS[shownIdx]}
          {isProjected(YEARS[shownIdx]) && <span className="text-white/50 font-normal"> (proyección)</span>}
        </span>
        {series.map(s => (
          <span key={s.label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5" style={{ background: s.color }} />
            {s.label}: <span className="text-white tabular-nums">{fmtPct(s.values[shownIdx])}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
