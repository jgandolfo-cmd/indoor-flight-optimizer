import type { CalcOutput, PhysicsLabInput } from './types';

export function calculateVerticalSpeed(flight: PhysicsLabInput['flight']): CalcOutput {
  const missing: string[] = [];

  if (!flight?.maxAltitudeM) missing.push('altitud máxima (maxAltitudeM)');
  if (!flight?.timeToMaxAltitudeSec) missing.push('tiempo hasta altitud máxima (timeToMaxAltitudeSec)');

  if (missing.length > 0) return { missing, warnings: [], assumptions: [] };

  const altM = flight!.maxAltitudeM!;
  const timeSec = flight!.timeToMaxAltitudeSec!;

  if (timeSec <= 0) {
    return {
      missing: [],
      warnings: ['timeToMaxAltitudeSec debe ser mayor que cero.'],
      assumptions: [],
    };
  }

  const vMs = altM / timeSec;

  return {
    result: {
      value: Math.round(vMs * 1000) / 1000,
      unit: 'm/s',
      provenance: 'calculated',
      confidence: 'medium',
      source: `${altM} m / ${timeSec} s`,
      notes: 'velocidad vertical media de ascenso (no instantánea)',
    },
    missing: [],
    warnings: vMs > 3 ? [`Velocidad vertical alta (${vMs.toFixed(2)} m/s): verificar datos.`] : [],
    assumptions: ['ascenso lineal uniforme (aproximación)'],
  };
}
