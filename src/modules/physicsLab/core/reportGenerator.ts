import type { PhysicsLabInput, PhysicsLabRecommendation, PhysicsLabResult } from './types';

// ── Tablas de traducción ──────────────────────────────────────────────────────

const CONFIDENCE_LABELS: Record<string, string> = {
  low: 'baja', medium: 'media', high: 'alta',
};

const RISK_LABELS: Record<string, string> = {
  low: 'bajo', medium: 'medio', high: 'alto',
};

const STABILITY_LABELS: Record<string, string> = {
  stable: 'estable', estable: 'estable',
  oscillating: 'oscilante', stalling: 'colgadas', diving: 'picado',
};

const TORQUE_UNIT_LABELS: Record<string, string> = {
  lbIn: 'lb·in', inLb: 'lb·in', lbfIn: 'lb·in',
  mNm: 'mN·m', Nmm: 'N·mm', gcm: 'g·cm', ozin: 'oz·in',
  unknown: '(unidad desconocida)',
};

const PROP_LOAD_LABELS: Record<string, string> = {
  high_absorption: 'absorción alta', normal: 'normal', unloaded: 'baja absorción',
};

// Reemplaza términos internos en inglés que puedan aparecer en notas/suposiciones
function translateTerms(text: string): string {
  return text
    .replace(/\bhigh_absorption\b/g, 'absorción alta')
    .replace(/\bunloaded\b/g, 'baja absorción')
    .replace(/\benergyUseRatio\b/g, 'uso energético estimado')
    .replace(/\bremainingTurns\b/g, 'vueltas remanentes')
    .replace(/\bnetTurns\b/g, 'vueltas netas')
    .replace(/\bdrag\b/g, 'resistencia aerodinámica')
    .replace(/\bstable\b/g, 'estable')
    .replace(/\blbIn\b/g, 'lb·in')
    .replace(/\bCG\b/g, 'centro de gravedad');
}

function conf(c: string) { return CONFIDENCE_LABELS[c] ?? c; }
function risk(r: string) { return RISK_LABELS[r] ?? r; }

function translateDoNotTouch(items: string[]): string {
  return items
    .map((item) => item === 'CG' ? 'centro de gravedad' : translateTerms(item))
    .join(', ');
}

// ── Helpers de formato ────────────────────────────────────────────────────────

function line(label: string, value: string | number | undefined, unit = '') {
  if (value === undefined || value === null) return `  ${label}: —`;
  return `  ${label}: ${value}${unit ? ' ' + unit : ''}`;
}

function pvLine(
  label: string,
  v: { value: number; unit: string; confidence: string; notes?: string } | undefined,
): string {
  if (!v) return `  ${label}: —`;

  let valueStr: string;
  if (v.unit === 'W' && v.value > 0 && v.value < 0.1) {
    // Potencia pequeña: mostrar en mW
    valueStr = `${(v.value * 1000).toFixed(1)} mW`;
  } else if (v.unit === 'W') {
    valueStr = `${v.value.toFixed(4)} W`;
  } else {
    valueStr = `${v.value.toFixed(2)} ${v.unit}`;
  }

  const confLabel = conf(v.confidence);
  const notes = v.notes ? ' — ' + translateTerms(v.notes) : '';
  return `  ${label}: ${valueStr} [confianza: ${confLabel}]${notes}`;
}

// ── Función principal ─────────────────────────────────────────────────────────

