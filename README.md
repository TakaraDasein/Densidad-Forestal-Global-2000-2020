# Densidad Forestal Global

Visualización interactiva de la cobertura forestal mundial sobre un globo 3D.

- **Globo 3D:** [MapLibre GL JS](https://maplibre.org/) con proyección `globe`, atmósfera y mapa base de
  teselas de [OpenStreetMap](https://www.openstreetmap.org/copyright) (desactivable).
- **Límites de países:** Natural Earth 1:50m vía [`world-atlas`](https://github.com/topojson/world-atlas),
  servidos localmente desde `public/data/countries-50m.json` (sin dependencias externas para cargar el globo).
- **Datos:** FAO, *Evaluación de los Recursos Forestales Mundiales 2025* (FRA 2025): superficie forestal por
  país en los años de referencia 1990, 2000, 2010, 2015, 2020 y 2025 (plataforma FRA, descarga del 2026-11-07,
  CC BY 4.0). Se convierte a % de la superficie terrestre con el indicador `AG.LND.TOTL.K2` del Banco Mundial.
  - Años intermedios: interpolación lineal (como hacen la FAO y el Banco Mundial).
  - **2026 es una proyección**: prolonga la tendencia 2020–2025 de cada país y se marca como tal en la interfaz.
  - 213 países y territorios, más el mundo y 7 regiones del Banco Mundial (agregados calculados como suma de
    superficie forestal / suma de superficie terrestre).

## Funciones

- Línea de tiempo 1990–2026 con animación. Indica si el año es dato FAO, interpolado o proyección.
- Modo **Cobertura** (% del territorio) y modo **Cambio** (puntos porcentuales entre un año base y el año elegido).
- Panel mundial: evolución global vs. regiones y ranking de mayores pérdidas y ganancias.
- Panel por país: cobertura, cambio absoluto y relativo, gráfico de evolución y comparación con otro país y con el mundo.

## Actualizar los datos

Los archivos de origen están en `data-raw/`:

- `fao_fra2025_forest_area_kha.json`: superficie forestal FRA 2025 (miles de ha).
- `API_AG.LND.TOTL.K2_WDI_*.csv`: superficie terrestre (Banco Mundial).
- `WDI_country_metadata_*.csv`: región de cada país (Banco Mundial).

Para regenerar `src/data/forest_cover.json`, ejecuta `node scripts/build-forest-data.mjs`. El año final de la
proyección se cambia con `PROJECT_TO` en el script.

## Desarrollo

```bash
pnpm install
pnpm dev
```
