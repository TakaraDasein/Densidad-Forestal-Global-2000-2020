# Densidad Forestal Global

Visualización interactiva de la cobertura forestal mundial sobre un globo 3D.

- **Globo 3D:** [MapLibre GL JS](https://maplibre.org/) con proyección `globe`, atmósfera y mapa base de
  teselas de [OpenStreetMap](https://www.openstreetmap.org/copyright) (desactivable).
- **Límites de países:** Natural Earth 1:50m vía [`world-atlas`](https://github.com/topojson/world-atlas),
  servidos localmente desde `public/data/countries-50m.json` (sin dependencias externas para cargar el globo).
- **Datos:** Banco Mundial, *World Development Indicators*, indicador `AG.LND.FRST.ZS`
  (superficie forestal, % de la superficie terrestre), basado en la Evaluación de los Recursos Forestales
  Mundiales (FRA) de la FAO. Serie anual **1990–2022** para 213 países y territorios, más agregados regionales.

## Funciones

- Línea de tiempo 1990–2022 con animación.
- Modo **Cobertura** (% del territorio) y modo **Cambio** (puntos porcentuales entre un año base y el año elegido).
- Panel mundial: evolución global vs. regiones y ranking de mayores pérdidas y ganancias.
- Panel por país: cobertura, cambio absoluto y relativo, gráfico de evolución y comparación con otro país y con el mundo.

## Actualizar los datos

1. Descarga el CSV del indicador desde <https://data.worldbank.org/indicator/AG.LND.FRST.ZS>
   (formato CSV) y guárdalo en `data-raw/`.
2. Ejecuta `node scripts/build-forest-data.mjs data-raw/<archivo>.csv` para regenerar `src/data/forest_cover.json`.

## Desarrollo

```bash
pnpm install
pnpm dev
```
