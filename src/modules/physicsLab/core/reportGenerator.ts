import type { PhysicsLabInput, PhysicsLabRecommendation, PhysicsLabResult } from './types';

function line(label: string, value: string | number | undefined, unit = '') {
  if (value === undefined || value === null) return `  ${label}: —`;
  return `  ${label}: ${value}${unit ? ' ' + unit : ''}`;
}

function pv(label: string, v: { value: number; unit: string; confidence: string; notes?: string } | undefined) {
  if (!v) return `  ${label}: —`;
  return `  ${label}: ${v.value.toFixed(2)} ${v.unit} [confianza: ${v.confidence}]${v.notes ? ' — ' + v.notes : ''}`;
}

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

  // Datos cargados
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
    if (input.motor.linearDensityGPerM) sections.push(line('    densidad lineal', input.motor.linearDensityGPerM, 'g/m'));
    sections.push(line('    loop', input.motor.loopLengthMm, 'mm'));
    sections.push(line('    hebras', input.motor.strandCount));
    sections.push(line('    vueltas cargadas', input.motor.turnsLoaded));
    sections.push(line('    back-off (vueltas de descarga)', input.motor.backoffTurns));
    sections.push(line('    vueltas remanentes', input.motor.remainingTurns));
    if (input.motor.launchTorque) {
      sections.push(line('    torque de lanzamiento', input.motor.launchTorque, input.motor.launchTorqueUnit ?? ''));
    }
  }
  if (input.propeller) {
    sections.push('  Hélice:');
    if (input.propeller.name) sections.push(line('    nombre', input.propeller.name));
    sections.push(line('    tipo', input.propeller.propType === 'variable_pitch' ? 'paso variable (VP)' : 'paso fijo'));
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
    sections.push(line('    estabilidad', input.flight.stability));
  }
  sections.push('');

  // Resultados físicos
  sections.push('── RESULTADOS FÍSICOS ──────────────────────────────');
  sections.push(`  Confianza física global: ${result.confidence}`);
  sections.push(pv('  Densidad lineal', result.linearDensity));
  sections.push(pv('  Potencia inicial', result.initialPower));
  sections.push(pv('  Potencia media (estimada)', result.averagePower));
  sections.push(pv('  Velocidad vertical media', result.verticalSpeed));
  sections.push(pv('  Potencia requerida aprox.', result.requiredPower));
  sections.push(`  Remanente de vueltas: ${result.remainingTurnsRatio ? result.remainingTurnsRatio.value.toFixed(1) + ' %' : '—'}`);
  sections.push(`  Uso energético estimado: ${result.energyUseRatio ? (result.energyUseRatio.value * 100).toFixed(1) + ' %' : '—'}`);
  if (result.propellerLoadClass && result.propellerLoadClass !== 'unknown') {
    const loadLabel: Record<string, string> = { high_absorption: 'absorción alta', normal: 'normal', unloaded: 'baja absorción' };
    sections.push(`  Absorción de hélice: ${loadLabel[result.propellerLoadClass] ?? result.propellerLoadClass}`);
  }
  sections.push('');

  // Supuestos
  if (result.assumptions.length > 0) {
    sections.push('── SUPUESTOS ────────────────────────────────────────');
    result.assumptions.forEach((a) => sections.push(`  - ${a}`));
    sections.push('');
  }

  // Advertencias
  if (result.warnings.length > 0) {
    sections.push('── ADVERTENCIAS ─────────────────────────────────────');
    result.warnings.forEach((w) => sections.push(`  ⚠ ${w}`));
    sections.push('');
  }

  // Datos faltantes
  if (result.missingData.length > 0) {
    sections.push('── DATOS FALTANTES ──────────────────────────────────');
    result.missingData.forEach((m) => sections.push(`  - ${m}`));
    sections.push('');
  }

  // Recomendaciones
  if (recommendations.length > 0) {
    sections.push('── RECOMENDACIONES ──────────────────────────────────');
    recommendations.forEach((rec, i) => {
      sections.push(`\n  [${i + 1}] ${rec.title}`);
      sections.push(`  Confianza operativa: ${rec.confidence} | Riesgo: ${rec.riskLevel}`);
      if (rec.blocked) {
        sections.push(`  BLOQUEADA: ${rec.blockReason ?? ''}`);
      } else {
        sections.push(`  → ${rec.recommendation}`);
        if (rec.magnitude) sections.push(`  Magnitud: ${rec.magnitude}`);
        if (rec.operationalNote) sections.push(`  Nota: ${rec.operationalNote}`);
        if (rec.doNotTouch.length > 0) sections.push(`  No modificar: ${rec.doNotTouch.join(', ')}`);
      }
    });
    sections.push('');
  }

  sections.push('════════════════════════════════════════════════════');
  return sections.join('\n');
}
