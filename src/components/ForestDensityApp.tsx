import { useState, useEffect } from "react"
import GlobeViz from "./GlobeViz"
import Particles from "./Particles"
import { Card } from "./ui/card"
import { Button } from "./ui/button"
import { Info } from "lucide-react"

export default function ForestDensityApp() {
  const [year, setYear] = useState(2000)
  const [selectedCountry, setSelectedCountry] = useState<any>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 })

  useEffect(() => {
    const updateDimensions = () => {
      const width = Math.min(window.innerWidth, 800)
      const height = Math.min(window.innerHeight - 80, 800)
      setDimensions({ width, height })
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  const handleYearChange = (newYear: number) => {
    setYear(newYear)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Particles />
      <header className="fixed top-0 w-full z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-center">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-2xl font-bold">Densidad Forestal Global</h1>
            <p className="text-sm text-gray-400">Visualizando la cobertura forestal mundial</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant={year === 2000 ? "default" : "outline"}
              onClick={() => handleYearChange(2000)}
              className={`px-6 py-2 rounded-full backdrop-blur-md transition-all duration-300 ${
                year === 2000 
                  ? "bg-green-500 text-white shadow-lg shadow-green-500/50 ring-2 ring-green-400" 
                  : "bg-white/10 hover:bg-white/20 text-white/70"
              }`}
            >
              2000
            </Button>
            <Button
              variant={year === 2020 ? "default" : "outline"}
              onClick={() => handleYearChange(2020)}
              className={`px-6 py-2 rounded-full backdrop-blur-md transition-all duration-300 ${
                year === 2020 
                  ? "bg-green-500 text-white shadow-lg shadow-green-500/50 ring-2 ring-green-400" 
                  : "bg-white/10 hover:bg-white/20 text-white/70"
              }`}
            >
              2020
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-[80px] relative flex items-center justify-center min-h-[calc(100vh-80px)]">
        <GlobeViz
          width={dimensions.width}
          height={dimensions.height}
          year={year}
          onCountrySelect={setSelectedCountry}
        />

        <Card className="fixed bottom-4 left-4 w-64 bg-black/30 backdrop-blur-md border-white/10 text-white p-4 rounded-xl">
          <h3 className="font-medium mb-2">Densidad Forestal</h3>
          <div className="flex flex-col space-y-1">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-900 mr-2 rounded-sm"></div>
              <span>80-100%</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-700 mr-2 rounded-sm"></div>
              <span>60-80%</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 mr-2 rounded-sm"></div>
              <span>40-60%</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-300 mr-2 rounded-sm"></div>
              <span>20-40%</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-100 mr-2 rounded-sm"></div>
              <span>0-20%</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-700 mr-2 rounded-sm"></div>
              <span>Sin datos</span>
            </div>
          </div>
        </Card>

        <Card className="fixed bottom-4 right-4 w-72 bg-black/30 backdrop-blur-md border-white/10 text-white p-4 rounded-xl">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium mb-2">Sobre esta visualización</h3>
              <p className="text-sm text-gray-300 mb-3">
                Los colores representan el porcentaje de densidad forestal. Haz clic en los países para ver información detallada. Usa los botones para cambiar entre datos de 2000 y 2020. Arrastra para rotar, desplaza para hacer zoom.
              </p>
              <div className="text-xs text-gray-400 border-t border-white/10 pt-2">
                <p className="font-medium text-gray-300 mb-1">Fuentes de datos:</p>
                <p>FAO - Global Forest Resources Assessment</p>
                <p>World Bank Open Data</p>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}
