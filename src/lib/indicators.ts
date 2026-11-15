import dataJson from "@/data/indicators.json"

export interface Country {
  iso3: string
  numeric: string | null
  name: string
}

type Series = (number | null)[]

interface IndicatorData {
  id: string
  years: number[]
  yearLabels?: string[]
  referenceYears?: number[]
  projectedYears?: number[]
  vintage?: string
  world: Series | null
  regions?: { code: string; name: string; values: Series }[]
  values: Record<string, Series>
  /** Solo cobertura forestal: superficie de bosque en miles de hectáreas */
  area?: Record<string, Series>
  worldArea?: Series
}

export type Stops = [number, string][]

interface IndicatorDef {
  group: string
  name: string
  /** Etiqueta corta para tarjetas y listas */
  short: string
  unit: string
  /** Unidad de las diferencias entre dos años */
  changeUnit: string
  decimals: number
  /** true si un valor más alto es mejor para el medio ambiente */
  higherIsBetter: boolean
  stops: Stops
  /** Magnitud del cambio que satura la escala divergente */
  changeMax: number
  defaultYear?: number
  description: string
  source: string
  note?: string
}

export interface Indicator extends IndicatorData, IndicatorDef {}

export type ViewMode = "cover" | "change"

const DEFS: Record<string, IndicatorDef> = {
  forest_cover: {
    group: "Bosques y ecosistemas",
    name: "Cobertura forestal",
    short: "Cobertura forestal",
    unit: "%",
    changeUnit: "pp",
    decimals: 1,
    higherIsBetter: true,
    stops: [
      [0, "#fbf8d8"],
      [5, "#e8f2b0"],
      [15, "#c4e391"],
      [30, "#8fcb73"],
      [45, "#58ad5a"],
      [60, "#2f8a46"],
      [75, "#166836"],
      [90, "#0a4a26"],
    ],
    changeMax: 15,
    defaultYear: 2025,
    description: "Superficie de bosque como porcentaje de la superficie terrestre del país.",
    source: "FAO, Evaluación de los Recursos Forestales Mundiales 2025 (FRA 2025); superficie terrestre: Banco Mundial.",
    note: "La FAO mide 1990, 2000, 2010, 2015, 2020 y 2025; los años intermedios se interpolan y 2026 es una proyección de la tendencia 2020–2025.",
  },
  primary_forest_loss: {
    group: "Bosques y ecosistemas",
    name: "Pérdida de bosque primario tropical",
    short: "Pérdida de bosque primario",
    unit: "mil ha",
    changeUnit: "mil ha",
    decimals: 1,
    higherIsBetter: false,
    stops: [
      [0, "#fff7e0"],
      [1, "#fde3a7"],
      [10, "#fbbf6b"],
      [50, "#f58a47"],
      [200, "#dd4f37"],
      [800, "#a81f2e"],
      [2500, "#5c0a1c"],
    ],
    changeMax: 400,
    description:
      "Miles de hectáreas de bosque primario tropical húmedo perdidas cada año: bosque natural maduro, el ecosistema terrestre más rico en especies.",
    source: "Global Forest Watch / Universidad de Maryland (Global Forest Change v1.13), vía Environment Dashboard.",
    note: "Solo cubre los países con bosque tropical húmedo; el resto aparece sin datos. Incluye pérdidas por incendios.",
  },
  red_list_index: {
    group: "Biodiversidad",
    name: "Índice de la Lista Roja (riesgo de extinción de especies)",
    short: "Índice de la Lista Roja",
    unit: "",
    changeUnit: "",
    decimals: 2,
    higherIsBetter: true,
    stops: [
      [0.4, "#5c0a1c"],
      [0.6, "#b8323f"],
      [0.72, "#ec7f55"],
      [0.82, "#f8cf82"],
      [0.9, "#e3eaa0"],
      [0.95, "#a5d48c"],
      [1, "#3f9e52"],
    ],
    changeMax: 0.15,
    description:
      "Mide el riesgo de extinción agregado de las especies de cada país: 1 significa que ninguna especie está amenazada y 0 que todas se han extinguido. Si baja, las especies se acercan a la extinción.",
    source: "Naciones Unidas, indicador ODS 15.5.1 (UICN y BirdLife International), vía Our World in Data.",
  },
  kba_protected: {
    group: "Biodiversidad",
    name: "Áreas clave de biodiversidad protegidas",
    short: "Áreas clave protegidas",
    unit: "%",
    changeUnit: "pp",
    decimals: 1,
    higherIsBetter: true,
    stops: [
      [0, "#f4efdc"],
      [15, "#d3e8c2"],
      [30, "#a3d9c0"],
      [45, "#63c1c1"],
      [60, "#3a9fc0"],
      [80, "#2b72b0"],
      [100, "#243f8f"],
    ],
    changeMax: 50,
    description:
      "Porcentaje medio de cada área clave para la biodiversidad terrestre del país que está cubierto por áreas protegidas.",
    source: "Naciones Unidas, indicador ODS 15.1.2 (BirdLife International, UICN y PNUMA-WCMC), vía Our World in Data.",
  },
  temp_change: {
    group: "Clima",
    name: "Cambio de temperatura observado",
    short: "Cambio de temperatura",
    unit: "°C",
    changeUnit: "°C",
    decimals: 2,
    higherIsBetter: false,
    stops: [
      [-1.5, "#2c6aab"],
      [-0.5, "#93c4de"],
      [0, "#f2f2f2"],
      [0.5, "#fbd9c4"],
      [1, "#f3a481"],
      [1.5, "#d75f4c"],
      [2.2, "#b1182b"],
      [3, "#67001f"],
    ],
    changeMax: 2.5,
    description:
      "Diferencia de la temperatura media anual en la superficie terrestre del país respecto al promedio de 1951–1980.",
    source: "FAO, FAOSTAT «Temperature change on land» (datos GISTEMP de NASA-GISS).",
    note: "Cada año refleja también la variabilidad natural (El Niño, etc.), por eso la serie oscila.",
  },
  projected_warming: {
    group: "Clima",
    name: "Calentamiento proyectado",
    short: "Calentamiento proyectado",
    unit: "°C",
    changeUnit: "°C",
    decimals: 1,
    higherIsBetter: false,
    stops: [
      [0.3, "#fff9c9"],
      [0.8, "#fee08a"],
      [1.3, "#fdb05a"],
      [1.8, "#f67a3c"],
      [2.5, "#dc3b28"],
      [3.5, "#a8102a"],
      [5, "#5c0a1c"],
    ],
    changeMax: 2.5,
    defaultYear: 2050,
    description:
      "Grados de calentamiento respecto al promedio de 1995–2014, proyectados por periodos de 20 años con emisiones intermedias (escenario SSP2-4.5).",
    source: "Banco Mundial, Climate Change Knowledge Portal (conjunto de modelos CMIP6), vía Environment Dashboard.",
    note: "Mediana de los modelos, promediada sobre el territorio del país. Es una proyección, no una observación.",
  },
  hot_days_35: {
    group: "Clima",
    name: "Días de calor extremo (≥ 35 °C)",
    short: "Días ≥ 35 °C al año",
    unit: "días",
    changeUnit: "días",
    decimals: 0,
    higherIsBetter: false,
    stops: [
      [0, "#fffbd6"],
      [5, "#fee79b"],
      [20, "#fdc15c"],
      [50, "#f58d34"],
      [100, "#d9591a"],
      [180, "#9c3409"],
      [260, "#4f1a05"],
    ],
    changeMax: 60,
    defaultYear: 2050,
    description:
      "Días al año con temperatura máxima de 35 °C o más: simulación de 1995–2014 y proyección por periodos de 20 años con emisiones intermedias (SSP2-4.5).",
    source: "Banco Mundial, Climate Change Knowledge Portal (conjunto de modelos CMIP6), vía Environment Dashboard.",
    note: "Mediana de los modelos, promediada sobre el territorio del país. El periodo 1995–2014 es una simulación, no una observación.",
  },
  dry_spell: {
    group: "Clima",
    name: "Sequía: racha seca más larga",
    short: "Racha seca más larga",
    unit: "días",
    changeUnit: "días",
    decimals: 0,
    higherIsBetter: false,
    stops: [
      [5, "#f8f0d8"],
      [12, "#ecd9a5"],
      [20, "#dcbb73"],
      [35, "#c7964a"],
      [60, "#a8702c"],
      [120, "#7a4a16"],
      [250, "#44260a"],
    ],
    changeMax: 15,
    defaultYear: 2050,
    description:
      "Número máximo de días consecutivos sin lluvia al año: simulación de 1995–2014 y proyección por periodos de 20 años con emisiones intermedias (SSP2-4.5).",
    source: "Banco Mundial, Climate Change Knowledge Portal (conjunto de modelos CMIP6), vía Environment Dashboard.",
    note: "Mediana de los modelos, promediada sobre el territorio del país. El periodo 1995–2014 es una simulación, no una observación.",
  },
}

