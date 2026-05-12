export type {
  ConfidenceLevel,
  DataProvenance,
  PhysicalValue,
  PhysicsLabInput,
  PhysicsLabResult,
  PhysicsLabRecommendation,
  TorqueSample,
  CalcOutput,
  AircraftCategory,
  PropellerLoadClass,
} from './core/types';

export { calculateLinearDensity } from './core/rubber';
export { calculateEnergyFromTorqueCurve } from './core/torque';
export { estimateEnergyRemaining } from './core/energy';
export {
  calculateInitialPower,
  calculateAveragePowerEstimate,
  calculateRequiredPowerApprox,
} from './core/power';
export { calculateVerticalSpeed } from './core/flightMetrics';
export { classifyPropellerLoad } from './core/propellerLoad';
export { analyzeVpData } from './core/vpObserved';
export { generateRecommendations } from './core/recommendations';
export { applyGuards } from './core/safetyGuards';

import type { ConfidenceLevel, PhysicalValue, PhysicsLabInput, PhysicsLabResult, PhysicsLabRecommendation } from './core/types';
import { calculateLinearDensity } from './core/rubber';
import { estimateEnergyRemaining } from './core/energy';
import { calculateInitialPower, calculateAveragePowerEstimate, calculateRequiredPowerApprox } from './core/power';
import { calculateVerticalSpeed } from './core/flightMetrics';
import { classifyPropellerLoad } from './core/propellerLoad';
import { checkRpmCoherence, calculateCeilingUse } from './core/coherence';
import { generateRecommendations } from './core/recommendations';

function minConfidence(...levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.includes('low')) return 'low';
  if (levels.includes('medium')) return 'medium';
  return 'high';
}

function mergeConfidence(
  criticalResults: (PhysicalValue<number> | undefined)[],
  torqueBlocked: boolean,
  missingCount: number,
  rpmCoherenceDegraded = false,
): ConfidenceLevel {
  // Start from min of available critical results
  const available = criticalResults.filter((r): r is PhysicalValue<number> => r !== undefined);
  let confidence: ConfidenceLevel = available.length > 0
    ? minConfidence(...available.map((r) => r.confidence))
    : 'low';

  // Torque unknown → cap at medium (no power data)
  if (torqueBlocked) confidence = minConfidence(confidence, 'medium');

  // Missing data caps
  if (missingCount > 4) confidence = minConfidence(confidence, 'low');
  else if (missingCount > 1) confidence = minConfidence(confidence, 'medium');

  // Average power is always an assumption (estimated) → cap at medium
  // because we never have a verified torque curve
  confidence = minConfidence(confidence, 'medium');

  // RPM coherence failure forces low
  if (rpmCoherenceDegraded) confidence = 'low';

  return confidence;
}

