# Plan de Integración — Núcleo Físico
_Fecha: 2026-05-12 · Ver auditoría completa en `TECHNICAL_AUDIT_PHYSICS.md`_

---

## Estructura actual (dominio)

```
src/domain/
  types.ts            ← todos los tipos compartidos
  calculations.ts     ← métricas, validaciones F1M, geometría modelo
  diagnosis.ts        ← árbol de reglas observacionales
  recommendations.ts  ← hipótesis con confianza y ajuste exacto
  rpm.ts              ← análisis de curva RPM
  sessions.ts         ← score, comparación vuelos, óptimos guardados
  exporters.ts        ← CSV / JSON
src/storage/
  localStorage.ts     ← load/save/reset (clave v1, sin migración)
  googleDriveStorage.ts
```

---

## Dónde agregar `src/physics/`

```
src/physics/
  rubber.ts           ← linearDensity(), crossSection(), estimateMaxTurns()
  torque.ts           ← TorqueCurve, integración energía
  propeller.ts        ← empuje estimado desde RPM y geometría
  atmosphere.ts       ← densidad de aire (temperatura, altitud)
  index.ts            ← re-exporta funciones públicas
```

**Punto de entrada en el dominio**: `recommendations.ts` ya hace cálculo inline de densidad lineal (línea 304–310). Ese cálculo es el primer candidato a moverse a `src/physics/rubber.ts`.

---

## Riesgos de migración

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Campos opcionales nuevos → sin valor en datos viejos | Bajo | Agregar `?` opcional; nunca rompe tipos existentes |
| `localStorage` sin migración | Medio | Agregar función `migrateV1toV2()` antes de parsear |
| `mockData` como fallback destructivo | Medio | Cambiar fallback a `AppData` vacío limpio |
| `vpMechanismMode: string` en `FlightConfiguration` | Bajo | Corregir a `VpMechanismMode` (cambio de tipo, no de datos) |
| Función `round()` duplicada en 4 archivos | Bajo | Extraer a `src/domain/math.ts` |
| Tiempos de referencia hardcodeados por categoría | Medio | Parametrizar en `CategoryRuleSet` |

---

## Tipos existentes reutilizables

| Tipo | Campos relevantes para física |
|---|---|
| `RubberBatch` | `widthMm`, `thicknessMm` → sección transversal |
| `RubberMotor` | `loopLengthMm`, `weightG`, `strands` → densidad lineal |
| `Propeller` | `diameterMm`, `maxPitchMm`, `minPitchMm` → geometría VP |
| `IndoorModel` | `wingAreaDm2`, `weightG` → carga alar |
| `Venue` | `ceilingHeightM` → límite de altitud |
| `Flight` | `launchTorque`, `turnsLoaded`, `backOff`, `rpmSamples` → calibración |

---

## Tipos nuevos necesarios

```ts
type AircraftCategory = 'F1M' | 'F1L' | 'EZB' | 'P25';

interface CategoryRuleSet {
  category: AircraftCategory;
  maxWingspanMm: number;
  minModelWeightG?: number;
  maxMotorWeightG?: number;
  variablePitchAllowed: boolean;
}

interface RubberMotorPhysics {
  motorId: string;
  linearDensityGPerMm: number;
  crossSectionMm2: number;
  maxTurns?: number;
}

interface TorqueCurve {
  motorId: string;
  points: Array<{ turns: number; torqueNm: number }>;
  model: 'linear' | 'empirical';
}

interface CalibrationProfile {
  batchId: string;
  measuredDensityGPerMm: number;
  specificEnergyJPerG: number;
  maxStretchRatio: number;
  calibrationDate: string;
}

interface PhysicsOptimizationSuggestion {
  targetVariable: string;
  currentValue: number;
  suggestedValue: number;
  expectedDurationGainSec: number;
  confidence: 'low' | 'medium' | 'high';
  physicsRationale: string;
}
```

Los tipos completos (`PropellerGeometry`, `VariablePitchSettings`, `AircraftGeometry`, `PhysicalSimulation`) están documentados en `TECHNICAL_AUDIT_PHYSICS.md`.

