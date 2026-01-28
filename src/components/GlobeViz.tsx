import { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import forestData from "@/data/forest_density_v0.json"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X } from "lucide-react"

interface GlobeVizProps {
  width?: number
  height?: number
  year?: number
  onCountrySelect?: (country: any) => void
}

const GlobeViz = ({ width = 800, height = 800, year = 2000, onCountrySelect }: GlobeVizProps) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [geoData, setGeoData] = useState<any>(null)
  const [selectedCountry, setSelectedCountry] = useState<any>(null)
  
  // Refs for animation state
  const projectionRef = useRef<d3.GeoProjection | null>(null)
  const rotationRef = useRef({ x: 0, y: 0 })
  const animationRef = useRef<number>()
  const isDragging = useRef(false)
  const isAnimating = useRef(false)
  const currentScale = useRef(1)
  const currentTranslate = useRef([0, 0])
  const yearRef = useRef(year)
  const selectedCountryRef = useRef<any>(null)

  // Load geo data
  useEffect(() => {
    fetch("https://assets.codepen.io/911796/custom.geo.json")
      .then(res => res.json())
      .then(setGeoData)
  }, [])

  // Update year ref
  useEffect(() => {
    yearRef.current = year
  }, [year])

  const getColor = useCallback((value: number | undefined) => {
    if (value === undefined) return "#1a1a1a"
    return d3.scaleSequential(d3.interpolateGreens).domain([0, 100])(value)
  }, [])

  const normalizeCountryName = useCallback((name: string | null | undefined) => {
    if (!name) return ""
    return name.toLowerCase().replace(/[^a-z0-9]/g, "")
  }, [])

  // Start auto rotation
  const startRotation = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    
    let lastTime = performance.now()
    const animate = (time: number) => {
      if (projectionRef.current && !isDragging.current && !isAnimating.current && !selectedCountryRef.current) {
        const delta = (time - lastTime) / 16
        rotationRef.current.x += 0.1 * delta
        projectionRef.current.rotate([rotationRef.current.x, rotationRef.current.y])
        
        if (svgRef.current) {
          const path = d3.geoPath().projection(projectionRef.current)
          d3.select(svgRef.current).selectAll("path").attr("d", path as any)
        }
      }
      lastTime = time
      animationRef.current = requestAnimationFrame(animate)
    }
    animate(performance.now())
  }, [])

  // Deselect and reset to initial view with rotation
  const handleDeselect = useCallback(() => {
    if (!svgRef.current || !projectionRef.current) return
    
    selectedCountryRef.current = null
    setSelectedCountry(null)
    onCountrySelect?.(null)
    isAnimating.current = true

    const initialScale = currentScale.current
    const initialTranslate = [...currentTranslate.current]
    const initialRotation = projectionRef.current.rotate()
    const targetRotation = [0, 0, 0] // Reset rotation to initial
    const duration = 800

    d3.select(svgRef.current)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .tween("reset-view", () => {
        const rotInterp = d3.interpolate(initialRotation, targetRotation)
        
        return (t: number) => {
          // Reset zoom
          currentScale.current = initialScale + (1 - initialScale) * t
          currentTranslate.current = [
            initialTranslate[0] * (1 - t),
            initialTranslate[1] * (1 - t)
          ]
          d3.select(svgRef.current!)
            .select("g")
            .attr("transform", `translate(${currentTranslate.current[0]},${currentTranslate.current[1]}) scale(${currentScale.current})`)
          
          // Reset rotation
          const rot = rotInterp(t)
          rotationRef.current = { x: rot[0], y: rot[1] }
          projectionRef.current!.rotate(rot)
          
          // Update paths
          const path = d3.geoPath().projection(projectionRef.current!)
          d3.select(svgRef.current!).selectAll("path").attr("d", path as any)
        }
      })
      .on("end", () => {
        isAnimating.current = false
        currentScale.current = 1
        currentTranslate.current = [0, 0]
        rotationRef.current = { x: 0, y: 0 }
        // Resume rotation
        startRotation()
      })
  }, [onCountrySelect, startRotation])

  // Zoom to country
  const zoomToCountry = useCallback((d: any, countryData: any) => {
    if (!projectionRef.current || !svgRef.current) return

    // If same country, deselect
    if (selectedCountryRef.current?.country_name === countryData.country_name) {
      handleDeselect()
      return
    }

    selectedCountryRef.current = countryData
    setSelectedCountry(countryData)
    onCountrySelect?.(countryData)
    isAnimating.current = true

    // Stop rotation
    if (animationRef.current) cancelAnimationFrame(animationRef.current)

    const centroid = d3.geoCentroid(d)
    const targetRotation = [-centroid[0], -centroid[1]]
    const startRot = projectionRef.current.rotate()
    
    // Calculate optimal zoom based on country bounds
    const tempProjection = d3.geoOrthographic()
      .scale(projectionRef.current.scale())
      .translate([width / 2, height / 2])
      .rotate(targetRotation)
    
    const bounds = d3.geoPath().projection(tempProjection).bounds(d)
    const dx = bounds[1][0] - bounds[0][0]
    const dy = bounds[1][1] - bounds[0][1]
    const centerX = (bounds[0][0] + bounds[1][0]) / 2
    const centerY = (bounds[0][1] + bounds[1][1]) / 2
    
    // Calculate scale to fit country with padding
    const padding = 0.3
    const scaleX = (width * (1 - padding)) / dx
    const scaleY = (height * (1 - padding)) / dy
    const targetScale = Math.min(scaleX, scaleY, 5)
    
    // Calculate translate to center the country
    const targetTranslate = [
      width / 2 - centerX * targetScale,
      height / 2 - centerY * targetScale
    ]

    const startScale = currentScale.current
    const startTranslate = [...currentTranslate.current]
    const duration = 1000

    d3.select(svgRef.current)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .tween("focus", () => {
        const rotInterp = d3.interpolate(startRot, targetRotation)
        const scaleInterp = d3.interpolate(startScale, targetScale)
        const transInterp = d3.interpolate(startTranslate, targetTranslate)

        return (t: number) => {
          // Update rotation
          const rot = rotInterp(t)
          rotationRef.current = { x: rot[0], y: rot[1] }
          projectionRef.current!.rotate(rot)

          // Update paths
          const path = d3.geoPath().projection(projectionRef.current!)
          d3.select(svgRef.current!).selectAll("path").attr("d", path as any)

          // Update zoom
          currentScale.current = scaleInterp(t)
          currentTranslate.current = transInterp(t)
          d3.select(svgRef.current!)
            .select("g")
            .attr("transform", `translate(${currentTranslate.current[0]},${currentTranslate.current[1]}) scale(${currentScale.current})`)
        }
      })
      .on("end", () => {
        isAnimating.current = false
      })
  }, [handleDeselect, onCountrySelect, width, height])

  // Main setup effect
  useEffect(() => {
    if (!geoData || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    projectionRef.current = d3.geoOrthographic()
      .scale(height * 0.45)
      .translate([width / 2, height / 2])

    const path = d3.geoPath().projection(projectionRef.current)
    const g = svg.append("g")

    // Defs for glow and ocean pattern
    const defs = svg.append("defs")
    
    // Glow filter
    const filter = defs.append("filter").attr("id", "glow")
    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur")
    const feMerge = filter.append("feMerge")
    feMerge.append("feMergeNode").attr("in", "coloredBlur")
    feMerge.append("feMergeNode").attr("in", "SourceGraphic")

    // Radial gradient for ocean - professional deep blue
    const oceanGradient = defs.append("radialGradient")
      .attr("id", "oceanGradient")
      .attr("cx", "35%")
      .attr("cy", "35%")
      .attr("r", "65%")
    oceanGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "rgba(15, 45, 80, 0.85)")
    oceanGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "rgba(5, 20, 45, 0.95)")

    // Ocean sphere with gradient
    g.append("circle")
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", projectionRef.current.scale())
      .attr("fill", "url(#oceanGradient)")
      .style("cursor", "pointer")
      .on("click", () => {
        if (selectedCountryRef.current) handleDeselect()
      })

    // Graticule - professional latitude/longitude lines
    const graticule = d3.geoGraticule()
      .step([20, 20])
    
    g.append("path")
      .datum(graticule())
      .attr("class", "graticule")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "rgba(60, 120, 160, 0.25)")
      .attr("stroke-width", "0.5")
      .style("pointer-events", "none")

    // Outer ring
    g.append("circle")
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", projectionRef.current.scale())
      .attr("fill", "none")
      .attr("stroke", "rgba(80, 140, 180, 0.4)")
      .attr("stroke-width", "1.5")
      .style("pointer-events", "none")

    // Prepare data
    const forestDataMap = new Map(forestData.map(d => [normalizeCountryName(d.country_name), d]))
    const features = geoData.features.map((feature: any) => {
      const normalizedName = normalizeCountryName(feature.properties?.name)
      const countryData = forestDataMap.get(normalizedName) || 
        forestData.find(d => d.country_code === feature.properties?.formal_en)
      return { ...feature, properties: { ...feature.properties, forestData: countryData } }
    })

    // Countries
    g.selectAll("path.country")
      .data(features)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", path)
      .attr("fill", (d: any) => getColor(d.properties?.forestData?.[`forest_${yearRef.current}`]))
      .attr("stroke", "#000")
      .attr("stroke-width", "0.5")
      .attr("opacity", 0.8)
      .style("cursor", "pointer")
      .on("mouseover", function() {
        d3.select(this).attr("stroke", "#fff").attr("stroke-width", "1").attr("opacity", 1)
      })
      .on("mouseout", function() {
        d3.select(this).attr("stroke", "#000").attr("stroke-width", "0.5").attr("opacity", 0.8)
      })
      .on("click", (event, d: any) => {
        event.stopPropagation()
        if (d.properties.forestData) {
          zoomToCountry(d, d.properties.forestData)
        }
      })

    // Drag
    let prevPos = { x: 0, y: 0 }
    const drag = d3.drag()
      .on("start", (e) => { isDragging.current = true; prevPos = { x: e.x, y: e.y } })
      .on("drag", (e) => {
        if (!projectionRef.current) return
        rotationRef.current.x += (e.x - prevPos.x) * 0.5
        rotationRef.current.y = Math.max(-90, Math.min(90, rotationRef.current.y - (e.y - prevPos.y) * 0.5))
        projectionRef.current.rotate([rotationRef.current.x, rotationRef.current.y])
        g.selectAll("path").attr("d", path as any)
        prevPos = { x: e.x, y: e.y }
      })
      .on("end", () => { isDragging.current = false })

    svg.call(drag as any)
    startRotation()

    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [geoData, width, height, getColor, normalizeCountryName, startRotation, zoomToCountry, handleDeselect])

  // Update colors on year change
  useEffect(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current)
      .selectAll("path.country")
      .attr("fill", (d: any) => getColor(d.properties?.forestData?.[`forest_${year}`]))
  }, [year, getColor])

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-transparent"
        style={{ maxWidth: "100%", height: "auto", position: "relative", zIndex: 2 }}
      />
      
      {/* Botón Reiniciar */}
      <div className="absolute top-4 left-4" style={{ zIndex: 10 }}>
        <Button
          onClick={handleDeselect}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all duration-300"
        >
          Reiniciar Vista
        </Button>
      </div>

      {/* Información del País */}
      {selectedCountry && (
        <Card className="absolute top-4 right-4 w-72 bg-black/30 backdrop-blur-md border-white/10 text-white p-4 rounded-xl" style={{ zIndex: 10 }}>
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold">{selectedCountry.country_name}</h3>
            <Button variant="ghost" size="icon" onClick={handleDeselect}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-sm text-gray-400">Cobertura Forestal {year}</div>
              <div className="text-2xl font-bold">{selectedCountry[`forest_${year}`]?.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Cambio 2000-2020</div>
              <div className={`text-lg font-semibold ${
                selectedCountry.forest_trend > 0 ? "text-green-400" :
                selectedCountry.forest_trend < 0 ? "text-red-400" : "text-gray-400"
              }`}>
                {selectedCountry.forest_trend > 0 ? "+" : ""}
                {selectedCountry.forest_trend?.toFixed(2)}%
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

export default GlobeViz
