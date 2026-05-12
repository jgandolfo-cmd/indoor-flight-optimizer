# Auditoría Técnica — Indoor Flight Optimizador
_Fecha: 2026-05-12 · Objetivo: integrar núcleo físico para F1M, F1L/EZB y P25_

---

## 1. Estructura actual del proyecto

```
src/
  App.tsx                      ← componente monolítico (~420 líneas): UI + estado + lógica
  main.tsx
  styles.css
  domain/
    types.ts                   ← ÚNICO archivo de tipos compartidos
    calculations.ts            ← métricas de vuelo, validaciones, geometría de modelo
    diagnosis.ts               ← árbol de decisión regla-por-regla
    recommendations.ts         ← hipótesis con confianza (más sofisticado que diagnosis)
    rpm.ts                     ← análisis de curva RPM
    sessions.ts                ← score, comparación de vuelos, configuraciones óptimas
    exporters.ts               ← descarga CSV / JSON
    mockData.ts                ← datos de muestra
  storage/
    localStorage.ts            ← load/save/reset con clave `v1`
    googleDriveStorage.ts      ← sync con Drive
```

No hay `src/physics/`, `src/optimization/`, `src/calibration/` ni `src/categoryRules/`.

---

## 2. Entidades principales — dónde están

| Entidad | Tipo en types.ts | Clave notable |
|---|---|---|
| Salón | `Venue` | `ceilingHeightM`, `usableLengthM/WidthM` |
| Modelo | `IndoorModel` | `wingspanMm`, `weightG`, `wingAreaDm2`, alturas BA/BF, `cgFromWingLeadingEdgeMm` |
| Hélice | `Propeller` | `type: PropellerType`, `diameterMm`, `maxPitchMm`, `minPitchMm`, `springHardness` |
| Lote de goma | `RubberBatch` | `widthMm`, `thicknessMm`, sin densidad calculada |
| Motor | `RubberMotor` | `loopLengthMm`, `weightG`, `strands`, `batchId` |
| Vuelo | `Flight` | ~40 campos, RPM duplicado, VP embebido en struct plano |
| Sesión | `FlightSession` | `objective: SessionObjective`, `flightIds[]`, `bestFlightId` |
| Configuración | `FlightConfiguration` | espejo parcial de `Flight` + sugerencias |
| Óptimo guardado | `OptimalConfiguration` | `validFor` por banda de techo, `confidence` |

---

## 3. Funciones de cálculo — dónde están

### `src/domain/calculations.ts`
- `calculateFlightMetrics()` — netTurns, remainingPercent, ceilingUsePercent, efficiencyPerTurn, efficiencyPerRubberGram
- `validateModelF1M()` — check envergadura y peso mínimo
- `validateMotorF1M()` — check peso motor ≤ 1.5 g
- `validateFlightInputs()` — consistencia de campos
- `calculateModelGeometry()` — incidencia proxy desde alturas BA/BF, decalage, riesgo de drag

### `src/domain/rpm.ts`
- `analyzeRpmProfile()` — trend, decayPct, interpretación textual

### `src/domain/sessions.ts`
- `scoreFlight()` — fórmula empírica: `duration − ceilingPenalty − remainingPenalty − stabilityPenalty`
- `evaluateAgainstCeilingRecord()` — compara contra tiempos de referencia hardcodeados
- `detectConfigurationChange()` — diff entre dos `FlightConfiguration`
- `evaluateChangeImpact()` / `compareFlights()` — decisión mejoro/empeoró/igual
- `buildOptimalConfiguration()` — crea `OptimalConfiguration` desde vuelo + sesión
- `ceilingBandForVenue()` — clasifica techo en bandas (<8m, bajo, medio, alto)

### `src/domain/diagnosis.ts`
- `diagnoseFlight()` — árbol de reglas observacionales, retorna texto libre

### `src/domain/recommendations.ts`
- `evaluateFlightHypotheses()` — hipótesis estructuradas con `confidence`, acción exacta en mm/vueltas

---

## 4. Problemas técnicos detectados

### 4.1 Tipos inconsistentes
- `vpMechanismMode` en `FlightConfiguration` es `string` pero en `Flight` es `VpMechanismMode` (`'known'|'unknown'`). Riesgo al comparar.
- `FlightConfiguration.launchTurnsNet` se trackea como campo, pero en `sessions.ts:compareFlights` se usa `changed('other', ...)` — el nombre de variable no comunica nada.

### 4.2 RPM duplicada
`Flight` tiene `rpmInitial`, `rpmMid`, `rpmFinal` **y** `rpmSamples: RpmSample[]`. `rpm.ts` tiene lógica explícita para priorizar los samples sobre los campos manuales. Esto complica agregar un modelo de curva de torque porque no hay una única fuente de verdad para RPM.

### 4.3 Categoría de aeroplano ausente
No hay campo `category` en `IndoorModel` ni en ninguna entidad. `F1M_LIMITS` es el único conjunto de reglas y está hardcodeado en `calculations.ts`. Imposible soportar F1L/EZB o P25 sin ese campo.