---

## Funciones actuales que NO deben romperse

| Función | Archivo | Por qué es crítica |
|---|---|---|
| `calculateFlightMetrics()` | calculations.ts | Usada en diagnosis, recommendations, sessions, App.tsx |
| `diagnoseFlight()` | diagnosis.ts | Usada directamente en UI |
| `evaluateFlightHypotheses()` | recommendations.ts | Genera hipótesis y ajustes exactos en UI |
| `scoreFlight()` | sessions.ts | Usado en comparaciones, óptimos, y el score visible al usuario |
| `compareFlights()` / `evaluateChangeImpact()` | sessions.ts | Lógica de sesiones activas |
| `loadAppData()` / `saveAppData()` | localStorage.ts | Toda la persistencia depende de esto |
| `analyzeRpmProfile()` | rpm.ts | Usado en 3 archivos de dominio |

---

## Plan de implementación por fases

### Fase 0 — Limpieza (sin cambios de comportamiento)
**Objetivo**: reducir deuda técnica antes de agregar física.

1. Extraer `round(value, digits)` a `src/domain/math.ts` y reemplazar en los 4 archivos que la definen.
2. Corregir `FlightConfiguration.vpMechanismMode: string` → `VpMechanismMode`.
3. En `localStorage.ts`: cambiar fallback de `mockData` a objeto `AppData` vacío.
4. Agregar función `migrateV1toV2()` y cambiar clave a `v2`.

**Riesgo**: ninguno. Solo refactors internos.

### Fase 1 — Categorías de modelo
**Objetivo**: poder distinguir F1M de F1L de P25 en los datos.

1. Agregar `category?: AircraftCategory` a `IndoorModel` en `types.ts`.
2. Crear `src/categoryRules/index.ts` con `F1M_RULES`, `F1L_RULES`, `P25_RULES`.
3. Reemplazar `F1M_LIMITS` en `calculations.ts` por `selectCategoryRules(category)`.
4. Actualizar `validateModelF1M()` a `validateModel(model, rules)`.

**Riesgo bajo**: campos opcionales, datos existentes sin categoría usan F1M por defecto.

### Fase 2 — Física de goma mínima
**Objetivo**: calcular densidad lineal y sección transversal desde datos ya existentes.

1. Crear `src/physics/rubber.ts`:
   - `linearDensity(motor: RubberMotor): number`
   - `crossSection(batch: RubberBatch): number`
   - `estimateMaxTurns(motor, batch): number | undefined`
2. Reemplazar cálculo inline de `recommendations.ts:304` con `linearDensity()`.
3. Exponer `linearDensityGPerMm` en la UI de detalle de motor.

**Riesgo bajo**: no cambia lógica de recomendaciones, solo extrae cálculo a función pura.

### Fase 3 — Modelo de torque y energía
**Objetivo**: estimar energía disponible por vuelo.

1. Crear `src/physics/torque.ts` con modelo lineal: `E = k * turns^2 / 2`.
2. Agregar `CalibrationProfile` a `RubberBatch` (campo opcional).
3. Agregar `energyAvailableJ?: number` a `FlightMetrics`.
4. No cambiar `scoreFlight()` todavía.

### Fase 4 — Score físico (paralelo al empírico)
**Objetivo**: comparar score físico con el score empírico actual.

1. Crear `src/optimization/score.ts` con `scoreFlightPhysics()`.
2. Calcular ambos en `App.tsx` sin mostrar aún el físico al usuario.
3. Loguear diferencias para validar el modelo.

### Fase 5 — Simulación completa (largo plazo)
Requiere modelo aerodinámico del modelo (lift/drag). Fuera de alcance hasta validar fases anteriores.

---

## Checklist antes de cada fase

- [ ] `npm run build` pasa sin errores
- [ ] Ninguna función de la tabla "no romper" cambia su firma
- [ ] Campos nuevos son siempre opcionales (`?`)
- [ ] Datos exportados a JSON/CSV siguen siendo legibles por versiones anteriores
