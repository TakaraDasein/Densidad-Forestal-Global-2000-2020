import { useEffect, useMemo, useState } from "react"
import GlobeViz, { type Basemap } from "./GlobeViz"
import Particles from "./Particles"
import TrendChart from "./TrendChart"
import {
  CHANGE_STOPS,
  COUNTRIES,
  COVER_STOPS,
  FIRST_YEAR,
  LAST_OFFICIAL_YEAR,
  LAST_YEAR,
  NO_DATA_COLOR,
  REFERENCE_YEARS,
  isProjected,
  WORLD,
  YEARS,
  changeBetween,
  colorFor,
  forest,
  fmtPct,
  fmtPp,
  relativeChange,
  valueAt,
  type ViewMode,
} from "@/lib/forest"
import { Info, Layers, Pause, Play, X, TrendingDown, TrendingUp, ChevronDown } from "lucide-react"

const sortedCountries = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, "es"))

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

function Legend({ mode, year, baseYear }: { mode: ViewMode; year: number; baseYear: number }) {
  const stops = mode === "cover" ? COVER_STOPS : CHANGE_STOPS
  const min = stops[0][0]
  const max = stops[stops.length - 1][0]
  const gradient = `linear-gradient(to right, ${stops
    .map(([v, c]) => `${c} ${((v - min) / (max - min)) * 100}%`)
    .join(", ")})`
  const ticks = mode === "cover" ? [0, 30, 60, 90] : [-15, -8, 0, 8, 15]
  return (
    <div className="w-64">
      <div className="text-xs font-medium text-white/90 mb-1.5">
        {mode === "cover"
          ? `Cobertura forestal ${year} (% del territorio)`
          : `Cambio ${baseYear}→${year} (puntos porcentuales)`}
        {isProjected(year) && <span className="text-amber-300"> · proyección</span>}
      </div>
      <div className="h-2.5 rounded-full" style={{ background: gradient }} />
      <div className="relative h-4 text-[10px] text-white/60 mt-0.5">
        {ticks.map(t => (
          <span
            key={t}
            className="absolute -translate-x-1/2 tabular-nums"
            style={{ left: `${((t - min) / (max - min)) * 100}%` }}
          >
            {mode === "cover" ? (t === 90 ? "90+" : t) : t > 0 ? `+${t}` : t}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-white/60">
        <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: NO_DATA_COLOR }} /> Sin datos
      </div>
    </div>
  )
}

function RankList({
  title,
  items,
  icon,
}: {
  title: string
  items: { iso3: string; name: string; v: number }[]
  icon: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/80 mb-1">
        {icon}
        {title}
      </div>
      <ol className="space-y-0.5 text-xs">
        {items.map((it, i) => (
          <li key={it.iso3} className="flex justify-between gap-2">
            <span className="text-white/70 truncate">
              {i + 1}. {it.name}
            </span>
            <span className={`tabular-nums ${it.v < 0 ? "text-red-300" : "text-emerald-300"}`}>{fmtPp(it.v)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function ForestDensityApp() {
  const [year, setYear] = useState(LAST_OFFICIAL_YEAR)
  const [baseYear, setBaseYear] = useState(FIRST_YEAR)
  const [mode, setMode] = useState<ViewMode>("cover")
  const [basemap, setBasemap] = useState<Basemap>("osm")
  const [playing, setPlaying] = useState(false)
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [compareIso, setCompareIso] = useState<string>("")
  const [regionCode, setRegionCode] = useState("LCN")
  const [hover, setHover] = useState<{ iso3: string | null; name: string; x: number; y: number } | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 640)

  // Animación temporal
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setYear(y => {
        if (y >= LAST_YEAR) {
          setPlaying(false)
          return y
        }
        return y + 1
      })
    }, 450)
    return () => clearInterval(id)
  }, [playing])

  useEffect(() => {
    if (baseYear >= year && mode === "change") setBaseYear(FIRST_YEAR)
  }, [year, baseYear, mode])

  const selected = selectedIso ? forest.countries[selectedIso] : null
  const compare = compareIso ? forest.countries[compareIso] : null
  const region = forest.regions.find(r => r.code === regionCode)!

  const ranking = useMemo(() => {
    const from = baseYear < year ? baseYear : FIRST_YEAR
    const list = COUNTRIES.map(c => ({ iso3: c.iso3, name: c.name, v: changeBetween(c, from, year) })).filter(
      (c): c is { iso3: string; name: string; v: number } => c.v !== null,
    )
    list.sort((a, b) => a.v - b.v)
    return {
      from,
      losses: list.slice(0, 5),
      gains: list.slice(-5).reverse(),
      lossCount: list.filter(c => c.v < -0.05).length,
      gainCount: list.filter(c => c.v > 0.05).length,
    }
  }, [baseYear, year])

  const hovered = hover?.iso3 ? forest.countries[hover.iso3] : null
  const hoverValue = hovered
    ? mode === "cover"
      ? fmtPct(valueAt(hovered, year))
      : fmtPp(changeBetween(hovered, baseYear, year))
    : "Sin datos"

  const startPlay = () => {
    if (year >= LAST_YEAR) setYear(mode === "change" ? baseYear + 1 : FIRST_YEAR)
    setPlaying(true)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#02060d] text-white">
      <Particles />

      <GlobeViz
        year={year}
        baseYear={baseYear}
        mode={mode}
        basemap={basemap}
        selectedIso={selectedIso}
        onSelect={iso => {
          setSelectedIso(iso)
          if (iso) setPanelOpen(true)
        }}
        onHover={setHover}
      />

      {/* Tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-30 rounded-lg bg-black/80 border border-white/10 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <div className="font-medium">
            {hover.name}
            {isProjected(year) && <span className="text-amber-300/80 font-normal"> · proyección {year}</span>}
          </div>
          <div className="flex items-center gap-1.5 text-white/80 tabular-nums">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{
                background: hovered
                  ? colorFor(mode, mode === "cover" ? valueAt(hovered, year) : changeBetween(hovered, baseYear, year))
                  : NO_DATA_COLOR,
              }}
            />
            {hoverValue}
          </div>
        </div>
      )}

      {/* Cabecera */}
      <header className="absolute top-3 left-3 right-16 sm:right-auto z-20 pointer-events-none">
        <div className="pointer-events-auto inline-block rounded-2xl bg-black/45 backdrop-blur-md border border-white/10 px-4 py-2.5">
          <h1 className="text-lg sm:text-xl font-bold leading-tight">Densidad Forestal Global</h1>
          <p className="text-xs text-white/60">
            Superficie forestal por país · {FIRST_YEAR}–{LAST_YEAR}
            <span className="hidden sm:inline"> · FAO FRA 2025</span>
          </p>
        </div>
      </header>

      {/* Panel lateral */}
      <aside
        className={`absolute z-20 left-3 top-[86px] w-[min(340px,calc(100vw-72px))] rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 p-4 ${
          panelOpen || selected ? "max-h-[calc(100dvh-260px)] overflow-y-auto" : "max-h-[52px] overflow-hidden"
        }`}
      >
        {selected ? (
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h2 className="text-lg font-bold leading-tight">{selected.name}</h2>
                <div className="text-[11px] text-white/50">{selected.iso3}</div>
              </div>
              <button
                aria-label="Cerrar país"
                onClick={() => setSelectedIso(null)}
                className="rounded-full p-1.5 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-[10px] text-white/50">
                  Cobertura {year}
                  {isProjected(year) && " (proy.)"}
                </div>
                <div className="text-lg font-bold tabular-nums">{fmtPct(valueAt(selected, year))}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-[10px] text-white/50">
                  Cambio {baseYear < year ? baseYear : FIRST_YEAR}–{year}
                </div>
                {(() => {
                  const from = baseYear < year ? baseYear : FIRST_YEAR
                  const v = changeBetween(selected, from, year)
                  return (
                    <div
                      className={`text-lg font-bold tabular-nums ${
                        v === null ? "" : v < -0.05 ? "text-red-300" : v > 0.05 ? "text-emerald-300" : ""
                      }`}
                    >
                      {fmtPp(v)}
                    </div>
                  )
                })()}
              </div>
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-[10px] text-white/50">Variación relativa</div>
                <div className="text-lg font-bold tabular-nums">
                  {(() => {
                    const v = relativeChange(selected, baseYear < year ? baseYear : FIRST_YEAR, year)
                    return v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
                  })()}
                </div>
              </div>
            </div>
            <TrendChart
              year={year}
              baseYear={mode === "change" ? baseYear : undefined}
              series={[
                { label: selected.name, values: selected.values, color: "#4ade80" },
                ...(compare && compare.iso3 !== selected.iso3
                  ? [{ label: compare.name, values: compare.values, color: "#60a5fa" }]
                  : []),
                { label: "Mundo", values: WORLD.values, color: "rgba(255,255,255,0.55)", dashed: true },
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
                {sortedCountries
                  .filter(c => c.iso3 !== selected.iso3)
                  .map(c => (
                    <option key={c.iso3} value={c.iso3} className="bg-gray-900">
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
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
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-[10px] text-white/50">
                  Mundo {year}
                  {isProjected(year) && " (proy.)"}
                </div>
                <div className="text-lg font-bold tabular-nums">{fmtPct(valueAt(WORLD, year))}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-[10px] text-white/50">
                  Países que pierden / ganan ({ranking.from}–{year})
                </div>
                <div className="text-lg font-bold tabular-nums">
                  <span className="text-red-300">{ranking.lossCount}</span>
                  <span className="text-white/40"> / </span>
                  <span className="text-emerald-300">{ranking.gainCount}</span>
                </div>
              </div>
            </div>
            <TrendChart
              year={year}
              baseYear={mode === "change" ? baseYear : undefined}
              height={130}
              series={[
                { label: "Mundo", values: WORLD.values, color: "#4ade80" },
                { label: region.name, values: region.values, color: "#60a5fa" },
              ]}
            />
            <select
              value={regionCode}
              onChange={e => setRegionCode(e.target.value)}
              aria-label="Región a comparar"
              className="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-sm text-white"
            >
              {forest.regions
                .filter(r => r.code !== "WLD")
                .map(r => (
                  <option key={r.code} value={r.code} className="bg-gray-900">
                    {r.name}
                  </option>
                ))}
            </select>
            <RankList
              title={`Mayores pérdidas ${ranking.from}–${year}`}
              items={ranking.losses}
              icon={<TrendingDown className="h-3.5 w-3.5 text-red-300" />}
            />
            <RankList
              title={`Mayores ganancias ${ranking.from}–${year}`}
              items={ranking.gains}
              icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-300" />}
            />
            <p className="text-[11px] text-white/45">Haz clic en un país del globo para ver su evolución.</p>
          </div>
        )}
      </aside>

      {/* Leyenda + capas */}
      <div className="absolute z-20 right-3 bottom-[132px] sm:bottom-[104px] rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 p-3 space-y-3 hidden sm:block">
        <Legend mode={mode} year={year} baseYear={baseYear} />
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Layers className="h-3.5 w-3.5" /> Mapa base
          <Segmented
            label="Mapa base"
            value={basemap}
            onChange={setBasemap}
            options={[
              { value: "osm", label: "OpenStreetMap" },
              { value: "none", label: "Ninguno" },
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
            <div className="w-[4.5rem] leading-none">
              <div className="text-3xl font-bold tabular-nums">{year}</div>
              {isProjected(year) ? (
                <div className="text-[10px] uppercase tracking-wide text-amber-300 mt-0.5">Proyección</div>
              ) : !REFERENCE_YEARS.includes(year) ? (
                <div className="text-[10px] text-white/45 mt-0.5">interpolado</div>
              ) : (
                <div className="text-[10px] text-emerald-300/80 mt-0.5">dato FAO</div>
              )}
            </div>
            <div className="flex-1 min-w-[180px]">
              <input
                type="range"
                min={FIRST_YEAR}
                max={LAST_YEAR}
                step={1}
                value={year}
                onChange={e => {
                  setPlaying(false)
                  setYear(Number(e.target.value))
                }}
                aria-label="Año"
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-white/50 tabular-nums">
                {YEARS.filter(y => y % 5 === 0 || y === LAST_YEAR).map(y => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={`hover:text-white ${y % 10 === 0 || y === LAST_YEAR ? "" : "hidden sm:inline"} ${
                      isProjected(y) ? "text-amber-300/80" : ""
                    }`}
                    title={isProjected(y) ? "Proyección" : undefined}
                  >
                    {y}
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
                  { value: "cover", label: "Cobertura" },
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
                    {YEARS.filter(y => y < year).map(y => (
                      <option key={y} value={y} className="bg-gray-900">
                        {y}
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
        <div className="absolute z-40 inset-0 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInfo(false)}>
          <div
            className="max-w-lg rounded-2xl bg-[#0b1220] border border-white/10 p-5 text-sm text-white/80 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <h3 className="text-base font-semibold text-white">Sobre los datos</h3>
              <button aria-label="Cerrar" onClick={() => setShowInfo(false)} className="rounded-full p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p>
              <strong>Indicador:</strong> superficie forestal como porcentaje de la superficie terrestre de cada país,
              serie anual {FIRST_YEAR}–{LAST_YEAR} para {COUNTRIES.length} países y territorios.
            </p>
            <p>
              <strong>Fuente:</strong> FAO, <em>Evaluación de los Recursos Forestales Mundiales 2025</em> (FRA 2025),
              datos de la plataforma FRA descargados el {forest.meta.lastUpdated}. Superficie terrestre: Banco Mundial
              (WDI).
            </p>
            <p>
              La FAO publica cifras para los años de referencia {REFERENCE_YEARS.join(", ")}. Los años intermedios se
              interpolan linealmente.{" "}
              <span className="text-amber-300">
                {LAST_YEAR} es una proyección
              </span>{" "}
              que prolonga la tendencia {REFERENCE_YEARS[REFERENCE_YEARS.length - 2]}–{LAST_OFFICIAL_YEAR} de cada país:
              todavía no existen datos oficiales para ese año.
            </p>
            <p>
              <strong>Modo «Cambio»:</strong> diferencia en puntos porcentuales de cobertura entre el año base y el año
              seleccionado. La «variación relativa» compara la superficie forestal de ambos años.
            </p>
            <p>
              <strong>Mapa:</strong> globo 3D con MapLibre GL, teselas de © OpenStreetMap y límites de Natural Earth
              (world-atlas).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
