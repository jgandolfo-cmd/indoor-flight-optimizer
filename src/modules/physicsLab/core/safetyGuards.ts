import type { PhysicsLabInput, PhysicsLabRecommendation } from './types';

type GuardResult = {
  blocked: boolean;
  reason?: string;
};

export function guardVpSpring(propeller: PhysicsLabInput['propeller']): GuardResult {
  if (propeller?.vpMechanismMode === 'unknown' || propeller?.vpMechanismMode === undefined) {
    return {
      blocked: true,
      reason: 'No se ajusta resorte VP sin conocer el sentido del mecanismo (torque_opens_to_high_pitch o torque_closes_to_low_pitch).',
    };
  }
  return { blocked: false };
}

export function guardVpNotAllowedInCategory(
  category: PhysicsLabInput['category'],
  propType: 'fixed' | 'variable_pitch' | undefined,
): GuardResult {
  if (propType !== 'variable_pitch') return { blocked: false };
  const vpAllowed = category === undefined || category === 'F1M';
  if (!vpAllowed) {
    return {
      blocked: true,
      reason: `VP no está permitida en categoría ${category}.`,
    };
  }
  return { blocked: false };
}

export function guardMultipleVariables(variables: string[]): GuardResult {
  const unique = [...new Set(variables)].filter((v) => v.trim().length > 0);
  if (unique.length > 1) {
    return {
      blocked: true,
      reason: `Se está sugiriendo cambiar múltiples variables (${unique.join(', ')}). Solo cambiar una variable por ensayo.`,
    };
  }
  return { blocked: false };
}

export function guardMaxTurnsUnknown(motor: PhysicsLabInput['motor']): GuardResult {
  if (!motor?.turnsLoaded) return { blocked: false };
  const turnsLoaded = motor.turnsLoaded;
  if (turnsLoaded > 800) {
    return {
      blocked: true,
      reason: `Vueltas cargadas altas (${turnsLoaded}): sin límite seguro de goma conocido, no se recomienda aumentar más.`,
    };
  }
  return { blocked: false };
}

// P25: maxWingspanMm = 250 (confirmado). Resto de reglas provisional hasta verificar reglamento.
export const CATEGORY_RULES = {
  F1M: { maxWingspanMm: 460, variablePitchAllowed: true },
  F1L: { maxWingspanMm: 650, variablePitchAllowed: false },
  EZB: { maxWingspanMm: 650, variablePitchAllowed: false },
  P25: { maxWingspanMm: 250, variablePitchAllowed: false, provisional: true },
} as const;

export function applyGuards(
  rec: PhysicsLabRecommendation,
  input: PhysicsLabInput,
): PhysicsLabRecommendation {
  const guards: GuardResult[] = [];

  if (rec.targetVariable === 'vp_transition' || rec.targetVariable === 'max_pitch' || rec.targetVariable === 'min_pitch') {
    guards.push(guardVpNotAllowedInCategory(input.category, input.propeller?.propType));
  }

  if (rec.targetVariable === 'vp_transition') {
    guards.push(guardVpSpring(input.propeller));
  }

  if (rec.targetVariable === 'turns_loaded') {
    guards.push(guardMaxTurnsUnknown(input.motor));
  }

  const firstBlocked = guards.find((g) => g.blocked);
  if (firstBlocked) {
    return { ...rec, blocked: true, blockReason: firstBlocked.reason };
  }
  return rec;
}