### 4.4 Sin densidad lineal de goma calculada
`RubberBatch` tiene `widthMm` y `thicknessMm` pero no hay cálculo de sección transversal ni densidad lineal (g/mm). `recommendations.ts` hace el cálculo inline a mano:
```ts
const density = motor && newLoop ? round(motor.weightG / newLoop, 4) : undefined;
```
Esto debería vivir en una función de física.

### 4.5 `round()` redefinida 4 veces
`calculations.ts`, `rpm.ts`, `sessions.ts` y `recommendations.ts` tienen implementaciones locales idénticas de `round(value, digits)`. Debería ser una función utilitaria compartida.

### 4.6 Tiempos de referencia hardcodeados
`sessions.ts:defaultReferenceDuration()` tiene valores fijos de F1M (18:48, 20:09, 22:41, 23:00) por banda de techo. Son correctos para F1M pero no tienen fuente documentada ni forma de actualizar por categoría.

### 4.7 Lógica de UI mezclada con dominio
`App.tsx` contiene toda la lógica de estado (`useState`, handlers, efectos de Drive sync) junto con ~15 vistas y 400+ líneas de JSX. Un módulo de física que necesite acceder a datos de sesión activa tendría que pasar por `App.tsx`.

### 4.8 Persistencia sin migración
`localStorage.ts` usa la clave `indoor-flight-optimizer:data:v1` pero no tiene lógica de migración. Si se agregan campos nuevos a los tipos (necesario para física), los datos existentes no tendrán esos campos y el fallback a `mockData` borra todo.

### 4.9 `mockData` como fallback destructivo
Si `JSON.parse` falla, `loadAppData()` retorna `mockData`, sobreescribiendo datos reales en el próximo `saveAppData()`. Debería retornar un `AppData` vacío limpio.

### 4.10 VP embebido como struct plano en Flight
`vpPropeller: VpPropellerSettings` duplica campos que ya están en `Propeller`. Si se cambia la hélice de la sesión y se re-carga `minPitchMm` desde `Propeller`, puede diferir del valor registrado en el vuelo.

---

## 5. Arquitectura propuesta para el núcleo físico

```
src/
  physics/
    rubber.ts          ← energía almacenada, densidad lineal, sección transversal
    propeller.ts       ← empuje estimado, conversión RPM→tracción
    atmosphere.ts      ← densidad de aire según temperatura/altitud
    torque.ts          ← modelo torque-vueltas (lineal o empírico)
    index.ts           ← re-exporta todo
  optimization/
    search.ts          ← búsqueda de configuración óptima dada una función objetivo
    score.ts           ← función de score física (reemplaza scoreFlight empírico)
  calibration/
    profile.ts         ← perfil de calibración por lote de goma
    index.ts
  categoryRules/
    f1m.ts             ← reglas y límites FAI F1M
    f1l.ts             ← reglas FAI F1L / EZB
    p25.ts             ← reglas P25
    index.ts           ← selectCategoryRules(category)
```

---

## 6. Tipos nuevos propuestos (no implementar aún)

```ts
// Categoría de modelo de vuelo libre
type AircraftCategory = 'F1M' | 'F1L' | 'EZB' | 'P25';

// Conjunto de reglas por categoría
interface CategoryRuleSet {
  category: AircraftCategory;
  maxWingspanMm: number;
  minModelWeightG?: number;
  maxMotorWeightG?: number;
  variablePitchAllowed: boolean;
  maxMotorLoopLengthMm?: number;
  notes?: string;
}

// Física del motor de goma
interface RubberMotorPhysics {
  motorId: string;
  linearDensityGPerMm: number;         // weightG / loopLengthMm
  crossSectionMm2: number;             // widthMm * thicknessMm (sección rectangular)
  maxTurns?: number;                   // vueltas máximas antes de ruptura (experimental)
  specificEnergyJPerG?: number;        // energía por gramo (calibrado)
}

// Curva de torque
interface TorqueCurve {
  motorId: string;
  points: Array<{ turns: number; torqueNm: number }>;
  model: 'linear' | 'empirical';
  calibrationDate?: string;
}

// Geometría de hélice para cálculo de empuje
interface PropellerGeometry {
  propellerId: string;
  diameterM: number;
  bladeCount: number;
  solidityRatio?: number;
}

// VP con parámetros de paso variable
interface VariablePitchSettings {
  propellerId: string;
  minPitchDeg?: number;
  maxPitchDeg?: number;
  minPitchMm: number;
  maxPitchMm: number;
  springConstantNPerMm?: number;
  transitionRpmThreshold?: number;
}

// Geometría completa del avión
interface AircraftGeometry {
  modelId: string;
  wingIncidenceDeg?: number;
  stabIncidenceDeg?: number;
  decalageDeg?: number;
  cgPositionPct?: number;              // CG como % de cuerda media
  wingAspectRatio?: number;
}

// Simulación física de un vuelo
interface PhysicalSimulation {
  flightId: string;
  timeSteps: Array<{
    timeSec: number;
    altitudeM: number;
    velocityMps: number;
    thrustN: number;
    dragN: number;
    liftN: number;
    turns: number;
    torqueNm: number;
  }>;
  totalEnergyJ: number;
  usefulEnergyJ: number;
  efficiencyPct: number;
}

// Perfil de calibración de lote de goma
interface CalibrationProfile {
  batchId: string;
  measuredDensityGPerMm: number;
  specificEnergyJPerG: number;
  maxStretchRatio: number;
  calibrationDate: string;
  notes?: string;
}

// Sugerencia de optimización con base física
interface PhysicsOptimizationSuggestion {
  targetVariable: string;
  currentValue: number;
  suggestedValue: number;
  expectedDurationGainSec: number;
  confidence: 'low' | 'medium' | 'high';
  physicsRationale: string;
}
```

