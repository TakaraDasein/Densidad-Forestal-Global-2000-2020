# Observatorio Ambiental Global

Globo 3D interactivo para analizar, país por país, indicadores de **bosques, biodiversidad y clima**.

## Indicadores

Todas las series son por país y proceden de fuentes públicas con licencia abierta (CC BY 4.0).

| Grupo | Indicador | Periodo | Fuente |
| --- | --- | --- | --- |
| Bosques y ecosistemas | Cobertura forestal (% del territorio) | 1990–2026 | FAO, FRA 2025; superficie terrestre del Banco Mundial |
| Bosques y ecosistemas | Pérdida de bosque primario tropical (miles de ha al año) | 2002–2025 | Global Forest Watch / Universidad de Maryland |
| Biodiversidad | Índice de la Lista Roja (riesgo de extinción de especies) | 1993–2024 | ONU, ODS 15.5.1 (UICN y BirdLife) |
| Biodiversidad | Áreas clave de biodiversidad terrestres protegidas (%) | 2000–2023 | ONU, ODS 15.1.2 (BirdLife, UICN, PNUMA-WCMC) |
| Clima | Cambio de temperatura observado (°C respecto a 1951–1980) | 1961–2025 | FAO, FAOSTAT |
| Clima | Calentamiento proyectado (°C respecto a 1995–2014) | 2020–2099 | Banco Mundial, Climate Change Knowledge Portal (CMIP6) |
| Clima | Días de calor extremo (≥ 35 °C al año) | 1995–2099 | Banco Mundial, Climate Change Knowledge Portal (CMIP6) |
| Clima | Sequía: racha seca más larga (días) | 1995–2099 | Banco Mundial, Climate Change Knowledge Portal (CMIP6) |

Notas sobre los datos:

- **Cobertura forestal:** la FAO mide 1990, 2000, 2010, 2015, 2020 y 2025. Los años intermedios se interpolan
  linealmente y **2026 es una proyección** de la tendencia 2020–2025, marcada como tal en la interfaz.
- **Bosque primario:** solo cubre los países con bosque tropical húmedo.
- **Proyecciones climáticas:** mediana de los modelos para el escenario de emisiones intermedias (SSP2-4.5), en
  periodos de 20 años. El periodo 1995–2014 es una simulación de los modelos, no una observación.
- Las series de Global Forest Watch y del Banco Mundial (CCKP) se obtuvieron ya procesadas del proyecto
  [Environment Dashboard](https://github.com/abhartia/environment-dashboard), y las de los ODS, de Our World in Data.

## Funciones

- Globo 3D con [MapLibre GL JS](https://maplibre.org/); mapa base opcional de
  [OpenStreetMap](https://www.openstreetmap.org/copyright) en versión oscura (desactivado por defecto).
- Navegación por temas (Bosques, Biodiversidad, Clima) y línea de tiempo con animación.
- Al pasar el cursor sobre un país aparece su resumen completo: valor, cambio, superficie de bosque ganada o
  perdida y los ocho indicadores.
- Modo **Valor** (dato del año) y modo **Cambio** (diferencia respecto a un año base).
- Panel mundial: evolución global, países que suben y bajan, y rankings.
- Panel de país: valor, cambio, posición mundial, gráfico de evolución con comparación entre países y una
  **ficha ambiental** con los ocho indicadores.

## Actualizar los datos

Los archivos de origen están en `data-raw/`. Para regenerar `src/data/indicators.json`:

```bash
node scripts/build-data.mjs
```

Los nombres, unidades, colores y textos de cada indicador se definen en `src/lib/indicators.ts`.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Los límites de países son de Natural Earth 1:50m ([`world-atlas`](https://github.com/topojson/world-atlas)) y se
sirven localmente desde `public/data/countries-50m.json`.
