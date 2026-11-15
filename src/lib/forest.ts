import forestJson from "@/data/forest_cover.json"

export interface CountrySeries {
  iso3: string
  numeric: string | null
  name: string
  name_en: string
  values: (number | null)[]
}

export interface RegionSeries {
  code: string
  name: string
  values: (number | null)[]
}

export interface ForestDataset {
  meta: {
    indicator: string
    description: string
    source: string
    lastUpdated: string | null
    years: number[]
  }
  regions: RegionSeries[]
  countries: Record<string, CountrySeries>
}

export type ViewMode = "cover" | "change"

export const forest = forestJson as ForestDataset
export const YEARS = forest.meta.years
export const FIRST_YEAR = YEARS[0]
export const LAST_YEAR = YEARS[YEARS.length - 1]
export const COUNTRIES = Object.values(forest.countries)
export const COUNTRY_BY_NUMERIC = new Map(
  COUNTRIES.filter(c => c.numeric).map(c => [c.numeric as string, c]),
)
export const WORLD = forest.regions.find(r => r.code === "WLD")!

export const valueAt = (s: { values: (number | null)[] }, year: number) =>
  s.values[YEARS.indexOf(year)] ?? null

export const changeBetween = (s: { values: (number | null)[] }, from: number, to: number) => {
  const a = valueAt(s, from)
  const b = valueAt(s, to)
  return a === null || b === null ? null : b - a
}

/** Variación relativa de la superficie forestal (%) */
export const relativeChange = (s: { values: (number | null)[] }, from: number, to: number) => {
  const a = valueAt(s, from)
  const b = valueAt(s, to)
  if (a === null || b === null || a === 0) return null
  return ((b - a) / a) * 100
}

export const NO_DATA_COLOR = "#3a3f47"

// Escala secuencial (cobertura, % de superficie terrestre)
export const COVER_STOPS: [number, string][] = [
  [0, "#fbf8d8"],
  [5, "#e8f2b0"],
  [15, "#c4e391"],
  [30, "#8fcb73"],
  [45, "#58ad5a"],
  [60, "#2f8a46"],
  [75, "#166836"],
  [90, "#0a4a26"],
]

// Escala divergente (cambio en puntos porcentuales)
export const CHANGE_STOPS: [number, string][] = [
  [-15, "#8e1b24"],
  [-8, "#d1493f"],
  [-3, "#f19c7c"],
  [-0.5, "#f6e2d6"],
  [0, "#eeeeee"],
  [0.5, "#dcefd6"],
  [3, "#93cf8e"],
  [8, "#3f9e52"],
  [15, "#145f2f"],
]

const interpolateStops = (stops: [number, string][], v: number) => {
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

const hexToRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))

export const colorFor = (mode: ViewMode, v: number | null) =>
  v === null ? NO_DATA_COLOR : interpolateStops(mode === "cover" ? COVER_STOPS : CHANGE_STOPS, v)

export const fmtPct = (v: number | null, digits = 1) =>
  v === null ? "—" : `${v.toLocaleString("es", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`

export const fmtPp = (v: number | null, digits = 1) =>
  v === null
    ? "—"
    : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("es", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })} pp`
