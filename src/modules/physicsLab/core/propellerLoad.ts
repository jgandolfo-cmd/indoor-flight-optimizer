import type { CalcOutput, PhysicsLabInput, PropellerLoadClass } from './types';

export function classifyPropellerLoad(flight: PhysicsLabInput['flight']): {
  loadClass: PropellerLoadClass;
  loadRatio: CalcOutput;
} {
  const rpmInitial = flight?.rpmInitial;
  const rpmFinal = flight?.rpmFinal;

  if (!rpmInitial || !rpmFinal || rpmInitial <= 0) {
    return {
      loadClass: 'unknown',
      loadRatio: {
        missing: ['RPM inicial y RPM final del vuelo'],
        warnings: [],
        assumptions: [],
      },
    };
  }

  const ratio = (rpmInitial - rpmFinal) / rpmInitial;

  let loadClass: PropellerLoadClass;
  if (ratio > 0.70) {
    loadClass = 'high_absorption';
  } else if (ratio >= 0.40) {
    loadClass = 'normal';
  } else {
    loadClass = 'unloaded';
  }

  return {
    loadClass,
    loadRatio: {
      result: {
        value: Math.round(ratio * 1000) / 1000,
        unit: 'ratio [0–1]',
        provenance: 'calculated',
        confidence: 'medium',
        source: `(${rpmInitial} - ${rpmFinal}) / ${rpmInitial}`,
        notes: `${(ratio * 100).toFixed(1)}% caída de RPM → hélice ${loadClass}`,
      },
      missing: [],
      warnings: [],
      assumptions: ['clasificación: >70% alta absorción, 40–70% normal, <40% descargada'],
    },
  };
}
