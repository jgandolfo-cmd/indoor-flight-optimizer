import type { CalcOutput, PhysicsLabInput } from './types';
import { convertTorqueToNm, gramsToKilograms, rpmToRadPerSecond } from './units';
import { GRAVITY_MPS2 } from './constants';

const F1M_POWER_WARN_W = 1.0;

export function calculateInitialPower(
  motor: PhysicsLabInput['motor'],
  flight: PhysicsLabInput['flight'],
): CalcOutput {
  const missing: string[] = [];

  if (!motor?.launchTorque) missing.push('torque de lanzamiento (launchTorque)');
  if (!flight?.rpmInitial) missing.push('RPM inicial (rpmInitial)');

  if (missing.length > 0) return { missing, warnings: [], assumptions: [] };

  const torqueUnit = motor!.launchTorqueUnit;
  if (!torqueUnit || torqueUnit === 'unknown') {
    return {
      missing: [],
      warnings: [],
      assumptions: [],
      result: undefined,
      // No result: signal via missing
    };
  }

  const torqueNm = convertTorqueToNm(motor!.launchTorque!, torqueUnit);
  const omegaRad = rpmToRadPerSecond(flight!.rpmInitial!);

  // P[W] = torque[N·m] × ω[rad/s]
  const powerW = torqueNm * omegaRad;
  const powerMw = powerW * 1000;

  const warnings: string[] = [];
  if (powerW > F1M_POWER_WARN_W) {
    warnings.push(
      `Potencia inicial alta (${powerW.toFixed(2)} W = ${powerMw.toFixed(0)} mW): verifique unidad de torque. ` +
      `Para F1M, la potencia típica es del orden de decenas a centenas de mW.`,
    );
  }

  return {
    result: {
      value: Math.round(powerW * 10000) / 10000,
      unit: 'W',
      provenance: 'calculated',
      confidence: 'high',
      source: `P = τ × ω = ${torqueNm.toFixed(6)} N·m × ${omegaRad.toFixed(2)} rad/s`,
      notes: `${powerMw.toFixed(1)} mW`,
    },
    missing: [],
    warnings,
    assumptions: [],
  };
}

export function calculateInitialPowerBlocked(torqueUnit: string | undefined): CalcOutput {
  if (!torqueUnit || torqueUnit === 'unknown') {
    return {
      missing: ['unidad de torque verificada (launchTorqueUnit ≠ unknown)'],
      warnings: ['No se puede calcular potencia porque la unidad de torque no está verificada.'],
      assumptions: [],
    };
  }
  return { missing: [], warnings: [], assumptions: [] };
}

export function calculateAveragePowerEstimate(initialPower: CalcOutput): CalcOutput {
  if (!initialPower.result) {
    return {
      missing: ['potencia inicial calculada (requiere torque + RPM con unidades verificadas)'],
      warnings: [],
      assumptions: [],
    };
  }

  const avgW = initialPower.result.value * 0.5;

  return {
    result: {
      value: Math.round(avgW * 10000) / 10000,
      unit: 'W',
      provenance: 'estimated',
      confidence: 'low',
      source: 'potenciaInicial × 0.5',
      notes: `${(avgW * 1000).toFixed(1)} mW`,
      uncertainty: 0.3,
    },
    missing: [],
    warnings: [],
    assumptions: [
      'potencia media ≈ 50% de la potencia inicial (aproximación lineal de descarga)',
      'no considera pérdidas por fricción ni transición VP',
    ],
  };
}

export function calculateRequiredPowerApprox(
  model: PhysicsLabInput['model'],
  verticalSpeed: CalcOutput | undefined,
): CalcOutput {
  const missing: string[] = [];

  if (!model?.weightG) missing.push('peso del modelo (weightG)');
  if (!verticalSpeed?.result) missing.push('velocidad vertical (calcular primero calculateVerticalSpeed)');

  if (missing.length > 0) return { missing, warnings: [], assumptions: [] };

  const weightN = gramsToKilograms(model!.weightG!) * GRAVITY_MPS2;
  const vMs = verticalSpeed!.result!.value;
  const powerW = weightN * vMs;

  return {
    result: {
      value: Math.round(powerW * 10000) / 10000,
      unit: 'W',
      provenance: 'calculated',
      confidence: 'medium',
      source: `P = W·v = ${weightN.toFixed(4)} N × ${vMs.toFixed(3)} m/s`,
      notes: `${(powerW * 1000).toFixed(1)} mW`,
    },
    missing: [],
    warnings: [],
    assumptions: [
      'potencia requerida = peso × velocidad vertical (sin resistencia aerodinámica)',
      'subestima la potencia real necesaria porque no incluye drag',
    ],
  };
}