const raw = dataJson as unknown as { countries: Record<string, Country>; indicators: IndicatorData[] }

export const COUNTRIES = raw.countries
export const COUNTRY_LIST = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name, "es"))
export const COUNTRY_BY_NUMERIC = new Map(
  COUNTRY_LIST.filter(c => c.numeric).map(c => [c.numeric as string, c]),
)

export const INDICATORS: Indicator[] = raw.indicators.filter(d => DEFS[d.id]).map(d => ({ ...d, ...DEFS[d.id] }))
export const INDICATOR_BY_ID = new Map(INDICATORS.map(i => [i.id, i]))
export const GROUPS = [...new Set(INDICATORS.map(i => i.group))]

// ---------------------------------------------------------------- años
export const isProjected = (ind: Indicator, y: number) => ind.projectedYears?.includes(y) ?? false
export const yearLabel = (ind: Indicator, y: number) => ind.yearLabels?.[ind.years.indexOf(y)] ?? String(y)
export const lastOfficialYear = (ind: Indicator) =>
  [...ind.years].reverse().find(y => !isProjected(ind, y)) ?? ind.years[ind.years.length - 1]
export const defaultYear = (ind: Indicator) => ind.defaultYear ?? lastOfficialYear(ind)
export const nearestYear = (ind: Indicator, y: number) =>
  ind.years.reduce((best, cur) => (Math.abs(cur - y) < Math.abs(best - y) ? cur : best), ind.years[0])