export function generateReport(
  input: PhysicsLabInput,
  result: PhysicsLabResult,
  recommendations: PhysicsLabRecommendation[],
  caseLabel?: string,
): string {
  const now = new Date().toLocaleString('es-AR');
  const sections: string[] = [];

  sections.push('=== LABORATORIO FÍSICO — INFORME ===');
  sections.push(`Fecha: ${now}`);
  if (caseLabel) sections.push(`Caso: ${caseLabel}`);
  sections.push('');

  // ── Datos cargados ──
  sections.push('── DATOS CARGADOS ──────────────────────────────────');
  sections.push(`  Categoría: ${input.category ?? 'F1M (por defecto)'}`);

  if (input.model) {
    sections.push('  Modelo:');
    sections.push(line('    nombre', input.model.name));
    sections.push(line('    peso', input.model.weightG, 'g'));
    sections.push(line('    envergadura', input.model.wingspanMm, 'mm'));
    sections.push(line('    área alar', input.model.wingAreaDm2, 'dm²'));
  }

  if (input.motor) {
    sections.push('  Motor / goma:');
    if (input.motor.name) sections.push(line('    nombre', input.motor.name));
    sections.push(line('    masa goma', input.motor.rubberMassG, 'g'));
    if (input.motor.linearDensityGPerM) {
      sections.push(line('    densidad lineal', input.motor.linearDensityGPerM, 'g/m'));
    }
    sections.push(line('    loop', input.motor.loopLengthMm, 'mm'));
    sections.push(line('    hebras', input.motor.strandCount));
    sections.push(line('    vueltas cargadas', input.motor.turnsLoaded));
    sections.push(line('    back-off (vueltas de descarga)', input.motor.backoffTurns));
    sections.push(line('    vueltas remanentes', input.motor.remainingTurns));
    if (input.motor.launchTorque !== undefined) {
      const unitLabel = TORQUE_UNIT_LABELS[input.motor.launchTorqueUnit ?? ''] ?? (input.motor.launchTorqueUnit ?? '');
      sections.push(line('    torque de lanzamiento', input.motor.launchTorque, unitLabel));
    }
  }

  if (input.propeller) {
    sections.push('  Hélice:');
    if (input.propeller.name) sections.push(line('    nombre', input.propeller.name));
    sections.push(line(
      '    tipo',
      input.propeller.propType === 'variable_pitch' ? 'paso variable (VP)' : 'paso fijo',
    ));
    sections.push(line('    diámetro', input.propeller.diameterMm, 'mm'));
    if (input.propeller.propType === 'variable_pitch') {
      sections.push(line('    paso mínimo', input.propeller.minPitchMm, 'mm'));
      sections.push(line('    paso máximo', input.propeller.maxPitchMm, 'mm'));
      sections.push(line('    dureza resorte', input.propeller.springHardness));
    }
  }

  if (input.flight) {
    sections.push('  Vuelo:');
    sections.push(line('    duración', input.flight.durationSec, 's'));
    sections.push(line('    altitud máxima', input.flight.maxAltitudeM, 'm'));
    sections.push(line('    RPM inicial', input.flight.rpmInitial));
    sections.push(line('    RPM media', input.flight.rpmMid));
    sections.push(line('    RPM final', input.flight.rpmFinal));
    const stability = input.flight.stability;
    sections.push(line('    estabilidad', stability ? (STABILITY_LABELS[stability] ?? stability) : undefined));
  }
  sections.push('');

  // ── Resultados físicos ──
  sections.push('── RESULTADOS FÍSICOS ──────────────────────────────');
  sections.push(`  Confianza física global: ${conf(result.confidence)}`);
  sections.push(pvLine('  Densidad lineal', result.linearDensity));
  sections.push(pvLine('  Potencia inicial', result.initialPower));
  sections.push(pvLine('  Potencia media (estimada)', result.averagePower));
  sections.push(pvLine('  Velocidad vertical media', result.verticalSpeed));
  sections.push(pvLine('  Potencia requerida aprox.', result.requiredPower));
  sections.push(`  Remanente de vueltas: ${result.remainingTurnsRatio ? result.remainingTurnsRatio.value.toFixed(1) + ' %' : '—'}`);
  sections.push(`  Uso energético estimado: ${result.energyUseRatio ? (result.energyUseRatio.value * 100).toFixed(1) + ' %' : '—'}`);
  if (result.propellerLoadClass && result.propellerLoadClass !== 'unknown') {
    sections.push(`  Absorción de hélice: ${PROP_LOAD_LABELS[result.propellerLoadClass] ?? result.propellerLoadClass}`);
  }
  sections.push('');

  // ── Supuestos ──
  if (result.assumptions.length > 0) {
    sections.push('── SUPUESTOS ────────────────────────────────────────');
    result.assumptions.forEach((a) => sections.push(`  - ${translateTerms(a)}`));
    sections.push('');
  }

  // ── Advertencias ──
  if (result.warnings.length > 0) {
    sections.push('── ADVERTENCIAS ─────────────────────────────────────');
    result.warnings.forEach((w) => sections.push(`  ⚠ ${translateTerms(w)}`));
    sections.push('');
  }

  // ── Datos faltantes ──
  if (result.missingData.length > 0) {
    sections.push('── DATOS FALTANTES ──────────────────────────────────');
    result.missingData.forEach((m) => sections.push(`  - ${translateTerms(m)}`));
    sections.push('');
  }

  // ── Recomendaciones ──
  if (recommendations.length > 0) {
    sections.push('── RECOMENDACIONES ──────────────────────────────────');
    recommendations.forEach((rec, i) => {
      sections.push(`\n  [${i + 1}] ${translateTerms(rec.title)}`);
      sections.push(`  Confianza operativa: ${conf(rec.confidence)} | Riesgo: ${risk(rec.riskLevel)}`);
      if (rec.blocked) {
        sections.push(`  BLOQUEADA: ${translateTerms(rec.blockReason ?? '')}`);
      } else {
        sections.push(`  → ${translateTerms(rec.recommendation)}`);
        if (rec.magnitude) sections.push(`  Magnitud: ${translateTerms(rec.magnitude)}`);
        if (rec.operationalNote) sections.push(`  Nota: ${rec.operationalNote}`);
        if (rec.doNotTouch.length > 0) {
          sections.push(`  No modificar: ${translateDoNotTouch(rec.doNotTouch)}`);
        }
      }
    });
    sections.push('');
  }

  sections.push('════════════════════════════════════════════════════');
  return sections.join('\n');
}
