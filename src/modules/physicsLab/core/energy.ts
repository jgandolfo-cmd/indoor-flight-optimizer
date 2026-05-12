import type { CalcOutput, PhysicsLabInput } from './types';

export function estimateEnergyRemaining(motor: PhysicsLabInput['motor']): CalcOutput {
  const missing: string[] = [];

  if (motor?.turnsLoaded === undefined) missing.push('vueltas cargadas (turnsLoaded)');
  if (motor?.remainingTurns === undefined) missing.push('vueltas remanentes (remainingTurns)');
  if (motor?.backoffTurns === undefined) missing.push('back-off (backoffTurns)');

  if (missing.length > 0) return { missing, warnings: [], assumptions: [] };

  const turnsLoaded = motor!.turnsLoaded!;
  const backoff = motor!.backoffTurns!;
  const remaining = motor!.remainingTurns!;
  const netTurns = Math.max(0, turnsLoaded - backoff);

  if (netTurns === 0) {
    return {
      missing: [],
      warnings: ['Vueltas netas = 0: no hay energía disponible.'],
      assumptions: [],
    };
  }

  const remainingRatio = Math.min(1, Math.max(0, remaining / netTurns));
  const energyUseRatio = 1 - Math.sqrt(remainingRatio);

  return {
    result: {
      value: Math.round(energyUseRatio * 1000) / 1000,
      unit: 'ratio [0–1]',
      provenance: 'estimated',
      confidence: 'low',
      source: `1 − √(${remaining}/${netTurns})`,
      notes: `${(energyUseRatio * 100).toFixed(1)}% de energía utilizada (estimación por modelo cuadrático de goma)`,
      uncertainty: 0.15,
    },
    missing: [],
    warnings: [],
    assumptions: [
      'modelo cuadrático de goma: energía ∝ vueltas²',
      'energyUseRatio = 1 − √(remainingTurns / netTurns)',
    ],
  };
}
