import { useEffect, useMemo, useState } from "react"
import GlobeViz, { type Basemap } from "./GlobeViz"
import Particles from "./Particles"
import TrendChart from "./TrendChart"
import {
  COUNTRIES,
  COUNTRY_LIST,
  GROUPS,
  INDICATORS,
  INDICATOR_BY_ID,
  NO_DATA_COLOR,
  changeBetween,
  changeTone,
  colorFor,
  defaultYear,
  displayValue,
  fichaYear,
  fmtArea,
  fmtChange,
  fmtFor,
  fmtValue,
  isProjected,
  median,
  stopsFor,
  valueAt,
  yearLabel,
  type Indicator,
  type ViewMode,
} from "@/lib/indicators"
import { Bird, ChevronDown, Info, Layers, Pause, Play, ThermometerSun, TrendingDown, TrendingUp, Trees, X } from "lucide-react"

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-white/10 p-0.5 text-xs">
      {options.map(o => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
            value === o.value ? "bg-emerald-500 text-white shadow" : "text-white/70 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const compact = (v: number) => v.toLocaleString("es", { maximumFractionDigits: 2 }).replace("-", "−")

function Legend({ ind, mode, year, baseYear }: { ind: Indicator; mode: ViewMode; year: number; baseYear: number }) {
  const stops = stopsFor(ind, mode)
  const last = stops.length - 1
  // Las paradas se reparten a intervalos iguales: varias escalas no son lineales
  const gradient = `linear-gradient(to right, ${stops.map(([, c], i) => `${c} ${(i / last) * 100}%`).join(", ")})`
  const labelled = stops.map((s, i) => ({ s, i })).filter(({ i }) => stops.length <= 8 || i % 2 === 0)
  const unit = mode === "cover" ? ind.unit : ind.changeUnit
  return (
    <div className="w-64">
      <div className="text-xs font-medium text-white/90 mb-1.5 leading-snug">
        {mode === "cover"
          ? `${ind.short} · ${yearLabel(ind, year)}`
          : `Cambio en ${ind.short.toLowerCase()} · ${yearLabel(ind, baseYear)} → ${yearLabel(ind, year)}`}
        {unit && <span className="text-white/50 font-normal"> ({unit})</span>}
        {isProjected(ind, year) && <span className="text-amber-300 font-normal"> · proyección</span>}
      </div>
      <div className="h-2.5 rounded-full" style={{ background: gradient }} />
      <div className="relative h-4 text-[10px] text-white/60 mt-0.5 mx-2">
        {labelled.map(({ s, i }) => (
          <span key={i} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${(i / last) * 100}%` }}>
            {mode === "change" && s[0] > 0 ? "+" : ""}
            {compact(s[0])}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/60 mt-0.5">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: NO_DATA_COLOR }} /> Sin datos
        </span>
        {mode === "change" && <span>{ind.higherIsBetter ? "rojo: baja · verde: sube" : "verde: baja · rojo: sube"}</span>}
      </div>
    </div>
  )
}

function RankList({
  title,
  items,
  icon,
  onPick,
}: {
  title: string
  items: { iso3: string; text: string; tone: string }[]
  icon: React.ReactNode
  onPick: (iso3: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/80 mb-1">
        {icon}
        {title}
      </div>
      <ol className="space-y-0.5 text-xs">
        {items.map((it, i) => (
          <li key={it.iso3}>
            <button
              onClick={() => onPick(it.iso3)}
              className="w-full flex justify-between gap-2 rounded px-1 -mx-1 hover:bg-white/10 text-left"
            >
              <span className="text-white/70 truncate">
                {i + 1}. {COUNTRIES[it.iso3].name}
              </span>
              <span className={`tabular-nums whitespace-nowrap ${it.tone || "text-white/90"}`}>{it.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "Bosques y ecosistemas": <Trees className="h-4 w-4" />,
  Biodiversidad: <Bird className="h-4 w-4" />,
  Clima: <ThermometerSun className="h-4 w-4" />,
}
const GROUP_SHORT: Record<string, string> = { "Bosques y ecosistemas": "Bosques" }

/** Superficie de bosque del país y cantidad ganada o perdida desde un año base */
function forestAreaInfo(ind: Indicator, iso3: string, from: number, year: number) {
  const s = ind.area?.[iso3]
  if (!s) return null
  const now = valueAt(ind, s, year)
  const delta = changeBetween(ind, s, from, year)
  return now === null ? null : { now, delta }
}

function AreaLine({ ind, iso3, from, year }: { ind: Indicator; iso3: string; from: number; year: number }) {
  const a = forestAreaInfo(ind, iso3, from, year)
  if (!a) return null
  return (
    <div className="text-[11px] text-white/70 leading-snug">
      Bosque: <span className="text-white tabular-nums">{fmtArea(a.now)}</span>
      {a.delta !== null && from !== year && (
        <>
          {" · "}
          <span className={`tabular-nums ${a.delta < 0 ? "text-red-300" : a.delta > 0 ? "text-emerald-300" : ""}`}>
            {a.delta < 0 ? "perdió " : a.delta > 0 ? "ganó " : "sin cambio "}
            {a.delta !== 0 && fmtArea(Math.abs(a.delta))}
          </span>{" "}
          desde {yearLabel(ind, from)}
        </>
      )}
    </div>
  )
}

/** Filas con todos los indicadores de un país (ficha ambiental) */
function FichaRows({
  iso3,
  active,
  year,
  onPick,
  compact,
}: {
  iso3: string
  active: Indicator
  year: number
  onPick?: (id: string) => void
  compact?: boolean
}) {
  return (
    <ul className={`text-xs ${compact ? "" : "divide-y divide-white/5"}`}>
      {INDICATORS.map(i => {
        const y = fichaYear(i, active, year)
        const s = i.values[iso3]
        const v = valueAt(i, s, y)
        const d = changeBetween(i, s, i.years[0], y)
        const row = (
          <>
            <span className="min-w-0">
              <span className={`block truncate ${i.id === active.id ? "text-white font-medium" : "text-white/75"}`}>
                {i.short}
              </span>
              {!compact && (
                <span className="block text-[10px] text-white/40">
                  {yearLabel(i, y)}
                  {isProjected(i, y) && " · proyección"}
                </span>
              )}
            </span>
            <span className="text-right whitespace-nowrap tabular-nums">
              <span className={compact ? "text-white" : "block text-white"}>{fmtValue(i, v)}</span>
              {d !== null && y !== i.years[0] && (
                <span className={`${compact ? "ml-1.5" : "block"} text-[10px] ${changeTone(i, d) || "text-white/40"}`}>
                  {fmtChange(i, d)}
                  {!compact && ` desde ${yearLabel(i, i.years[0]).slice(0, 4)}`}
                </span>
              )}
            </span>
          </>
        )
        return (
          <li key={i.id}>
            {onPick ? (
              <button
                onClick={() => onPick(i.id)}
                className={`w-full flex items-center justify-between gap-2 py-1 px-1 -mx-1 rounded text-left hover:bg-white/10 ${
                  i.id === active.id ? "bg-white/5" : ""
                }`}
              >
                {row}
              </button>
            ) : (
              <div className="flex items-baseline justify-between gap-3 py-[1px]">{row}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const Stat = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-lg bg-white/5 p-2 min-w-0">
    <div className="text-[10px] text-white/50 leading-tight">{label}</div>
    <div className="text-base font-bold tabular-nums leading-tight mt-0.5">{children}</div>
  </div>
)

export default function AtlasApp() {
  const [indicatorId, setIndicatorId] = useState(INDICATORS[0].id)
  const ind = INDICATOR_BY_ID.get(indicatorId)!
  const [year, setYear] = useState(() => defaultYear(INDICATORS[0]))
  const [baseYear, setBaseYear] = useState(INDICATORS[0].years[0])
  const [mode, setMode] = useState<ViewMode>("cover")
  const [basemap, setBasemap] = useState<Basemap>("none")
  const [playing, setPlaying] = useState(false)
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [compareIso, setCompareIso] = useState<string>("")
  const [regionCode, setRegionCode] = useState("LCN")
  const [hover, setHover] = useState<{ iso3: string | null; name: string; x: number; y: number } | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 640)

  const years = ind.years
  const firstYear = years[0]
  const lastYear = years[years.length - 1]
  const yearIdx = Math.max(0, years.indexOf(year))

  const changeIndicator = (id: string) => {
    const next = INDICATOR_BY_ID.get(id)!
    setPlaying(false)
    setIndicatorId(id)
    // Entre series anuales se conserva el año; las de periodos usan su año por defecto
    const keep = !next.yearLabels && !ind.yearLabels && next.years.includes(year)
    const nextYear = keep ? year : defaultYear(next)
    setYear(nextYear)
    setBaseYear(keep && next.years.includes(baseYear) && baseYear < nextYear ? baseYear : next.years[0])
  }

  // Animación temporal
  useEffect(() => {
    if (!playing) return
    const id = setInterval(
      () => {
        setYear(y => {
          const i = years.indexOf(y)
          if (i < 0 || i >= years.length - 1) {
            setPlaying(false)
            return y
          }
          return years[i + 1]
        })
      },
      years.length <= 6 ? 1400 : years.length > 45 ? 280 : 450,
    )
    return () => clearInterval(id)
  }, [playing, years])

  useEffect(() => {
    if (baseYear >= year && mode === "change") setBaseYear(firstYear)
  }, [year, baseYear, mode, firstYear])

  const from = baseYear < year ? baseYear : firstYear

  // Color de cada país para el indicador, año y modo actuales
  const colors = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [iso3, s] of Object.entries(ind.values)) {
      const v = displayValue(ind, mode, s, baseYear, year)
      if (v !== null) out[iso3] = colorFor(ind, mode, v)
    }
    return out
  }, [ind, mode, baseYear, year])

  const summary = useMemo(() => {
    const current = Object.entries(ind.values)
      .map(([iso3, s]) => ({ iso3, v: valueAt(ind, s, year) }))
      .filter((c): c is { iso3: string; v: number } => c.v !== null)
      .sort((a, b) => b.v - a.v)
    const changes = Object.entries(ind.values)
      .map(([iso3, s]) => ({ iso3, v: changeBetween(ind, s, from, year) }))
      .filter((c): c is { iso3: string; v: number } => c.v !== null)
      .sort((a, b) => a.v - b.v)
    const eps = ind.changeMax * 0.003
    return {
      current,
      median: median(current.map(c => c.v)),
      falls: changes.slice(0, 5).filter(c => c.v < -eps),
      rises: changes.slice(-5).reverse().filter(c => c.v > eps),
      fallCount: changes.filter(c => c.v < -eps).length,
      riseCount: changes.filter(c => c.v > eps).length,
    }
  }, [ind, from, year])

  const selected = selectedIso ? COUNTRIES[selectedIso] : null
  const selectedSeries = selectedIso ? ind.values[selectedIso] : undefined
  const compareSeries = compareIso && compareIso !== selectedIso ? ind.values[compareIso] : undefined
  const region = ind.regions?.find(r => r.code === regionCode) ?? ind.regions?.[0]
  const rank = selectedIso ? summary.current.findIndex(c => c.iso3 === selectedIso) : -1

  const hoverSeries = hover?.iso3 ? ind.values[hover.iso3] : undefined
  const hoverChange = changeBetween(ind, hoverSeries, from, year)

  const startPlay = () => {
    if (yearIdx >= years.length - 1) setYear(mode === "change" ? years[years.indexOf(baseYear) + 1] ?? firstYear : firstYear)
    setPlaying(true)
  }

  const yearStatus = isProjected(ind, year)
    ? { text: "Proyección", cls: "uppercase tracking-wide text-amber-300" }
    : ind.referenceYears
      ? ind.referenceYears.includes(year)
        ? { text: "dato FAO", cls: "text-emerald-300/80" }
        : { text: "interpolado", cls: "text-white/45" }
      : ind.yearLabels
        ? { text: "simulación", cls: "text-white/45" }
        : null

  const tickStep = years.length > 45 ? 10 : 5
  const ticks =
    years.length <= 6 ? years : years.filter(y => y % tickStep === 0 || y === lastYear).filter(y => lastYear - y > 2 || y === lastYear || isProjected(ind, lastYear))
  const select = (iso3: string | null) => {
    setSelectedIso(iso3)
    if (iso3) setPanelOpen(true)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#02060d] text-white">
      <Particles />

      <GlobeViz colors={colors} basemap={basemap} selectedIso={selectedIso} onSelect={select} onHover={setHover} />

      {/* Tooltip: resumen completo del país */}
      {hover && (
        <div
          className="pointer-events-none absolute z-30 w-[270px] rounded-xl bg-[#060d18]/95 border border-white/15 px-3 py-2.5 text-xs shadow-xl"
          style={{
            left: hover.x + 16 + 270 > window.innerWidth ? Math.max(8, hover.x - 16 - 270) : hover.x + 16,
            top: Math.max(8, Math.min(hover.y + 16, window.innerHeight - (hover.iso3 ? 375 : 80))),
          }}
        >
          <div className="text-sm font-semibold leading-tight">{hover.name}</div>
          {hover.iso3 ? (
            <>
              <div className="mt-1.5 rounded-lg bg-white/5 px-2 py-1.5">
                <div className="text-[10px] text-white/50">
                  {ind.short} · {yearLabel(ind, year)}
                  {isProjected(ind, year) && <span className="text-amber-300/80"> · proyección</span>}
                </div>
                <div className="flex items-center gap-1.5 text-base font-bold tabular-nums">
                  <span
                    className="inline-block w-3 h-3 rounded-sm shrink-0"
                    style={{ background: colorFor(ind, "cover", valueAt(ind, hoverSeries, year)) }}
                  />
                  {hoverSeries ? fmtValue(ind, valueAt(ind, hoverSeries, year)) : "Sin datos"}
                </div>
                {hoverSeries && from !== year && (
                  <div className="text-[11px] text-white/70">
                    Cambio desde {yearLabel(ind, from)}:{" "}
                    <span className={`tabular-nums font-medium ${changeTone(ind, hoverChange) || "text-white"}`}>
                      {fmtChange(ind, hoverChange)}
                    </span>
                  </div>
                )}
                <AreaLine ind={ind} iso3={hover.iso3} from={from} year={year} />
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-white/40">Todos los indicadores</div>
              <FichaRows iso3={hover.iso3} active={ind} year={year} compact />
              <div className="mt-1.5 text-[10px] text-white/40">Clic para ver la evolución · cambios desde el inicio de cada serie</div>
            </>
          ) : (
            <div className="text-white/60">Sin datos</div>
          )}
        </div>
      )}

      {/* Columna superior: navegación por temas + panel */}
      <div className="absolute z-20 top-3 left-3 right-3 bottom-[150px] sm:bottom-[100px] flex flex-col gap-2 pointer-events-none">
        <header className="pointer-events-auto mr-12 sm:mr-14 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 px-3 sm:px-4 py-2.5 flex flex-col lg:flex-row lg:items-center gap-x-5 gap-y-2">
          <div className="shrink-0">
            <h1 className="text-base sm:text-lg font-bold leading-tight">Observatorio Ambiental Global</h1>
            <p className="text-[11px] sm:text-xs text-white/60">Bosques, biodiversidad y clima por país</p>
          </div>
          <nav aria-label="Indicadores" className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-2">
            <div role="tablist" aria-label="Tema" className="flex shrink-0 rounded-full bg-white/10 p-0.5 text-xs self-start">
              {GROUPS.map(g => (
                <button
                  key={g}
                  role="tab"
                  aria-selected={ind.group === g}
                  title={g}
                  onClick={() => ind.group !== g && changeIndicator(INDICATORS.find(i => i.group === g)!.id)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                    ind.group === g ? "bg-emerald-500 text-white shadow" : "text-white/70 hover:text-white"
                  }`}
                >
                  {GROUP_ICONS[g]}
                  {GROUP_SHORT[g] ?? g}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto min-w-0 [scrollbar-width:none]">
              {INDICATORS.filter(i => i.group === ind.group).map(i => (
                <button
                  key={i.id}
                  aria-pressed={i.id === ind.id}
                  onClick={() => changeIndicator(i.id)}
                  title={i.name}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors ${
                    i.id === ind.id
                      ? "bg-white text-gray-900 border-white font-medium"
                      : "border-white/20 text-white/75 hover:text-white hover:border-white/50"
                  }`}
                >
                  {i.short}
                </button>
              ))}
            </div>
          </nav>
        </header>

      {/* Panel lateral */}
      <aside
        className={`pointer-events-auto w-[min(340px,100%)] min-h-0 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 p-4 ${
          panelOpen || selected ? "overflow-y-auto" : "h-[52px] shrink-0 overflow-hidden"
        }`}
      >
        {selected ? (
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h2 className="text-lg font-bold leading-tight">{selected.name}</h2>
                <div className="text-[11px] text-white/50">
                  {selected.iso3} · {ind.short}
                </div>
              </div>
              <button
                aria-label="Cerrar país"
                onClick={() => setSelectedIso(null)}
                className="rounded-full p-1.5 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {selectedSeries ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat
                    label={
                      <>
                        {yearLabel(ind, year)}
                        {isProjected(ind, year) && " (proy.)"}
                      </>
                    }
                  >
                    {fmtValue(ind, valueAt(ind, selectedSeries, year))}
                  </Stat>
                  <Stat label={`Cambio desde ${yearLabel(ind, from)}`}>
                    {(() => {
                      const v = changeBetween(ind, selectedSeries, from, year)
                      return <span className={changeTone(ind, v)}>{fmtChange(ind, v)}</span>
                    })()}
                  </Stat>
                  <Stat label="Posición (de mayor a menor)">
                    {rank >= 0 ? (
                      <>
                        {rank + 1}.º <span className="text-xs font-normal text-white/50">de {summary.current.length}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </Stat>
                </div>
                <AreaLine ind={ind} iso3={selected.iso3} from={from} year={year} />
                <TrendChart
                  indicator={ind}
                  year={year}
                  baseYear={mode === "change" ? baseYear : undefined}
                  series={[
                    { label: selected.name, values: selectedSeries, color: "#4ade80" },
                    ...(compareSeries
                      ? [{ label: COUNTRIES[compareIso].name, values: compareSeries, color: "#60a5fa" }]
                      : []),
                    ...(ind.world
                      ? [{ label: "Mundo", values: ind.world, color: "rgba(255,255,255,0.55)", dashed: true }]
                      : []),
                  ]}
                />
                <label className="block text-xs text-white/60">
                  Comparar con
                  <select
                    value={compareIso}
                    onChange={e => setCompareIso(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-sm text-white"
                  >
                    <option value="" className="bg-gray-900">
                      — Ninguno —
                    </option>
                    {COUNTRY_LIST.filter(c => c.iso3 !== selected.iso3 && ind.values[c.iso3]).map(c => (
                      <option key={c.iso3} value={c.iso3} className="bg-gray-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <p className="text-xs text-white/60 rounded-lg bg-white/5 p-2">
                No hay datos de este indicador para {selected.name}.
              </p>
            )}

            {/* Ficha con todos los indicadores del país */}
            <div>
              <div className="text-xs font-medium text-white/80 mb-1">Ficha ambiental</div>
              <FichaRows iso3={selected.iso3} active={ind} year={year} onPick={changeIndicator} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              className="w-full flex justify-between items-center text-left"
              onClick={() => setPanelOpen(o => !o)}
              aria-expanded={panelOpen}
            >
              <h2 className="text-sm font-semibold">Panorama mundial</h2>
              <ChevronDown className={`h-4 w-4 transition-transform ${panelOpen ? "rotate-180" : ""}`} />
            </button>
            <p className="text-[11px] text-white/60 leading-snug">{ind.description}</p>
            <div className="grid grid-cols-2 gap-2">
              {ind.world ? (
                <Stat
                  label={
                    <>
                      Mundo · {yearLabel(ind, year)}
                      {isProjected(ind, year) && " (proy.)"}
                    </>
                  }
                >
                  {fmtValue(ind, valueAt(ind, ind.world, year))}
                </Stat>
              ) : (
                <Stat
                  label={
                    <>
                      Mediana de países · {yearLabel(ind, year)}
                      {isProjected(ind, year) && " (proy.)"}
                    </>
                  }
                >
                  {fmtValue(ind, summary.median)}
                </Stat>
              )}
              <Stat label={`Países que bajan / suben desde ${yearLabel(ind, from)}`}>
                {from === year ? (
                  "—"
                ) : (
                  <>
                    <span className={ind.higherIsBetter ? "text-red-300" : "text-emerald-300"}>{summary.fallCount}</span>
                    <span className="text-white/40"> / </span>
                    <span className={ind.higherIsBetter ? "text-emerald-300" : "text-red-300"}>{summary.riseCount}</span>
                  </>
                )}
              </Stat>
            </div>
            {ind.worldArea && (
              <div className="text-[11px] text-white/70 leading-snug">
                Bosque mundial:{" "}
                <span className="text-white tabular-nums">{fmtArea(valueAt(ind, ind.worldArea, year))}</span>
                {from !== year &&
                  (() => {
                    const d = changeBetween(ind, ind.worldArea, from, year)
                    return d === null ? null : (
                      <>
                        {" · "}
                        <span className={`tabular-nums ${d < 0 ? "text-red-300" : "text-emerald-300"}`}>
                          {d < 0 ? "perdió" : "ganó"} {fmtArea(Math.abs(d))}
                        </span>{" "}
                        desde {yearLabel(ind, from)}
                      </>
                    )
                  })()}
              </div>
            )}
            <div className="sm:hidden">
              <Legend ind={ind} mode={mode} year={year} baseYear={baseYear} />
            </div>
            {ind.world && (
              <TrendChart
                indicator={ind}
                year={year}
                baseYear={mode === "change" ? baseYear : undefined}
                height={130}
                series={[
                  { label: "Mundo", values: ind.world, color: "#4ade80" },
                  ...(region ? [{ label: region.name, values: region.values, color: "#60a5fa" }] : []),
                ]}
              />
            )}
            {ind.regions && region && (
              <select
                value={region.code}
                onChange={e => setRegionCode(e.target.value)}
                aria-label="Región a comparar"
                className="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-sm text-white"
              >
                {ind.regions.map(r => (
                  <option key={r.code} value={r.code} className="bg-gray-900">
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            {mode === "cover" ? (
              <>
                <RankList
                  title={`Valores más altos · ${yearLabel(ind, year)}`}
                  items={summary.current.slice(0, 5).map(c => ({ iso3: c.iso3, text: fmtValue(ind, c.v), tone: "" }))}
                  icon={<TrendingUp className="h-3.5 w-3.5 text-white/60" />}
                  onPick={select}
                />
                <RankList
                  title={`Valores más bajos · ${yearLabel(ind, year)}`}
                  items={summary.current
                    .slice(-5)
                    .reverse()
                    .map(c => ({ iso3: c.iso3, text: fmtValue(ind, c.v), tone: "" }))}
                  icon={<TrendingDown className="h-3.5 w-3.5 text-white/60" />}
                  onPick={select}
                />
              </>
            ) : (
              <>
                <RankList
                  title={`Mayores bajadas · ${yearLabel(ind, from)} → ${yearLabel(ind, year)}`}
                  items={summary.falls.map(c => ({ iso3: c.iso3, text: fmtChange(ind, c.v), tone: changeTone(ind, c.v) }))}
                  icon={<TrendingDown className={`h-3.5 w-3.5 ${ind.higherIsBetter ? "text-red-300" : "text-emerald-300"}`} />}
                  onPick={select}
                />
                <RankList
                  title={`Mayores subidas · ${yearLabel(ind, from)} → ${yearLabel(ind, year)}`}
                  items={summary.rises.map(c => ({ iso3: c.iso3, text: fmtChange(ind, c.v), tone: changeTone(ind, c.v) }))}
                  icon={<TrendingUp className={`h-3.5 w-3.5 ${ind.higherIsBetter ? "text-emerald-300" : "text-red-300"}`} />}
                  onPick={select}
                />
              </>
            )}
            {ind.note && <p className="text-[11px] text-white/45 leading-snug">{ind.note}</p>}
            <p className="text-[11px] text-white/45">Haz clic en un país para ver su evolución y su ficha ambiental.</p>
          </div>
        )}
      </aside>
      </div>

      {/* Leyenda + capas */}
      <div className="absolute z-20 right-3 bottom-[132px] sm:bottom-[104px] rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 p-3 space-y-3 hidden sm:block">
        <Legend ind={ind} mode={mode} year={year} baseYear={baseYear} />
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Layers className="h-3.5 w-3.5" /> Mapa base
          <Segmented
            label="Mapa base"
            value={basemap}
            onChange={setBasemap}
            options={[
              { value: "none", label: "Ninguno" },
              { value: "osm", label: "OpenStreetMap" },
            ]}
          />
        </div>
      </div>

      {/* Línea de tiempo */}
      <div className="absolute z-20 bottom-3 left-3 right-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-4xl rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              onClick={() => (playing ? setPlaying(false) : startPlay())}
              aria-label={playing ? "Pausar animación" : "Reproducir animación"}
              className="h-10 w-10 shrink-0 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <div className="min-w-[4.5rem] leading-none">
              <div className={`font-bold tabular-nums ${ind.yearLabels ? "text-xl" : "text-3xl"}`}>
                {yearLabel(ind, year)}
              </div>
              {yearStatus && <div className={`text-[10px] mt-0.5 ${yearStatus.cls}`}>{yearStatus.text}</div>}
            </div>
            <div className="flex-1 min-w-[180px]">
              <input
                type="range"
                min={0}
                max={years.length - 1}
                step={1}
                value={yearIdx}
                onChange={e => {
                  setPlaying(false)
                  setYear(years[Number(e.target.value)])
                }}
                aria-label="Año"
                aria-valuetext={yearLabel(ind, year)}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-white/50 tabular-nums">
                {ticks.map(y => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={`hover:text-white ${
                      years.length <= 6 || y % (tickStep * 2) === 0 || y === lastYear ? "" : "hidden sm:inline"
                    } ${isProjected(ind, y) ? "text-amber-300/80" : ""}`}
                    title={isProjected(ind, y) ? "Proyección" : undefined}
                  >
                    {yearLabel(ind, y).replace(/^(\d{4})–\d{2}(\d{2})$/, "$1–$2")}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Segmented
                label="Modo de visualización"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "cover", label: "Valor" },
                  { value: "change", label: "Cambio" },
                ]}
              />
              {mode === "change" && (
                <label className="text-xs text-white/70 flex items-center gap-1">
                  desde
                  <select
                    value={baseYear}
                    onChange={e => setBaseYear(Number(e.target.value))}
                    className="rounded-md bg-white/10 border border-white/10 px-1.5 py-1 text-white text-xs"
                  >
                    {years
                      .filter(y => y < year)
                      .map(y => (
                        <option key={y} value={y} className="bg-gray-900">
                          {yearLabel(ind, y)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <button
                onClick={() => setShowInfo(s => !s)}
                aria-label="Información sobre los datos"
                className="rounded-full p-2 hover:bg-white/10"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Información de fuentes */}
      {showInfo && (
        <div
          className="absolute z-40 inset-0 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="max-w-2xl max-h-[85dvh] overflow-y-auto rounded-2xl bg-[#0b1220] border border-white/10 p-5 text-sm text-white/80 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <h3 className="text-base font-semibold text-white">Sobre los datos</h3>
              <button aria-label="Cerrar" onClick={() => setShowInfo(false)} className="rounded-full p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p>
              Todos los indicadores son series por país de fuentes públicas con licencia abierta. El modo «Valor» muestra
              el dato del año elegido y el modo «Cambio» la diferencia respecto a un año base.
            </p>
            {GROUPS.map(g => (
              <div key={g}>
                <h4 className="text-xs uppercase tracking-wide text-emerald-300/80 mb-1">{g}</h4>
                <dl className="space-y-2">
                  {INDICATORS.filter(i => i.group === g).map(i => (
                    <div key={i.id}>
                      <dt className="font-medium text-white">
                        {i.name}{" "}
                        <span className="font-normal text-white/50 text-xs">
                          · {yearLabel(i, i.years[0]).slice(0, 4)}–{yearLabel(i, i.years[i.years.length - 1]).slice(-4)} ·{" "}
                          {Object.keys(i.values).length} países
                        </span>
                      </dt>
                      <dd className="text-xs text-white/70">
                        {i.description} {i.note}
                        <span className="block text-white/45">Fuente: {i.source}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            <p className="text-xs text-white/60">
              <strong>Mapa:</strong> globo 3D con MapLibre GL, límites de Natural Earth (world-atlas) y, opcionalmente,
              teselas de © OpenStreetMap oscurecidas.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
