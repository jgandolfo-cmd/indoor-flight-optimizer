import { analyzePhysicsLab } from '../index';
import { sampleF1MFlight, sampleUnknownTorqueUnit } from '../data/samplePhysicsData';
import type { PhysicsLabInput } from '../core/types';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

// Test: sample F1M flight → produces recommendations without errors
const { result: r1, recommendations: recs1 } = analyzePhysicsLab(sampleF1MFlight);
assert(Array.isArray(recs1), 'recommendations is array');
assert(recs1.length > 0, 'at least one recommendation for sample F1M');
assert(typeof r1.confidence === 'string', 'result.confidence is string');
assert(r1.linearDensity !== undefined, 'linearDensity defined for sample F1M');
assert(r1.initialPower !== undefined, 'initialPower defined when torque + RPM present');

// Test: unknown torque unit → no initialPower + warning
const { result: r2 } = analyzePhysicsLab(sampleUnknownTorqueUnit);
assert(r2.initialPower === undefined, 'unknown torque unit → no initialPower');
assert(r2.warnings.some((w) => w.includes('unidad de torque') || w.includes('torque')), 'unknown torque unit → warning present');

// Test: unstable flight → trim recommendation (Regla E)
const unstableInput: PhysicsLabInput = {
  ...sampleF1MFlight,
  flight: { ...sampleF1MFlight.flight, stability: 'oscillating' },
};
const { recommendations: recsUnstable } = analyzePhysicsLab(unstableInput);
assert(
  recsUnstable.some((r) => r.targetVariable === 'trim'),
  'unstable flight → trim recommendation',
);
assert(
  recsUnstable.every((r) => r.targetVariable === 'trim' || r.targetVariable === 'measure_more'),
  'unstable flight → only trim/measure_more recommendations (no energy optimization)',
);

// Test: early ceiling touch → backoff recommendation (Regla D)
const earlyCeilingInput: PhysicsLabInput = {
  ...sampleF1MFlight,
  flight: {
    ...sampleF1MFlight.flight,
    stability: 'stable',
    touchedCeiling: 'hard',
    timeToMaxAltitudeSec: 15,
    durationSec: 1180,
  },
};
const { recommendations: recsCeiling } = analyzePhysicsLab(earlyCeilingInput);
assert(
  recsCeiling.some((r) => r.targetVariable === 'backoff'),
  'early ceiling → backoff recommendation',
);

console.log('recommendations.test.ts: all assertions passed');

export {};
