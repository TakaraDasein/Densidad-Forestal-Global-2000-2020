// Genera src/data/indicators.json: todas las series por país que usa la aplicación.
//
// Fuentes (en data-raw/), todas con licencia abierta (CC BY 4.0):
//  - FAO FRA 2025: superficie forestal por país (miles de ha) en 1990, 2000, 2010, 2015, 2020 y 2025.
//  - Banco Mundial WDI: superficie terrestre (km²) y región de cada país.
//  - Global Forest Watch / Universidad de Maryland: pérdida anual de bosque primario tropical húmedo (ha).
//  - ONU ODS 15.5.1 (UICN y BirdLife): Índice de la Lista Roja.
//  - ONU ODS 15.1.2 (BirdLife, UICN, PNUMA-WCMC): % de áreas clave de biodiversidad terrestres protegidas.
//  - FAOSTAT: cambio de temperatura en superficie terrestre respecto a 1951–1980.
//  - Banco Mundial CCKP (CMIP6): calentamiento, días ≥ 35 °C y racha seca más larga proyectados (SSP2-4.5).
//
// Uso: node scripts/build-data.mjs
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const isoCountries = require("i18n-iso-countries")
isoCountries.registerLocale(require("i18n-iso-countries/langs/es.json"))

const RAW = "data-raw"
const OUT_PATH = "src/data/indicators.json"
const FOREST_PROJECT_TO = 2026
const CCKP_SCENARIO = "ssp245"

// ---------------------------------------------------------------- utilidades
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
const readCsv = name =>
  fs.readFileSync(path.join(RAW, name), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean).map(parseCsvLine)
const readJson = name => JSON.parse(fs.readFileSync(path.join(RAW, name), "utf8"))
const round = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d)
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const isCountry = iso3 => isoCountries.isValid(iso3) || iso3 === "XKX"

/** Convierte Map(iso3 -> Map(year -> value)) en { iso3: [valores alineados con years] } */
function align(byCountry, years, decimals) {
  const values = {}
  for (const [iso3, m] of byCountry) {
    if (!isCountry(iso3)) continue
    const arr = years.map(y => round(m.get(y) ?? null, decimals))
    if (arr.some(v => v !== null)) values[iso3] = arr
  }
  return values
}

const indicators = []

