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

import type { PhysicsLabInput, PhysicsLabResult, PhysicsLabRecommendation } from './core/types';
import { calculateLinearDensity } from './core/rubber';
import { estimateEnergyRemaining } from './core/energy';
import { calculateInitialPower, calculateAveragePowerEstimate, calculateRequiredPowerApprox } from './core/power';
import { calculateVerticalSpeed } from './core/flightMetrics';
import { classifyPropellerLoad } from './core/propellerLoad';
import { generateRecommendations } from './core/recommendations';

function mergeConfidence(missing: string[]): PhysicsLabResult['confidence'] {
  if (missing.length > 4) return 'low';
  if (missing.length > 1) return 'medium';
  return 'high';
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

  const result: PhysicsLabResult = {
    linearDensity: ldCalc.result,
    initialPower: ipCalc.result,
    averagePower: apCalc.result,
    verticalSpeed: vsCalc.result,
    requiredPower: rpCalc.result,
    energyUseRatio: erCalc.result,
    propellerLoadRatio: loadRatio.result,
    propellerLoadClass: loadClass,
    assumptions: [...new Set(allAssumptions)],
    missingData: [...new Set(allMissing)],
    warnings: [...new Set(allWarnings)],
    confidence: mergeConfidence([...new Set(allMissing)]),
  };

  const recommendations = generateRecommendations(input, result);

  return { result, recommendations };
}
