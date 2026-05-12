import type { PhysicsLabInput } from './types';

export type VpAnalysis = {
  hasVp: boolean;
  mechanismKnown: boolean;
  canAdjustSpring: boolean;
  canAdjustMinPitch: boolean;
  canAdjustMaxPitch: boolean;
  notes: string[];
};

export function analyzeVpData(
  propeller: PhysicsLabInput['propeller'],
  category: PhysicsLabInput['category'],
): VpAnalysis {
  const hasVp = propeller?.propType === 'variable_pitch';
  const notes: string[] = [];

  if (!hasVp) {
    return {
      hasVp: false,
      mechanismKnown: false,
      canAdjustSpring: false,
      canAdjustMinPitch: false,
      canAdjustMaxPitch: false,
      notes: ['hélice de paso fijo: no aplican ajustes VP'],
    };
  }

  const vpAllowed = category === 'F1M' || category === undefined;
  if (!vpAllowed) {
    notes.push(`VP no permitida en categoría ${category}: no se emitirán recomendaciones VP.`);
    return {
      hasVp: true,
      mechanismKnown: false,
      canAdjustSpring: false,
      canAdjustMinPitch: false,
      canAdjustMaxPitch: false,
      notes,
    };
  }

  const mechanismKnown = propeller?.vpMechanismMode !== undefined
    && propeller.vpMechanismMode !== 'unknown';

  if (!mechanismKnown) {
    notes.push('Mecanismo VP desconocido: no se ajustará resorte hasta registrar el sentido.');
  }

  const canAdjustMinPitch = propeller?.minPitchMm !== undefined || propeller?.minPitchDeg !== undefined;
  const canAdjustMaxPitch = propeller?.maxPitchMm !== undefined || propeller?.maxPitchDeg !== undefined;

  if (!canAdjustMinPitch) notes.push('Paso mínimo VP no registrado.');
  if (!canAdjustMaxPitch) notes.push('Paso máximo VP no registrado.');

  return {
    hasVp,
    mechanismKnown,
    canAdjustSpring: mechanismKnown,
    canAdjustMinPitch,
    canAdjustMaxPitch,
    notes,
  };
}
