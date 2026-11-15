// Genera src/data/forest_cover.json a partir del CSV de World Development Indicators
// (indicador AG.LND.FRST.ZS — "Forest area (% of land area)", fuente original: FAO FRA).
//
// Uso: node scripts/build-forest-data.mjs [ruta-al-csv]
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const countries = require("i18n-iso-countries")
countries.registerLocale(require("i18n-iso-countries/langs/es.json"))
countries.registerLocale(require("i18n-iso-countries/langs/en.json"))

const csvPath = process.argv[2] ?? "data-raw/API_AG.LND.FRST.ZS_WDI_2025-03-24.csv"
const outPath = "src/data/forest_cover.json"

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

const text = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "")
const lines = text.split(/\r?\n/)
const lastUpdated = parseCsvLine(lines.find(l => l.startsWith('"Last Updated Date"')) ?? "")[1] ?? null
const headerIdx = lines.findIndex(l => l.startsWith('"Country Name"'))
const header = parseCsvLine(lines[headerIdx])

const rows = lines.slice(headerIdx + 1).filter(Boolean).map(parseCsvLine)
const yearCols = header
  .map((h, i) => ({ year: Number(h), i }))
  .filter(({ year }) => Number.isInteger(year) && year > 1900)

// Sólo años con datos para la mayoría de los países
const usable = yearCols.filter(({ i }) => rows.filter(r => r[i] !== "").length > 150)
const years = usable.map(y => y.year)

const round = v => (v === "" || v === undefined ? null : Math.round(Number(v) * 100) / 100)
const series = r => usable.map(({ i }) => round(r[i]))

const REGIONS = {
  WLD: "Mundo",
  LCN: "América Latina y el Caribe",
  SSF: "África subsahariana",
  EAS: "Asia oriental y el Pacífico",
  ECS: "Europa y Asia central",
  NAC: "América del Norte",
  MEA: "Oriente Medio y Norte de África",
  SAS: "Asia meridional",
}

const regions = Object.entries(REGIONS).map(([code, name]) => {
  const r = rows.find(row => row[1] === code)
  return { code, name, values: series(r) }
})

const out = {}
for (const r of rows) {
  const iso3 = r[1]
  if (!countries.isValid(iso3)) continue // descarta agregados regionales
  const values = series(r)
  if (values.every(v => v === null)) continue
  const numeric = countries.alpha3ToNumeric(iso3)
  out[iso3] = {
    iso3,
    numeric,
    name: countries.getName(iso3, "es") ?? r[0],
    name_en: r[0],
    values,
  }
}
// Kosovo (XKX) no tiene código ISO numérico; se asocia por nombre en el cliente
const kosovo = rows.find(r => r[1] === "XKX")
if (kosovo && series(kosovo).some(v => v !== null)) {
  out.XKX = { iso3: "XKX", numeric: null, name: "Kosovo", name_en: "Kosovo", values: series(kosovo) }
}

const result = {
  meta: {
    indicator: "AG.LND.FRST.ZS",
    description: "Superficie forestal (% de la superficie terrestre)",
    source: "Banco Mundial — World Development Indicators, a partir de FAO Global Forest Resources Assessment",
    lastUpdated,
    years,
  },
  regions,
  countries: out,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(result))
console.log(`${Object.keys(out).length} países, años ${years[0]}–${years.at(-1)} → ${outPath}`)
