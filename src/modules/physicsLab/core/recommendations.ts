import type { PhysicsLabInput, PhysicsLabRecommendation, PhysicsLabResult } from './types';
import { analyzeVpData } from './vpObserved';
import { applyGuards } from './safetyGuards';

function rec(base: Omit<PhysicsLabRecommendation, 'blocked' | 'blockReason'>): PhysicsLabRecommendation {
  return base;
}

function isTouchingCeilingEarly(flight: PhysicsLabInput['flight']): boolean {
  const touched = flight?.touchedCeiling;
  if (!touched || touched === 'no') return false;
  const t = flight?.timeToMaxAltitudeSec;
  const dur = flight?.durationSec;
  if (t !== undefined && dur !== undefined && dur > 0) {
    return t < dur * 0.30;
  }
  return touched === 'hard' || touched === 'light';
}

function isStable(flight: PhysicsLabInput['flight']): boolean {
  const s = flight?.stability;
  if (!s) return true;
  return s === 'stable' || s === 'estable';
}

export function generateRecommendations(
  input: PhysicsLabInput,
  result: PhysicsLabResult,
): PhysicsLabRecommendation[] {
  const recommendations: PhysicsLabRecommendation[] = [];
  const vp = analyzeVpData(input.propeller, input.category);
  const motor = input.motor;
  const flight = input.flight;

  const hasRpmData = Boolean(flight?.rpmInitial && flight?.rpmFinal);
  const hasTorqueData = Boolean(motor?.launchTorque);
  const hasRemainingData = motor?.remainingTurns !== undefined && motor?.turnsLoaded !== undefined;
  const netTurns = motor?.turnsLoaded && motor?.backoffTurns !== undefined
    ? Math.max(0, motor.turnsLoaded - motor.backoffTurns)
    : undefined;
  const remainingRatio = netTurns && motor?.remainingTurns !== undefined && netTurns > 0
    ? motor.remainingTurns / netTurns
    : undefined;
  const highRemaining = remainingRatio !== undefined && remainingRatio > 0.18;
  const rpmFinalLow = result.propellerLoadClass === 'overloaded';
  const rpmFinalHigh = result.propellerLoadClass === 'unloaded';
  const touchingCeilingEarly = isTouchingCeilingEarly(flight);
  const stable = isStable(flight);

  // Regla A: faltan datos críticos de torque o RPM
  if (!hasTorqueData || !hasRpmData) {
    const missingItems: string[] = [];
    if (!hasTorqueData) missingItems.push('torque de lanzamiento');
    if (!hasRpmData) missingItems.push('RPM inicial y RPM final');

    recommendations.push(rec({
      title: 'Datos insuficientes para análisis físico',
      recommendation: 'Medir torque inicial y RPM inicial/final antes de ajustar motor o hélice.',
      targetVariable: 'measure_more',
      direction: 'unknown',
      rationale: ['Sin torque y RPM no se puede calcular potencia ni clasificar carga de hélice.'],
      evidenceUsed: [],
      assumptionsUsed: [],
      missingData: missingItems,
      doNotTouch: ['motor', 'hélice', 'vueltas cargadas'],
      confidence: 'high',
      riskLevel: 'low',
    }));
  }

  // Regla E: vuelo inestable — tiene prioridad sobre optimización
  if (!stable) {
    recommendations.push(applyGuards(rec({
      title: 'Vuelo inestable: no optimizar energía todavía',
      recommendation: 'Revisar trimado y repetir baseline antes de cambiar motor o hélice.',
      targetVariable: 'trim',
      direction: 'inspect',
      rationale: ['La inestabilidad domina la lectura. Un vuelo inestable no permite interpretar el uso de energía.'],
      evidenceUsed: [`estabilidad: ${flight?.stability ?? 'desconocida'}`],
      assumptionsUsed: [],
      missingData: [],
      doNotTouch: ['motor', 'hélice', 'vueltas cargadas', 'back-off'],
      confidence: 'high',
      riskLevel: 'low',
    }), input));
    return recommendations;
  }

  // Regla D: toca techo temprano
  if (touchingCeilingEarly) {
    const hasVpMaxData = vp.hasVp && vp.canAdjustMaxPitch;
    const target = hasVpMaxData ? 'backoff' : 'backoff';
    const magnitude = hasVpMaxData
      ? '+30 a +50 vueltas de back-off (o revisar paso máximo VP)'
      : '+30 a +50 vueltas de back-off';

    recommendations.push(applyGuards(rec({
      title: 'Exceso de energía inicial — techo temprano',
      recommendation: hasVpMaxData
        ? 'Aumentar back-off o revisar paso máximo VP. Cambiar una sola variable.'
        : 'Aumentar back-off en pasos pequeños.',
      targetVariable: target,
      direction: 'increase',
      magnitude,
      rationale: [
        'El modelo llega al techo antes del 30% del vuelo.',
        'Hay energía concentrada al inicio que excede la altura disponible.',
      ],
      evidenceUsed: [
        `timeToMaxAltitude: ${flight?.timeToMaxAltitudeSec ?? 'no registrado'} s`,
        `durationSec: ${flight?.durationSec ?? 'no registrado'} s`,
        `touchedCeiling: ${String(flight?.touchedCeiling ?? 'no')}`,
      ],
      assumptionsUsed: [],
      missingData: [],
      doNotTouch: ['motor', 'CG', 'resorte VP', 'trimado'],
      confidence: hasRpmData ? 'medium' : 'low',
      riskLevel: 'low',
    }), input));
  }

  // Regla B: remanente alto + RPM final baja + sin techo
  if (
    highRemaining
    && rpmFinalLow
    && !touchingCeilingEarly
    && stable
    && hasRpmData
    && hasRemainingData
  ) {
    const hasMinPitch = vp.hasVp && vp.canAdjustMinPitch;
    const currentMinPitch = input.propeller?.minPitchMm;
    const suggestedMinPitch = currentMinPitch ? Math.round(currentMinPitch * 0.96) : undefined;
    const magnitude = hasMinPitch && currentMinPitch
      ? `minPitch ${currentMinPitch} → ${suggestedMinPitch} mm (−4%)`
      : 'inspeccionar fricción o reducir paso mínimo levemente';

    recommendations.push(applyGuards(rec({
      title: 'Energía remanente alta con RPM final baja',
      recommendation: hasMinPitch
        ? 'Reducir paso mínimo VP levemente o inspeccionar fricción.'
        : 'Inspeccionar fricción en eje, gancho y cojinetes.',
      targetVariable: hasMinPitch ? 'min_pitch' : 'friction',
      direction: hasMinPitch ? 'decrease' : 'inspect',
      magnitude,
      rationale: [
        'El motor llega con vueltas sobrantes y la RPM final es baja.',
        'Probable causa: paso mínimo VP demasiado alto o fricción mecánica.',
      ],
      evidenceUsed: [
        `remainingRatio: ${remainingRatio !== undefined ? (remainingRatio * 100).toFixed(1) : '—'}%`,
        `propellerLoadClass: ${result.propellerLoadClass ?? '—'}`,
        `RPM final: ${flight?.rpmFinal ?? '—'}`,
      ],
      assumptionsUsed: [],
      missingData: [],
      doNotTouch: ['motor', 'CG', 'resorte VP'],
      confidence: 'medium',
      riskLevel: 'low',
    }), input));
  }

  // Regla C: remanente alto + RPM final alta
  if (
    highRemaining
    && rpmFinalHigh
    && !touchingCeilingEarly
    && stable
    && hasRpmData
    && hasRemainingData
  ) {
    const hasMinPitch = vp.hasVp && vp.canAdjustMinPitch;
    const currentMinPitch = input.propeller?.minPitchMm;
    const suggestedMinPitch = currentMinPitch ? Math.round(currentMinPitch * 1.03) : undefined;
    const magnitude = hasMinPitch && currentMinPitch
      ? `minPitch ${currentMinPitch} → ${suggestedMinPitch} mm (+3%)`
      : '+2% a +4% en paso mínimo';

    recommendations.push(applyGuards(rec({
      title: 'Hélice descargada al final — RPM alta con remanente',
      recommendation: 'Aumentar paso mínimo VP levemente para cargar la hélice en la fase final.',
      targetVariable: 'min_pitch',
      direction: 'increase',
      magnitude,
      rationale: [
        'La RPM final es alta pero hay vueltas remanentes.',
        'La hélice no está convirtiendo la energía disponible en empuje útil.',
      ],
      evidenceUsed: [
        `remainingRatio: ${remainingRatio !== undefined ? (remainingRatio * 100).toFixed(1) : '—'}%`,
        `propellerLoadClass: ${result.propellerLoadClass ?? '—'}`,
        `RPM final: ${flight?.rpmFinal ?? '—'}`,
      ],
      assumptionsUsed: [],
      missingData: !hasMinPitch ? ['paso mínimo VP (minPitchMm)'] : [],
      doNotTouch: ['motor', 'CG', 'resorte VP'],
      confidence: hasMinPitch ? 'medium' : 'low',
      riskLevel: 'low',
    }), input));
  }

  // Regla F: configuración parece buena
  const goodEnergy = result.energyUseRatio && result.energyUseRatio.value > 0.6;
  const goodRemainder = remainingRatio !== undefined && remainingRatio >= 0.03 && remainingRatio <= 0.18;
  if (
    !touchingCeilingEarly
    && stable
    && goodEnergy
    && goodRemainder
    && recommendations.length === 0
  ) {
    recommendations.push(rec({
      title: 'Configuración razonable — repetir baseline',
      recommendation: 'El perfil energético parece equilibrado. Repetir con la misma configuración para confirmar.',
      targetVariable: 'repeat_baseline',
      direction: 'repeat',
      rationale: [
        'Uso energético aceptable sin exceso de remanente ni techo temprano.',
        'Vuelo estable: la lectura es confiable.',
      ],
      evidenceUsed: [
        `energyUseRatio: ${result.energyUseRatio ? (result.energyUseRatio.value * 100).toFixed(1) : '—'}%`,
        `remainingRatio: ${remainingRatio !== undefined ? (remainingRatio * 100).toFixed(1) : '—'}%`,
        `estabilidad: ${flight?.stability ?? 'no registrada'}`,
      ],
      assumptionsUsed: result.assumptions,
      missingData: [],
      doNotTouch: ['motor', 'hélice', 'vueltas cargadas', 'back-off', 'trimado'],
      confidence: 'medium',
      riskLevel: 'low',
    }));
  }

  if (recommendations.length === 0) {
    recommendations.push(rec({
      title: 'Datos insuficientes para recomendar',
      recommendation: 'Registrar RPM inicial, RPM final, torque y vueltas remanentes para generar recomendaciones.',
      targetVariable: 'measure_more',
      direction: 'unknown',
      rationale: ['No hay suficientes datos físicos para aplicar las reglas de recomendación.'],
      evidenceUsed: [],
      assumptionsUsed: [],
      missingData: result.missingData,
      doNotTouch: [],
      confidence: 'low',
      riskLevel: 'low',
    }));
  }

  return recommendations;
}