---

## 7. Plan de migración sin romper datos

### 7.1 Versionado de localStorage
Cambiar la clave a `indoor-flight-optimizer:data:v2` y agregar función de migración:
```ts
function migrateV1toV2(v1: unknown): AppData { ... }
```
Los campos nuevos opcionales en `IndoorModel` (como `category`) no rompen datos existentes si se agregan como `optional`.

### 7.2 Campos a agregar como opcionales
- `IndoorModel.category?: AircraftCategory` — sin romper existentes
- `RubberMotor.maxTurns?: number` — nuevo campo informativo
- `Flight.physicsSimulationId?: string` — referencia a simulación calculada post-vuelo

### 7.3 Compatibilidad JSON en export/import
El CSV actual exporta todos los campos de `Flight`. Al agregar campos opcionales, las columnas nuevas aparecen vacías en registros viejos — compatible hacia atrás.

### 7.4 Separar `round` en utilitario
Mover a `src/domain/math.ts` para no duplicar en 4 archivos.

---

## 8. Tests mínimos propuestos

| Test | Archivo sugerido |
|---|---|
| `validateModelF1M` rechaza envergadura > 460 mm | `src/domain/calculations.test.ts` |
| Densidad lineal = weightG / loopLengthMm | `src/physics/rubber.test.ts` |
| Integral de torque-vueltas da energía total estimada | `src/physics/torque.test.ts` |
| `ceilingBandForVenue` clasifica techo correctamente | `src/domain/sessions.test.ts` |
| `evaluateFlightHypotheses` con datos mínimos no lanza | `src/domain/recommendations.test.ts` |
| `selectCategoryRules('F1L').variablePitchAllowed === false` | `src/categoryRules/index.test.ts` |

---

## 9. Preguntas abiertas

1. **¿F1L y EZB son la misma categoría para este proyecto?** Los límites son distintos. Necesita decisión antes de modelar `CategoryRuleSet`.
2. **¿La curva de torque se calibra por lote o por motor individual?** Si es por lote, `CalibrationProfile` va en `RubberBatch`; si es por motor, va en `RubberMotor`.
3. **¿Se quiere simular vuelo completo o solo energía disponible?** Simulación completa requiere modelo de lift/drag del modelo; energía disponible solo requiere física de goma.
4. **¿Los tiempos de referencia (18:48, 20:09, etc.) son F1M outdoor o indoor?** Actualmente hardcodeados sin documentación de fuente.
5. **¿`round` como utilidad compartida va en `src/domain/math.ts` o `src/utils/math.ts`?** Decisión de convención de carpetas.

---

## 10. Lista de tareas priorizadas

### Fase 0 — Limpieza (pre-requisito, sin cambios de comportamiento)
- [ ] Extraer `round()` a `src/domain/math.ts`
- [ ] Corregir `vpMechanismMode: string` en `FlightConfiguration` → `VpMechanismMode`
- [ ] Agregar migración v1→v2 en `localStorage.ts`
- [ ] Cambiar fallback de `loadAppData` de `mockData` a objeto vacío limpio

### Fase 1 — Categorías
- [ ] Agregar `category?: AircraftCategory` a `IndoorModel`
- [ ] Crear `src/categoryRules/` con reglas F1M, F1L, P25
- [ ] Reemplazar `F1M_LIMITS` hardcodeado por `selectCategoryRules(model.category)`

### Fase 2 — Física de goma (mínima)
- [ ] Crear `src/physics/rubber.ts`: `linearDensity()`, `crossSection()`, `estimateMaxTurns()`
- [ ] Integrar `linearDensity` en recomendaciones existentes (reemplaza cálculo inline en `recommendations.ts`)

### Fase 3 — Torque y energía
- [ ] Crear `src/physics/torque.ts`: modelo lineal calibrable
- [ ] Crear `CalibrationProfile` en `RubberBatch`
- [ ] Exponer energía disponible en `FlightMetrics`

### Fase 4 — Optimización
- [ ] Crear `src/optimization/score.ts` con función de score física
- [ ] Comparar con `scoreFlight()` empírico en paralelo (A/B interno)

### Fase 5 — Simulación completa (largo plazo)
- [ ] Modelo aerodinámico simplificado
- [ ] `PhysicalSimulation` para post-análisis de vuelos registrados
