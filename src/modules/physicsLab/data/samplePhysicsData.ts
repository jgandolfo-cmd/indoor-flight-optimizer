import type { PhysicsLabInput } from '../core/types';

export const sampleF1MFlight: PhysicsLabInput = {
  category: 'F1M',
  model: {
    name: 'F1M ejemplo',
    weightG: 7.5,
    wingspanMm: 450,
    wingAreaDm2: 5.5,
  },
  motor: {
    name: 'Motor 1.2g × 430mm',
    rubberMassG: 1.2,
    loopLengthMm: 430,
    strandCount: 1,
    turnsLoaded: 380,
    backoffTurns: 40,
    remainingTurns: 55,
    launchTorque: 62,
    launchTorqueUnit: 'mNm',
  },
  propeller: {
    name: 'Hélice VP 220mm',
    diameterMm: 220,
    propType: 'variable_pitch',
    minPitchMm: 85,
    maxPitchMm: 135,
    springHardness: 3,
    vpMechanismMode: 'torque_opens_to_high_pitch',
  },
  flight: {
    durationSec: 1180,
    maxAltitudeM: 7.8,
    timeToMaxAltitudeSec: 45,
    touchedCeiling: 'light',
    rpmInitial: 1850,
    rpmMid: 1420,
    rpmFinal: 980,
    descentType: 'smooth',
    stability: 'stable',
    notes: 'Vuelo de ejemplo para Physics Lab. Datos estimados para demostración.',
  },
  sourceType: 'synthetic',
};

// Danjo case: densidad publicada 2.2 g/m, loop 329 mm, 2 hebras.
// rubberMassG = 2.2 × 0.329 × 2 = 1.4476 g
// Datos de vuelo: parcialmente reales, torque no verificado.
export const sampleDanjoF1M: PhysicsLabInput = {
  category: 'F1M',
  motor: {
    name: 'Danjo F1M — goma 2.2 g/m',
    rubberMassG: 1.4476,
    linearDensityGPerM: 2.2,
    loopLengthMm: 329,
    strandCount: 2,
    turnsLoaded: 1900,
    backoffTurns: 6,
    remainingTurns: 109,
    launchTorqueUnit: 'unknown',
  },
  propeller: {
    propType: 'variable_pitch',
    vpMechanismMode: 'unknown',
  },
  flight: {
    stability: 'stable',
    notes: 'Caso Danjo: densidad publicada 2.2 g/m, loop 329 mm × 2 hebras. Torque sin verificar.',
  },
  sourceType: 'published_partial',
};

export const sampleHighPower: PhysicsLabInput = {
  category: 'F1M',
  model: {
    name: 'F1M alto torque',
    weightG: 7.5,
  },
  motor: {
    rubberMassG: 1.4,
    loopLengthMm: 400,
    strandCount: 1,
    turnsLoaded: 420,
    backoffTurns: 50,
    remainingTurns: 20,
    launchTorque: 1850,
    launchTorqueUnit: 'mNm',
  },
  flight: {
    durationSec: 1100,
    rpmInitial: 1850,
    rpmFinal: 1200,
    stability: 'stable',
    notes: 'Caso con torque alto para demostrar advertencia de potencia.',
  },
  sourceType: 'synthetic',
};

export const sampleUnknownTorqueUnit: PhysicsLabInput = {
  category: 'F1M',
  motor: {
    rubberMassG: 1.2,
    loopLengthMm: 430,
    turnsLoaded: 380,
    backoffTurns: 40,
    remainingTurns: 55,
    launchTorque: 62,
    launchTorqueUnit: 'unknown',
  },
  flight: {
    rpmInitial: 1850,
    rpmFinal: 980,
    stability: 'stable',
    notes: 'Caso con unidad de torque desconocida — no debe calcular potencia.',
  },
  sourceType: 'synthetic',
};
