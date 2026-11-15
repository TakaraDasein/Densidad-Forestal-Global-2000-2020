// Genera src/data/forest_cover.json (cobertura forestal, % de la superficie terrestre)
//
// Fuentes (en data-raw/):
//  - FAO, Global Forest Resources Assessment 2025: superficie forestal por país (miles de ha)
//    para los años de referencia 1990, 2000, 2010, 2015, 2020 y 2025.
//  - Banco Mundial, WDI AG.LND.TOTL.K2: superficie terrestre (km²).
//  - Banco Mundial, metadatos de países: región de cada país.
//
// Método:
//  - % = superficie forestal / superficie terrestre × 100 (como el indicador AG.LND.FRST.ZS).
//  - Años intermedios: interpolación lineal entre años de referencia (igual que FAO/Banco Mundial).
//  - Año(s) posteriores al último dato oficial: proyección lineal con la tasa anual 2020–2025.
//    Se marcan como proyección en meta.projectedYears.
//
// Uso: node scripts/build-forest-data.mjs
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const countries = require("i18n-iso-countries")
countries.registerLocale(require("i18n-iso-countries/langs/es.json"))

const FRA_PATH = "data-raw/fao_fra2025_forest_area_kha.json"
const LAND_PATH = "data-raw/API_AG.LND.TOTL.K2_WDI_2025-07-01.csv"
const META_PATH = "data-raw/WDI_country_metadata_2025-07-01.csv"
const OUT_PATH = "src/data/forest_cover.json"
const PROJECT_TO = 2026

function parseCsvLine(line) {
  const out = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ",") { out.push(cur); cur = "" }
    else cur += c
  }
  out.push(cur)
  return out
}

const readCsv = p => fs.readFileSync(p, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean).map(parseCsvLine)

// --- Superficie terrestre: último valor disponible por país (km²)
const landRows = readCsv(LAND_PATH)
const landHeaderIdx = landRows.findIndex(r => r[0] === "Country Name")
const landHeader = landRows[landHeaderIdx]
const land = new Map()
for (const r of landRows.slice(landHeaderIdx + 1)) {
  for (let i = landHeader.length - 1; i >= 4; i--) {
    if (r[i] && Number(r[i]) > 0) { land.set(r[1], Number(r[i])); break }
  }
}

// --- Región de cada país
const region = new Map(readCsv(META_PATH).slice(1).filter(r => r[1]).map(r => [r[0], r[1]]))

// --- FRA 2025
const fra = JSON.parse(fs.readFileSync(FRA_PATH, "utf8"))
const t = fra.table
const forestKha = new Map() // iso3 -> Map(year -> kha)
t.entity.forEach((iso, i) => {
  if (!forestKha.has(iso)) forestKha.set(iso, new Map())
  forestKha.get(iso).set(Number(t.period[i]), t.value[i])
})
const refYears = [...new Set(t.period.map(Number))].sort((a, b) => a - b)
const firstYear = refYears[0]
const lastRef = refYears[refYears.length - 1]
const years = []
for (let y = firstYear; y <= PROJECT_TO; y++) years.push(y)
const projectedYears = years.filter(y => y > lastRef)

/** Serie anual de superficie forestal (miles de ha) a partir de los años de referencia */
function annualSeries(byYear) {
  const pts = refYears.filter(y => byYear.get(y) != null).map(y => [y, byYear.get(y)])
  if (pts.length < 2) return null
  const [pa, pb] = pts.slice(-2)
  const slope = (pb[1] - pa[1]) / (pb[0] - pa[0])
  return years.map(y => {
    if (y < pts[0][0]) return null
    if (y > pb[0]) return Math.max(0, pb[1] + slope * (y - pb[0]))
    for (let k = 1; k < pts.length; k++) {
      const [x0, v0] = pts[k - 1]
      const [x1, v1] = pts[k]
      if (y <= x1) return v0 + ((v1 - v0) * (y - x0)) / (x1 - x0)
    }
    return null
  })
}

const round2 = v => (v === null ? null : Math.round(v * 100) / 100)
const pct = (kha, landKm2) => (kha === null ? null : Math.min(100, (kha * 1000) / landKm2)) // kha·10 km² / km² ·100

const out = {}
const regionSums = new Map() // region -> { forest[], land }
const addToRegion = (name, series, landKm2) => {
  if (!regionSums.has(name)) regionSums.set(name, { forest: years.map(() => 0), land: 0 })
  const s = regionSums.get(name)
  s.land += landKm2
  series.forEach((v, i) => (s.forest[i] += v ?? 0))
}

let skipped = []
for (const [iso3, byYear] of forestKha) {
  if (iso3 === "WLD") continue
  const landKm2 = land.get(iso3)
  const series = annualSeries(byYear)
  if (!series) continue
  if (!landKm2) { skipped.push(iso3); continue }
  const values = series.map(v => round2(pct(v, landKm2)))
  const numeric = countries.isValid(iso3) ? countries.alpha3ToNumeric(iso3) : null
  out[iso3] = {
    iso3,
    numeric: numeric ?? null,
    name: countries.getName(iso3, "es") ?? (iso3 === "XKX" ? "Kosovo" : iso3),
    values,
  }
  addToRegion("WLD", series, landKm2)
  const reg = region.get(iso3)
  if (reg) addToRegion(reg, series, landKm2)
}

const REGIONS = [
  ["WLD", "WLD", "Mundo"],
  ["LCN", "Latin America & Caribbean", "América Latina y el Caribe"],
  ["SSF", "Sub-Saharan Africa", "África subsahariana"],
  ["EAS", "East Asia & Pacific", "Asia oriental y el Pacífico"],
  ["ECS", "Europe & Central Asia", "Europa y Asia central"],
  ["NAC", "North America", "América del Norte"],
  ["MEA", "Middle East, North Africa, Afghanistan & Pakistan", "Oriente Medio, Norte de África, Afganistán y Pakistán"],
  ["SAS", "South Asia", "Asia meridional"],
]
const regions = REGIONS.map(([code, key, name]) => {
  const s = regionSums.get(key)
  return { code, name, values: s.forest.map(v => round2((v * 1000) / s.land)) }
})

const result = {
  meta: {
    description: "Superficie forestal (% de la superficie terrestre)",
    source:
      "FAO, Evaluación de los Recursos Forestales Mundiales 2025 (FRA 2025); superficie terrestre: Banco Mundial (WDI)",
    lastUpdated: (fra.origins?.[0]?.version_producer ?? "").replace("FRA 2025 platform, downloaded ", "") || null,
    years,
    referenceYears: refYears,
    projectedYears,
  },
  regions,
  countries: out,
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, JSON.stringify(result))
console.log(
  `${Object.keys(out).length} países, ${years[0]}–${years.at(-1)} (proyección: ${projectedYears.join(", ") || "ninguna"}) → ${OUT_PATH}`,
)
if (skipped.length) console.log(`Sin superficie terrestre (omitidos): ${skipped.join(", ")}`)
