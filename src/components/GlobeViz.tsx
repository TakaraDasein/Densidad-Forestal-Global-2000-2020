import { useEffect, useRef, useState } from "react"
import maplibregl, { type ExpressionSpecification, type StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { feature } from "topojson-client"
import { geoBounds, geoCentroid } from "d3"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import {
  CHANGE_STOPS,
  COUNTRY_BY_NUMERIC,
  COVER_STOPS,
  NO_DATA_COLOR,
  YEARS,
  forest,
  type ViewMode,
} from "@/lib/forest"

export type Basemap = "osm" | "none"

interface GlobeVizProps {
  year: number
  baseYear: number
  mode: ViewMode
  basemap: Basemap
  selectedIso: string | null
  onSelect: (iso3: string | null) => void
  onHover?: (info: { iso3: string | null; name: string; x: number; y: number } | null) => void
}

const SOURCE = "countries"
const FILL = "countries-fill"
const LINE = "countries-line"
const HOVER = "countries-hover"
const SELECTED = "countries-selected"

const key = (y: number) => `v${y}`

function fillExpression(mode: ViewMode, year: number, baseYear: number): ExpressionSpecification {
  if (mode === "cover") {
    return [
      "case",
      ["has", key(year)],
      ["interpolate", ["linear"], ["get", key(year)], ...COVER_STOPS.flat()],
      NO_DATA_COLOR,
    ] as ExpressionSpecification
  }
  return [
    "case",
    ["all", ["has", key(year)], ["has", key(baseYear)]],
    [
      "interpolate",
      ["linear"],
      ["-", ["get", key(year)], ["get", key(baseYear)]],
      ...CHANGE_STOPS.flat(),
    ],
    NO_DATA_COLOR,
  ] as ExpressionSpecification
}

function buildStyle(basemap: Basemap): StyleSpecification {
  return {
    version: 8,
    projection: { type: "globe" },
    sky: {
      "sky-color": "#04101f",
      "horizon-color": "#1d4e7a",
      "fog-color": "#0b2440",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.2,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
    },
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": "#0b2a4a" } },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        layout: { visibility: basemap === "osm" ? "visible" : "none" },
        paint: {
          "raster-saturation": -0.35,
          "raster-brightness-max": 0.85,
          "raster-contrast": 0.05,
        },
      },
    ],
  }
}

// world-atlas no corta los polígonos en el antimeridiano (Rusia, Fiyi): se
// "desenrollan" las longitudes de cada anillo para que no crucen el globo.
function unwrapRing(ring: number[][]) {
  let offset = 0
  return ring.map((pt, i) => {
    if (i > 0) {
      const d = pt[0] - ring[i - 1][0]
      if (d > 180) offset -= 360
      else if (d < -180) offset += 360
    }
    return [pt[0] + offset, pt[1]]
  })
}

function unwrapGeometry(g: Geometry): Geometry {
  if (g.type === "Polygon") return { ...g, coordinates: g.coordinates.map(unwrapRing) }
  if (g.type === "MultiPolygon") return { ...g, coordinates: g.coordinates.map(p => p.map(unwrapRing)) }
  return g
}

async function loadCountries(): Promise<FeatureCollection<Geometry>> {
  const topo = await fetch("/data/countries-50m.json").then(r => r.json())
  const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>
  const kosovo = forest.countries.XKX
  // La Antártida no tiene datos y su anillo polar genera artefactos en el globo
  fc.features = fc.features.filter(f => String(f.id) !== "010").map((f: Feature<Geometry>, i: number) => {
    const name = (f.properties as any)?.name as string
    const c = (f.id ? COUNTRY_BY_NUMERIC.get(String(f.id)) : undefined) ?? (name === "Kosovo" ? kosovo : undefined)
    const props: Record<string, unknown> = { iso3: c?.iso3 ?? `geo-${i}`, name: c?.name ?? name, hasData: !!c }
    if (c) {
      YEARS.forEach((y, k) => {
        const v = c.values[k]
        if (v !== null) props[key(y)] = v
      })
    }
    return { type: "Feature", geometry: unwrapGeometry(f.geometry), properties: props }
  })
  return fc
}

// Zoom para que el globo ocupe ~70% de la altura disponible
const fitZoom = (el: HTMLElement) => {
  const size = Math.min(el.clientWidth, el.clientHeight)
  return Math.max(1, Math.min(3, Math.log2((size * 0.36 * 2 * Math.PI) / 512)))
}