export function analyzePhysicsLab(input: PhysicsLabInput): {
  result: PhysicsLabResult;
  recommendations: PhysicsLabRecommendation[];
} {
  const allMissing: string[] = [];
  const allWarnings: string[] = [];
  const allAssumptions: string[] = [];

  const torqueUnitBlocked = !input.motor?.launchTorqueUnit
    || input.motor.launchTorqueUnit === 'unknown';

  const ldCalc = calculateLinearDensity(input.motor);
  allMissing.push(...ldCalc.missing);
  allWarnings.push(...ldCalc.warnings);
  allAssumptions.push(...ldCalc.assumptions);

  const vsCalc = calculateVerticalSpeed(input.flight);
  allMissing.push(...vsCalc.missing);
  allWarnings.push(...vsCalc.warnings);
  allAssumptions.push(...vsCalc.assumptions);

  const ipCalc = torqueUnitBlocked
    ? { result: undefined, missing: [], warnings: ['Unidad de torque no verificada — no se calcula potencia inicial.'], assumptions: [] }
    : calculateInitialPower(input.motor, input.flight);
  allMissing.push(...ipCalc.missing);
  allWarnings.push(...ipCalc.warnings);
  allAssumptions.push(...ipCalc.assumptions);

  const apCalc = calculateAveragePowerEstimate(ipCalc);
  allAssumptions.push(...apCalc.assumptions);

  const rpCalc = calculateRequiredPowerApprox(input.model, vsCalc);
  allMissing.push(...rpCalc.missing);
  allAssumptions.push(...rpCalc.assumptions);

  const erCalc = estimateEnergyRemaining(input.motor);
  allMissing.push(...erCalc.missing);
  allWarnings.push(...erCalc.warnings);
  allAssumptions.push(...erCalc.assumptions);

  const { loadClass, loadRatio } = classifyPropellerLoad(input.flight);
  allMissing.push(...loadRatio.missing);
  allWarnings.push(...loadRatio.warnings);
  allAssumptions.push(...loadRatio.assumptions);

  // RPM coherence check
  const coherence = checkRpmCoherence(input.motor, input.flight);
  allMissing.push(...coherence.missing);
  allWarnings.push(...coherence.warnings);

  // Ceiling use
  const ceilingCalc = calculateCeilingUse(input.flight, input.venue);
  const ceilingUse: PhysicsLabResult['ceilingUse'] = 'missing' in ceilingCalc
    ? undefined
    : ceilingCalc;
  if ('missing' in ceilingCalc && input.venue?.ceilingHeightM === undefined && input.flight?.maxAltitudeM !== undefined) {
    allMissing.push(ceilingCalc.missing);
  }

  // Hybrid data warning
  const sourceType = input.sourceType;
  if (sourceType === 'hybrid' || sourceType === 'published_partial') {
    allWarnings.push(
      'Advertencia: caso con datos parcialmente publicados o híbridos. ' +
      'No usar para validar recomendaciones hasta completar con datos medidos.',
    );
  }

  const uniqueMissing = [...new Set(allMissing)];
  const criticalResults = [
    ldCalc.result,
    ipCalc.result,
    erCalc.result,
    loadRatio.result,
  ];

  // Remaining turns ratio — direct calculation, no approximation model
  const motor = input.motor;
  const netTurns = motor?.turnsLoaded !== undefined && motor?.backoffTurns !== undefined
    ? Math.max(0, motor.turnsLoaded - motor.backoffTurns)
    : undefined;
  const rrValue = netTurns !== undefined && netTurns > 0 && motor?.remainingTurns !== undefined
    ? Math.min(1, Math.max(0, motor.remainingTurns / netTurns))
    : undefined;
  const remainingTurnsRatio: PhysicsLabResult['remainingTurnsRatio'] = rrValue !== undefined
    ? {
        value: Math.round(rrValue * 1000) / 10,
        unit: '%',
        provenance: 'calculated',
        confidence: 'high',
        source: `${motor?.remainingTurns} / ${netTurns} × 100`,
        notes: `${(rrValue * 100).toFixed(1)}% de vueltas netas restantes al aterrizar`,
      }
    : undefined;

  const result: PhysicsLabResult = {
    linearDensity: ldCalc.result,
    initialPower: ipCalc.result,
    averagePower: apCalc.result,
    verticalSpeed: vsCalc.result,
    requiredPower: rpCalc.result,
    energyUseRatio: erCalc.result,
    remainingTurnsRatio,
    rpmEquivalent: coherence.rpmEquivalent,
    rpmCoherenceDevioPct: coherence.devioPct,
    rpmCoherenceStatus: coherence.status === 'sin_datos' ? undefined : coherence.status,
    ceilingUse,
    propellerLoadRatio: loadRatio.result,
    propellerLoadClass: loadClass,
    assumptions: [...new Set(allAssumptions)],
    missingData: uniqueMissing,
    warnings: [...new Set(allWarnings)],
    confidence: mergeConfidence(criticalResults, torqueUnitBlocked, uniqueMissing.length, coherence.degradeConfidence),
  };

  const recommendations = generateRecommendations(input, result);

  return { result, recommendations };
}
