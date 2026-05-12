import type { CalcOutput, PhysicsLabInput } from './types';

export function calculateLinearDensity(motor: PhysicsLabInput['motor']): CalcOutput {
  const missing: string[] = [];

  if (!motor?.rubberMassG) missing.push('masa de goma (rubberMassG)');
  if (!motor?.loopLengthMm) missing.push('longitud del loop (loopLengthMm)');

  if (missing.length > 0) return { missing, warnings: [], assumptions: [] };

  const massG = motor!.rubberMassG!;
  const loopMm = motor!.loopLengthMm!;
  const strands = motor?.strandCount ?? 1;
  const assumptions: string[] = [];
  const warnings: string[] = [];

  if (!motor?.strandCount) {
    assumptions.push('strandCount no indicado, se asume 1 hebra');
  }

  const totalLengthMm = loopMm * strands;
  const densityGPerM = massG / (totalLengthMm / 1000);

  if (densityGPerM > 8) {
    warnings.push(`Densidad lineal alta (${densityGPerM.toFixed(1)} g/m): verificar datos de entrada.`);
  }

  return {
    result: {
      value: Math.round(densityGPerM * 100) / 100,
      unit: 'g/m',
      provenance: 'calculated',
      confidence: motor?.strandCount ? 'high' : 'medium',
      source: `${massG} g / (${loopMm} mm × ${strands} hebra${strands !== 1 ? 's' : ''})`,
      notes: `${(massG / loopMm * 1000).toFixed(4)} g/mm`,
    },
    missing,
    warnings,
    assumptions,
  };
}