const GlobeViz = ({ year, baseYear, mode, basemap, selectedIso, onSelect, onHover }: GlobeVizProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const featuresRef = useRef<Map<string, Feature<Geometry>>>(new Map())
  const [ready, setReady] = useState(false)
  const propsRef = useRef({ year, baseYear, mode, selectedIso, onSelect, onHover })
  propsRef.current = { year, baseYear, mode, selectedIso, onSelect, onHover }

  const userInteracting = useRef(false)
  const lastInteraction = useRef(0)

  // Inicializa el mapa una sola vez
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(basemap),
      center: [-60, 10],
      zoom: fitZoom(containerRef.current),
      minZoom: 0.8,
      maxZoom: 8,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right")
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right")

    let hoveredId: string | null = null

    map.on("load", async () => {
      const fc = await loadCountries()
      fc.features.forEach(f => featuresRef.current.set((f.properties as any).iso3, f))
      map.addSource(SOURCE, { type: "geojson", data: fc, promoteId: "iso3" })
      const { mode, year, baseYear } = propsRef.current
      map.addLayer({
        id: FILL,
        type: "fill",
        source: SOURCE,
        paint: {
          "fill-color": fillExpression(mode, year, baseYear),
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.78],
        },
      })
      map.addLayer({
        id: LINE,
        type: "line",
        source: SOURCE,
        paint: { "line-color": "rgba(10,20,30,0.55)", "line-width": 0.5 },
      })
      map.addLayer({
        id: HOVER,
        type: "line",
        source: SOURCE,
        paint: {
          "line-color": "#ffffff",
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.4, 0],
        },
      })
      map.addLayer({
        id: SELECTED,
        type: "line",
        source: SOURCE,
        filter: ["==", ["get", "iso3"], propsRef.current.selectedIso ?? ""],
        paint: { "line-color": "#facc15", "line-width": 2.2 },
      })
      setReady(true)
    })

    map.on("mousemove", FILL, e => {
      const f = e.features?.[0]
      if (!f) return
      const id = String(f.id)
      if (hoveredId !== id) {
        if (hoveredId) map.setFeatureState({ source: SOURCE, id: hoveredId }, { hover: false })
        hoveredId = id
        map.setFeatureState({ source: SOURCE, id }, { hover: true })
      }
      map.getCanvas().style.cursor = f.properties?.hasData ? "pointer" : "default"
      propsRef.current.onHover?.({
        iso3: f.properties?.hasData ? id : null,
        name: f.properties?.name,
        x: e.point.x,
        y: e.point.y,
      })
    })
    map.on("mouseleave", FILL, () => {
      if (hoveredId) map.setFeatureState({ source: SOURCE, id: hoveredId }, { hover: false })
      hoveredId = null
      map.getCanvas().style.cursor = ""
      propsRef.current.onHover?.(null)
    })
    map.on("click", e => {
      const f = map.queryRenderedFeatures(e.point, { layers: [FILL] })[0]
      const iso = f?.properties?.hasData ? String(f.id) : null
      const current = propsRef.current.selectedIso
      propsRef.current.onSelect(iso && iso !== current ? iso : null)
    })

    // Rotación automática suave mientras nadie interactúa
    const markInteraction = () => {
      userInteracting.current = true
      lastInteraction.current = performance.now()
    }
    const endInteraction = () => {
      userInteracting.current = false
      lastInteraction.current = performance.now()
    }
    map.on("mousedown", markInteraction)
    map.on("touchstart", markInteraction)
    map.on("wheel", () => (lastInteraction.current = performance.now()))
    map.on("mouseup", endInteraction)
    map.on("touchend", endInteraction)
    map.on("dragend", endInteraction)

    let raf = 0
    let last = performance.now()
    const spin = (t: number) => {
      const dt = Math.min(t - last, 100)
      last = t
      const idle = t - lastInteraction.current > 5000
      if (
        idle &&
        !userInteracting.current &&
        !propsRef.current.selectedIso &&
        !map.isMoving() &&
        map.getZoom() < 4
      ) {
        const c = map.getCenter()
        map.jumpTo({ center: [c.lng + dt * 0.004, c.lat] })
      }
      raf = requestAnimationFrame(spin)
    }
    raf = requestAnimationFrame(spin)

    return () => {
      cancelAnimationFrame(raf)
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Colores según año / modo
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setPaintProperty(FILL, "fill-color", fillExpression(mode, year, baseYear))
  }, [ready, mode, year, baseYear])

  // Mapa base
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer("osm")) return
    map.setLayoutProperty("osm", "visibility", basemap === "osm" ? "visible" : "none")
  }, [ready, basemap])

  // Selección: resalta y vuela al país
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setFilter(SELECTED, ["==", ["get", "iso3"], selectedIso ?? ""])
    if (!selectedIso) {
      lastInteraction.current = performance.now() - 3000
      const z = fitZoom(map.getContainer())
      if (Math.abs(map.getZoom() - z) > 0.2) map.easeTo({ zoom: z, pitch: 0, duration: 1200 })
      return
    }
    const f = featuresRef.current.get(selectedIso)
    if (!f) return
    const [[w, s], [e, n]] = geoBounds(f as any)
    const crossesAntimeridian = w > e
    if (crossesAntimeridian || e - w > 120) {
      const [lng, lat] = geoCentroid(f as any)
      map.flyTo({ center: [lng, lat], zoom: 2, duration: 1600, essential: true })
    } else {
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: { top: 120, bottom: 200, left: 60, right: 60 }, maxZoom: 5, duration: 1600 },
      )
    }
  }, [ready, selectedIso])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-sm text-white/60 animate-pulse">Cargando globo…</div>
        </div>
      )}
    </div>
  )
}

export default GlobeViz
