import { useMemo, useState } from "react"
import { scaleLinear, line, extent } from "d3"
import { fmtValue, isProjected, lastOfficialYear, yearLabel, type Indicator } from "@/lib/indicators"

export interface TrendSeries {
  label: string
  values: (number | null)[]
  color: string
  dashed?: boolean
}

interface TrendChartProps {
  indicator: Indicator
  series: TrendSeries[]
  year: number
  baseYear?: number
  height?: number
}

const W = 300
const M = { top: 10, right: 14, bottom: 20, left: 36 }

export default function TrendChart({ indicator, series, year, baseYear, height = 150 }: TrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const H = height
  const years = indicator.years
  const firstYear = years[0]
  const lastYear = years[years.length - 1]
  const official = lastOfficialYear(indicator)
  // En series que son todo proyección (o casi) no tiene sentido separar un tramo «oficial»
  const splitProjection = (indicator.projectedYears?.length ?? 0) > 0 && years.indexOf(official) > 0

  const { x, y, paths } = useMemo(() => {
    const all = series.flatMap(s => s.values.filter((v): v is number => v !== null))
    const [lo, hi] = all.length ? (extent(all) as [number, number]) : [0, 1]
    const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.02, 10 ** -indicator.decimals)
    const yMin = lo >= 0 ? Math.max(0, lo - pad) : lo - pad
    const yMax = indicator.unit === "%" ? Math.min(100, hi + pad) : hi + pad
    const x = scaleLinear().domain([firstYear, lastYear]).range([M.left, W - M.right])
    const y = scaleLinear().domain([yMin, yMax]).range([H - M.bottom, M.top]).nice()
    const gen = line<number | null>()
      .defined(v => v !== null)
      .x((_, i) => x(years[i]))
      .y(v => y(v as number))
    const cut = splitProjection ? years.indexOf(official) : years.length - 1
    return {
      x,
      y,
      paths: series.map(s => ({
        official: gen(s.values.map((v, i) => (i <= cut ? v : null))) ?? "",
        projected: splitProjection ? gen(s.values.map((v, i) => (i >= cut ? v : null))) ?? "" : "",
      })),
    }
  }, [series, H, indicator, years, firstYear, lastYear, official, splitProjection])

  const yi = Math.max(0, years.indexOf(year))
  const shownIdx = hoverIdx !== null && hoverIdx < years.length ? hoverIdx : yi
  const shownYear = years[shownIdx]

  // Marcas del eje X: todos los puntos si son pocos; si no, décadas y el último año
  const span = lastYear - firstYear
  const xTicks =
    years.length <= 6
      ? years
      : years.filter(yr => (yr % (span > 45 ? 20 : 10) === 0 && lastYear - yr > span * 0.12) || yr === lastYear)
  const tickLabel = (yr: number) => yearLabel(indicator, yr).replace(/^(\d{4})–\d{2}(\d{2})$/, "$1–$2")
  // El eje no repite la unidad (salvo % y °C, que son cortas): ya aparece en la leyenda
  const fmtAxis = (t: number) => {
    const text = t.toLocaleString("es", { maximumFractionDigits: 2 }).replace("-", "−")
    return indicator.unit === "%" ? `${text}%` : indicator.unit === "°C" ? `${text}°` : text
  }

  const nearestIdx = (px: number) => {
    const target = x.invert(px)
    let best = 0
    years.forEach((yr, i) => {
      if (Math.abs(yr - target) < Math.abs(years[best] - target)) best = i
    })
    return best
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        onMouseMove={e => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          setHoverIdx(nearestIdx(((e.clientX - r.left) / r.width) * W))
        }}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label={`Evolución de ${indicator.short}, ${yearLabel(indicator, firstYear)} a ${yearLabel(indicator, lastYear)}`}
      >
        {y.ticks(4).map(t => (
          <g key={t}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 && y.domain()[0] < 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}
            />
            <text x={M.left - 5} y={y(t)} dy="0.32em" textAnchor="end" fontSize="8.5" fill="rgba(255,255,255,0.5)">
              {fmtAxis(t)}
            </text>
          </g>
        ))}
        {xTicks.map(t => (
          <text key={t} x={x(t)} y={H - 5} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.5)">
            {tickLabel(t)}
          </text>
        ))}
        {splitProjection && (
          <rect
            x={x(official)}
            y={M.top}
            width={W - M.right - x(official)}
            height={H - M.bottom - M.top}
            fill="rgba(255,255,255,0.05)"
          >
            <title>Proyección (no es dato observado)</title>
          </rect>
        )}
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
        <line x1={x(shownYear)} x2={x(shownYear)} y1={M.top} y2={H - M.bottom} stroke="rgba(250,204,21,0.6)" />
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
            {paths[i].projected && (
              <path
                d={paths[i].projected}
                fill="none"
                stroke={s.color}
                strokeWidth={i === 0 ? 2.2 : 1.5}
                strokeDasharray="1.5 2.5"
                strokeLinecap="round"
                opacity={0.8}
              />
            )}
            {i === 0 &&
              (indicator.referenceYears ?? (years.length <= 6 ? years : [])).map(ry => {
                const v = s.values[years.indexOf(ry)]
                return v === null || v === undefined ? null : (
                  <circle key={ry} cx={x(ry)} cy={y(v)} r={1.8} fill={s.color} />
                )
              })}
          </g>
        ))}
        {series.map(s => {
          const v = s.values[shownIdx]
          return v === null || v === undefined ? null : (
            <circle key={s.label} cx={x(shownYear)} cy={y(v)} r={3.2} fill={s.color} stroke="#0b1220" strokeWidth={1.5} />
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/70 mt-1">
        <span className="text-yellow-300/90 font-medium">
          {yearLabel(indicator, shownYear)}
          {isProjected(indicator, shownYear) && <span className="text-white/50 font-normal"> (proyección)</span>}
        </span>
        {series.map(s => (
          <span key={s.label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5" style={{ background: s.color }} />
            {s.label}: <span className="text-white tabular-nums">{fmtValue(indicator, s.values[shownIdx] ?? null)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