// ---------------------------------------------------------------- 1. Cobertura forestal (FAO FRA 2025)
{
  const landRows = readCsv("API_AG.LND.TOTL.K2_WDI_2025-07-01.csv")
  const hi = landRows.findIndex(r => r[0] === "Country Name")
  const land = new Map()
  for (const r of landRows.slice(hi + 1)) {
    for (let i = landRows[hi].length - 1; i >= 4; i--) {
      if (r[i] && Number(r[i]) > 0) { land.set(r[1], Number(r[i])); break }
    }
  }
  const regionOf = new Map(readCsv("WDI_country_metadata_2025-07-01.csv").slice(1).filter(r => r[1]).map(r => [r[0], r[1]]))

  const fra = readJson("fao_fra2025_forest_area_kha.json")
  const t = fra.table
  const kha = new Map()
  t.entity.forEach((iso, i) => {
    if (!kha.has(iso)) kha.set(iso, new Map())
    kha.get(iso).set(Number(t.period[i]), t.value[i])
  })
  const refYears = [...new Set(t.period.map(Number))].sort((a, b) => a - b)
  const lastRef = refYears.at(-1)
  const years = range(refYears[0], FOREST_PROJECT_TO)

  // Interpolación lineal entre años de referencia y proyección con la última tendencia
  const annual = byYear => {
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

  const values = {}
  const area = {} // superficie forestal absoluta (miles de ha), para mostrar la cantidad ganada o perdida
  const sums = new Map()
  const add = (key, series, landKm2) => {
    if (!sums.has(key)) sums.set(key, { forest: years.map(() => 0), land: 0 })
    const s = sums.get(key)
    s.land += landKm2
    series.forEach((v, i) => (s.forest[i] += v ?? 0))
  }
  for (const [iso3, byYear] of kha) {
    if (iso3 === "WLD") continue
    const landKm2 = land.get(iso3)
    const series = annual(byYear)
    if (!series || !landKm2) continue
    values[iso3] = series.map(v => round(v === null ? null : Math.min(100, (v * 1000) / landKm2), 2))
    area[iso3] = series.map(v => round(v, 1))
    add("WLD", series, landKm2)
    if (regionOf.get(iso3)) add(regionOf.get(iso3), series, landKm2)
  }
  const agg = key => sums.get(key).forest.map(v => round((v * 1000) / sums.get(key).land, 2))
  const REGIONS = [
    ["LCN", "Latin America & Caribbean", "América Latina y el Caribe"],
    ["SSF", "Sub-Saharan Africa", "África subsahariana"],
    ["EAS", "East Asia & Pacific", "Asia oriental y el Pacífico"],
    ["ECS", "Europe & Central Asia", "Europa y Asia central"],
    ["NAC", "North America", "América del Norte"],
    ["MEA", "Middle East, North Africa, Afghanistan & Pakistan", "Oriente Medio, Norte de África, Afganistán y Pakistán"],
    ["SAS", "South Asia", "Asia meridional"],
  ]
  indicators.push({
    id: "forest_cover",
    years,
    referenceYears: refYears,
    projectedYears: years.filter(y => y > lastRef),
    vintage: (fra.origins?.[0]?.version_producer ?? "").replace("FRA 2025 platform, downloaded ", ""),
    world: agg("WLD"),
    regions: REGIONS.map(([code, key, name]) => ({ code, name, values: agg(key) })),
    values,
    area,
    worldArea: sums.get("WLD").forest.map(v => round(v, 0)),
  })
}

// ---------------------------------------------------------------- 2. Pérdida de bosque primario (GFW)
{
  const d = readJson("gfw_primary_forest_loss_ha.json")
  const t = d.table
  const by = new Map()
  t.entity.forEach((iso, i) => {
    if (!by.has(iso)) by.set(iso, new Map())
    by.get(iso).set(Number(t.period[i]), t.value[i] / 1000) // miles de ha
  })
  // Global Forest Watch publica la pérdida de bosque primario desde 2002: 2001 es el año base del mapa
  const years = [...new Set(t.period.map(Number))].filter(y => y >= 2002).sort((a, b) => a - b)
  indicators.push({
    id: "primary_forest_loss",
    years,
    vintage: d.vintage,
    world: years.map(y => round(by.get("WLD")?.get(y) ?? null, 1)),
    values: align(by, years, 2),
  })
}

// ---------------------------------------------------------------- 3 y 4. Indicadores ODS (formato Entity,Code,Year,valor)
function sdgSeries(file, id, decimals) {
  const rows = readCsv(file).slice(1)
  const by = new Map()
  for (const [, code, year, value] of rows) {
    if (!code || value === "") continue
    if (!by.has(code)) by.set(code, new Map())
    by.get(code).set(Number(year), Number(value))
  }
  const years = [...new Set(rows.map(r => Number(r[2])))].sort((a, b) => a - b)
  indicators.push({
    id,
    years,
    world: by.has("OWID_WRL") ? years.map(y => round(by.get("OWID_WRL").get(y) ?? null, decimals)) : null,
    values: align(by, years, decimals),
  })
}
sdgSeries("sdg_15-5-1_red_list_index.csv", "red_list_index", 3)
sdgSeries("sdg_15-1-2_protected_terrestrial_kba.csv", "kba_protected", 1)

// ---------------------------------------------------------------- 5. Cambio de temperatura (FAOSTAT)
{
  const rows = readCsv("faostat_temperature_change_annual.csv")
  const header = rows[0]
  const yearCols = header.map((h, i) => [Number(h.replace("Y", "")), i]).filter(([y]) => y > 1900)
  const years = yearCols.map(([y]) => y)
  const by = new Map()
  let world = null
  for (const r of rows.slice(1)) {
    const m49 = r[1].replace("'", "")
    const series = new Map(yearCols.filter(([, i]) => r[i] !== "" && r[i] !== undefined).map(([y, i]) => [y, Number(r[i])]))
    if (m49 === "001") { world = years.map(y => round(series.get(y) ?? null, 2)); continue }
    const iso3 = isoCountries.numericToAlpha3(m49)
    if (iso3) by.set(iso3, series)
  }
  indicators.push({ id: "temp_change", years, world, values: align(by, years, 2) })
}

// ---------------------------------------------------------------- 6–8. Proyecciones climáticas (Banco Mundial CCKP)
function cckp(file, id, decimals) {
  const d = readJson(file)
  const t = d.table
  const by = new Map()
  const labels = new Map()
  t.entity.forEach((iso, i) => {
    const sc = t.dims.scenario[i]
    if (sc !== CCKP_SCENARIO && sc !== "historical") return
    const [a, b] = t.period[i].split("/").map(Number)
    const mid = Math.round((a + b) / 2)
    labels.set(mid, `${a}–${b}`)
    if (!by.has(iso)) by.set(iso, new Map())
    by.get(iso).set(mid, t.value[i])
  })
  const years = [...labels.keys()].sort((a, b) => a - b)
  indicators.push({
    id,
    years,
    yearLabels: years.map(y => labels.get(y)),
    projectedYears: years.filter(y => y > 2014),
    vintage: d.vintage,
    world: null,
    values: align(by, years, decimals),
  })
}
cckp("wb_cckp_warming.json", "projected_warming", 2)
cckp("wb_cckp_hot-days-35c.json", "hot_days_35", 1)
cckp("wb_cckp_longest-dry-spell.json", "dry_spell", 1)

// ---------------------------------------------------------------- países
const countries = {}
for (const ind of indicators) {
  for (const iso3 of Object.keys(ind.values)) {
    if (countries[iso3]) continue
    countries[iso3] = {
      iso3,
      numeric: isoCountries.isValid(iso3) ? isoCountries.alpha3ToNumeric(iso3) ?? null : null,
      name: iso3 === "XKX" ? "Kosovo" : isoCountries.getName(iso3, "es") ?? iso3,
    }
  }
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, JSON.stringify({ countries, indicators }))
console.log(`${Object.keys(countries).length} países → ${OUT_PATH}`)
for (const ind of indicators) {
  console.log(
    `  ${ind.id.padEnd(20)} ${String(Object.keys(ind.values).length).padStart(3)} países  ${ind.years[0]}–${ind.years.at(-1)} (${ind.years.length} puntos)`,
  )
}
