import type { PhysicalValue, PhysicsLabInput, RpmCoherenceStatus } from './types';

export type CoherenceResult = {
  rpmEquivalent?: PhysicalValue<number>;
  devioPct?: number;
  status: RpmCoherenceStatus | 'sin_datos';
  warnings: string[];
  missing: string[];
  degradeConfidence: boolean;
};

export function checkRpmCoherence(
  motor: PhysicsLabInput['motor'],
  flight: PhysicsLabInput['flight'],
): CoherenceResult {
  const missing: string[] = [];

  const turnsLoaded = motor?.turnsLoaded;
  const backoff = motor?.backoffTurns;
  const remaining = motor?.remainingTurns;
  const durationSec = flight?.durationSec;
  const rpmMid = flight?.rpmMid;

  if (turnsLoaded === undefined) missing.push('vueltas cargadas');
  if (backoff === undefined) missing.push('back-off');
  if (remaining === undefined) missing.push('vueltas remanentes');
  if (!durationSec) missing.push('duración del vuelo');

  if (missing.length > 0) {
    return { status: 'sin_datos', warnings: [], missing, degradeConfidence: false };
  }

  const netTurns = Math.max(0, turnsLoaded! - backoff!);
  const usedTurns = Math.max(0, netTurns - remaining!);
  const rpmEquivalentValue = durationSec! > 0 ? (usedTurns / durationSec!) * 60 : 0;

  const rpmEquivalent: PhysicalValue<number> = {
    value: Math.round(rpmEquivalentValue * 10) / 10,
    unit: 'rpm',
    provenance: 'calculated',
    confidence: 'high',
    source: `(${usedTurns} vueltas usadas / ${durationSec} s) × 60`,
    notes: `vueltas netas ${netTurns}, usadas ${usedTurns}`,
  };

  if (!rpmMid) {
    return {
      rpmEquivalent,
      status: 'sin_datos',
      warnings: [],
      missing: ['RPM media (para verificar coherencia)'],
      degradeConfidence: false,
    };
  }

  if (rpmEquivalentValue <= 0) {
    return {
      rpmEquivalent,
      status: 'sin_datos',
      warnings: ['RPM equivalente calculada es cero o negativa; verificar datos de vueltas.'],
      missing: [],
      degradeConfidence: false,
    };
  }

  const devioPct = Math.abs(rpmEquivalentValue - rpmMid) / rpmEquivalentValue * 100;
  const devioPctR = Math.round(devioPct * 10) / 10;

  let status: RpmCoherenceStatus;
  const warnings: string[] = [];
  let degradeConfidence = false;

  if (devioPct < 10) {
    status = 'buena';
  } else if (devioPct <= 20) {
    status = 'advertencia_leve';
    warnings.push(
      `RPM media registrada (${rpmMid} rpm) difiere ${devioPctR}% de la equivalente por vueltas (${rpmEquivalentValue.toFixed(1)} rpm). Desvío leve: verificar criterio de medición.`,
    );
  } else if (devioPct <= 35) {
    status = 'advertencia_alta';
    degradeConfidence = true;
    warnings.push(
      `Advertencia: la RPM media registrada (${rpmMid} rpm) no coincide con las vueltas consumidas (equivalente ${rpmEquivalentValue.toFixed(1)} rpm, desvío ${devioPctR}%). Revisar tacómetro, conteo de vueltas remanentes o criterio de RPM media. Confianza física degradada a baja.`,
    );
  } else {
    status = 'no_usar';
    degradeConfidence = true;
    warnings.push(
      `Alerta: desvío de RPM media muy alto (${devioPctR}%). No usar RPM media para recomendación fina. Revisar tacómetro, conteo de vueltas o duración registrada.`,
    );
  }

  return { rpmEquivalent, devioPct: devioPctR, status, warnings, missing: [], degradeConfidence };
}

export function calculateCeilingUse(
  flight: PhysicsLabInput['flight'],
  venue: PhysicsLabInput['venue'],
): PhysicalValue<number> | { missing: string } {
  const maxAlt = flight?.maxAltitudeM;
  const ceiling = venue?.ceilingHeightM;

  if (!ceiling) return { missing: 'No se puede evaluar uso de techo porque falta altura útil del salón.' };
  if (maxAlt === undefined) return { missing: 'Falta altitud máxima del vuelo.' };

  const usePct = Math.min(100, Math.round((maxAlt / ceiling) * 1000) / 10);

  return {
    value: usePct,
    unit: '%',
    provenance: 'calculated',
    confidence: 'high',
    source: `${maxAlt} m / ${ceiling} m × 100`,
    notes: `${venue?.name ?? 'salón'} — techo útil ${ceiling} m`,
  };
}