// ---------------------------------------------------------------- valores
export const valueAt = (ind: Indicator, s: Series | null | undefined, year: number) =>
  s?.[ind.years.indexOf(year)] ?? null

export const changeBetween = (ind: Indicator, s: Series | null | undefined, from: number, to: number) => {
  const a = valueAt(ind, s, from)
  const b = valueAt(ind, s, to)
  return a === null || b === null ? null : b - a
}

/** Valor que se pinta en el mapa según el modo */
export const displayValue = (ind: Indicator, mode: ViewMode, s: Series | undefined, baseYear: number, year: number) =>
  mode === "cover" ? valueAt(ind, s, year) : changeBetween(ind, s, baseYear, year)

export const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ---------------------------------------------------------------- color
export const NO_DATA_COLOR = "#3a3f47"

const GOOD = ["#dcefd6", "#93cf8e", "#3f9e52", "#145f2f"]
const BAD = ["#f6e2d6", "#f19c7c", "#d1493f", "#8e1b24"]
const STEPS = [0.035, 0.2, 0.53, 1]

export const changeStops = (ind: Indicator): Stops => {
  const up = ind.higherIsBetter ? GOOD : BAD
  const down = ind.higherIsBetter ? BAD : GOOD
  return [
    ...STEPS.map((s, i): [number, string] => [-s * ind.changeMax, down[i]]).reverse(),
    [0, "#eeeeee"],
    ...STEPS.map((s, i): [number, string] => [s * ind.changeMax, up[i]]),
  ]
}

export const stopsFor = (ind: Indicator, mode: ViewMode) => (mode === "cover" ? ind.stops : changeStops(ind))

const hexToRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))

const interpolateStops = (stops: Stops, v: number) => {
  if (v <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [x0, c0] = stops[i - 1]
      const [x1, c1] = stops[i]
      const t = (v - x0) / (x1 - x0)
      const a = hexToRgb(c0)
      const b = hexToRgb(c1)
      return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * t)).join(",")})`
    }
  }
  return stops[stops.length - 1][1]
}

export const colorFor = (ind: Indicator, mode: ViewMode, v: number | null) =>
  v === null ? NO_DATA_COLOR : interpolateStops(stopsFor(ind, mode), v)

/** Color de texto para un cambio: verde si mejora, rojo si empeora */
export const changeTone = (ind: Indicator, v: number | null) => {
  if (v === null || Math.abs(v) < ind.changeMax * 0.003) return ""
  return v > 0 === ind.higherIsBetter ? "text-emerald-300" : "text-red-300"
}

// ---------------------------------------------------------------- formato
const num = (v: number, d: number) =>
  v.toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d })

const withUnit = (text: string, unit: string) => (unit === "" ? text : unit === "%" ? `${text}%` : `${text} ${unit}`)

// Las cifras grandes no necesitan decimales
const fit = (v: number, d: number) => (Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 100 ? Math.min(d, 1) : d)

export const fmtValue = (ind: Indicator, v: number | null, decimals = ind.decimals) =>
  v === null ? "—" : withUnit(num(v, fit(v, decimals)).replace("-", "−"), ind.unit)

export const fmtChange = (ind: Indicator, v: number | null, decimals = ind.decimals) => {
  if (v === null) return "—"
  const text = num(Math.abs(v), fit(v, decimals))
  const zero = Number(text.replace(/\./g, "").replace(",", ".")) === 0
  return withUnit(`${zero ? "" : v > 0 ? "+" : "−"}${text}`, ind.changeUnit)
}

export const fmtFor = (ind: Indicator, mode: ViewMode, v: number | null) =>
  mode === "cover" ? fmtValue(ind, v) : fmtChange(ind, v)

/** Superficie en miles de ha → texto («486,1 M ha», «35 mil ha») */
export const fmtArea = (kha: number | null, signed = false) => {
  if (kha === null) return "—"
  const abs = Math.abs(kha)
  const sign = signed ? (kha > 0 ? "+" : kha < 0 ? "−" : "") : ""
  if (abs >= 1000) return `${sign}${num(abs / 1000, abs >= 100000 ? 0 : 1)} M ha`
  if (abs >= 1) return `${sign}${num(abs, abs >= 100 ? 0 : 1)} mil ha`
  return `${abs === 0 ? "" : sign}${num(abs * 1000, 0)} ha`
}

/** Año que se muestra de cada indicador en la ficha de un país, dado el año activo */
export const fichaYear = (i: Indicator, active: Indicator, year: number) =>
  i.id === active.id ? year : i.yearLabels || active.yearLabels ? defaultYear(i) : nearestYear(i, Math.min(year, defaultYear(i)))
