import type { CalcOutput, TorqueSample } from './types';
import { turnsToRadians } from './units';

export function calculateEnergyFromTorqueCurve(samples: TorqueSample[]): CalcOutput {
  if (samples.length < 2) {
    return {
      missing: ['al menos 2 muestras de curva torque-vueltas'],
      warnings: [],
      assumptions: [],
    };
  }

  const sorted = [...samples].sort((a, b) => a.turns - b.turns);
  let energyJ = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const dTheta = turnsToRadians(cur.turns - prev.turns);
    const avgTorque = (prev.torqueNm + cur.torqueNm) / 2;
    energyJ += avgTorque * dTheta;
  }

  const warnings: string[] = [];
  if (energyJ < 0) {
    warnings.push('Energía calculada negativa: revisar orden de las muestras de torque.');
    energyJ = 0;
  }

  return {
    result: {
      value: Math.round(energyJ * 10000) / 10000,
      unit: 'J',
      provenance: 'calculated',
      confidence: 'medium',
      source: `integración trapezoidal de ${sorted.length} puntos`,
      notes: `${(energyJ * 1000).toFixed(1)} mJ`,
    },
    missing: [],
    warnings,
    assumptions: ['modelo lineal entre puntos de la curva'],
  };
}
