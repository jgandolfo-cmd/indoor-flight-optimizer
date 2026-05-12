import { estimateEnergyRemaining } from '../core/energy';
import { calculateEnergyFromTorqueCurve } from '../core/torque';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

function approxEqual(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol;
}

// estimateEnergyRemaining

// Missing data
const r1 = estimateEnergyRemaining({ turnsLoaded: 380 });
assert(r1.result === undefined, 'Missing remainingTurns + backoff → no result');

// Fully used motor (0 remaining / 340 net turns)
const r2 = estimateEnergyRemaining({ turnsLoaded: 380, backoffTurns: 40, remainingTurns: 0 });
assert(r2.result !== undefined, '0 remaining → result defined');
// energyUseRatio = 1 - sqrt(0/340) = 1
assert(approxEqual(r2.result!.value, 1.0, 0.001), '0 remaining → 100% energy used');

// 50% remaining turns
const r3 = estimateEnergyRemaining({ turnsLoaded: 380, backoffTurns: 40, remainingTurns: 170 });
// energyUseRatio = 1 - sqrt(170/340) = 1 - sqrt(0.5) ≈ 1 - 0.707 = 0.293
assert(r3.result !== undefined, '50% remaining turns → result defined');
assert(approxEqual(r3.result!.value, 0.293, 0.01), `50% remaining turns → ~29.3% energy used (got ${r3.result!.value})`);
assert(r3.result!.provenance === 'estimated', 'provenance = estimated');
assert(r3.assumptions.length > 0, 'assumptions present');

// calculateEnergyFromTorqueCurve

// Too few samples
const r4 = calculateEnergyFromTorqueCurve([{ turns: 380, torqueNm: 0.06 }]);
assert(r4.result === undefined, 'Single sample → no result');

// Linear curve: torque from 0.06 to 0.02 N·m over 0 to 380 turns
// E = integral(0 to 380 turns) of linear torque d(turns) × 2π
// avg_torque = (0.06 + 0.02)/2 = 0.04 N·m
// d_theta = 380 × 2π rad
// E = 0.04 × 380 × 2π ≈ 95.5 J
const r5 = calculateEnergyFromTorqueCurve([
  { turns: 0, torqueNm: 0.06 },
  { turns: 380, torqueNm: 0.02 },
]);
assert(r5.result !== undefined, 'Two samples → result defined');
const expected5 = 0.04 * 380 * 2 * Math.PI;
assert(approxEqual(r5.result!.value, expected5, 0.5), `Linear torque curve energy ≈ ${expected5.toFixed(1)} J (got ${r5.result!.value})`);

console.log('energy.test.ts: all assertions passed');

export {};
