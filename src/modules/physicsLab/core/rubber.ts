import type { CalcOutput, PhysicsLabInput } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function calculateLinearDensity(motor: PhysicsLabInput['motor']): CalcOutput {
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // Path A: linearDensityGPerM provided explicitly (published or calibrated value)
  if (motor?.linearDensityGPerM) {
    const publishedDensity = motor.linearDensityGPerM;
    const loopMm = motor.loopLengthMm;
    const strands = motor.strandCount ?? 1;

    if (!motor.strandCount) {
      assumptions.push('strandCount no indicado, se asume 1 para cálculo de masa desde densidad');
    }

    // Cross-check against rubberMassG if both are provided
    if (motor.rubberMassG && loopMm) {
      const derivedDensity = motor.rubberMassG / ((loopMm / 1000) * strands);
      const discrepancyPct = Math.abs(derivedDensity - publishedDensity) / publishedDensity * 100;
      if (discrepancyPct > 5) {
        warnings.push(
          `Inconsistencia entre densidad publicada (${publishedDensity} g/m) ` +
          `y masa/loop (${round2(derivedDensity)} g/m): diferencia ${round2(discrepancyPct)}%. ` +
          `Verificar rubberMassG, loopLengthMm y strandCount.`,
        );
      }
    }

    // Derive rubberMassG if not provided but loopLengthMm is present
    const derivedMassNote = loopMm
      ? `masa estimada = ${publishedDensity} × ${loopMm / 1000} m × ${strands} = ${round4(publishedDensity * (loopMm / 1000) * strands)} g`
      : undefined;

    return {
      result: {
        value: publishedDensity,
        unit: 'g/m',
        provenance: 'calibrated',
        confidence: 'high',
        source: 'linearDensityGPerM ingresado directamente',
        notes: derivedMassNote,
      },
      missing: [],
      warnings,
      assumptions,
    };
  }

  // Path B: calculate from rubberMassG + loopLengthMm
  const missing: string[] = [];
  if (!motor?.rubberMassG) missing.push('masa de goma (rubberMassG)');
  if (!motor?.loopLengthMm) missing.push('longitud del loop (loopLengthMm)');
  if (missing.length > 0) return { missing, warnings, assumptions };

  const massG = motor!.rubberMassG!;
  const loopMm = motor!.loopLengthMm!;
  const strands = motor?.strandCount ?? 1;

  if (!motor?.strandCount) {
    assumptions.push('strandCount no indicado, se asume 1 hebra');
  }

  // density = massG / (loopLengthM × strandCount)
  const loopM = loopMm / 1000;
  const densityGPerM = massG / (loopM * strands);

  if (densityGPerM > 8) {
    warnings.push(`Densidad lineal alta (${round2(densityGPerM)} g/m): verificar datos de entrada.`);
  }

  return {
    result: {
      value: round2(densityGPerM),
      unit: 'g/m',
      provenance: 'calculated',
      confidence: motor?.strandCount ? 'high' : 'medium',
      source: `${massG} g / (${loopMm} mm × ${strands} hebra${strands !== 1 ? 's' : ''})`,
      notes: `${round4(massG / loopMm * 1000)} g/mm`,
    },
    missing,
    warnings,
    assumptions,
  };
}

export function derivedMassFromDensity(motor: PhysicsLabInput['motor']): number | undefined {
  if (!motor?.linearDensityGPerM || !motor?.loopLengthMm) return undefined;
  const strands = motor.strandCount ?? 1;
  return motor.linearDensityGPerM * (motor.loopLengthMm / 1000) * strands;
}
