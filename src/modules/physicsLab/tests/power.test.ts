import {
  calculateInitialPower,
  calculateRequiredPowerApprox,
  calculateAveragePowerEstimate,
} from '../core/power';
import { calculateVerticalSpeed } from '../core/flightMetrics';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

function approxEqual(a: number, b: number, tol = 0.005): boolean {
  return Math.abs(a - b) <= tol;
}

// Test 1: torque = 1.85 mN·m, rpm = 1850 → P ≈ 0.358 W (358 mW)
const r1 = calculateInitialPower(
  { launchTorque: 1.85, launchTorqueUnit: 'mNm' },
  { rpmInitial: 1850 },
);
assert(r1.result !== undefined, 'Test1: result defined');
assert(approxEqual(r1.result!.value, 0.3584, 0.005), `Test1: P ≈ 0.358 W (got ${r1.result!.value})`);
assert(r1.warnings.length === 0, 'Test1: no warnings for realistic F1M power');

// Test 2: torque = 1850 mN·m, rpm = 1850 → P ≈ 358.4 W → warning
const r2 = calculateInitialPower(
  { launchTorque: 1850, launchTorqueUnit: 'mNm' },
  { rpmInitial: 1850 },
);
assert(r2.result !== undefined, 'Test2: result defined');
assert(approxEqual(r2.result!.value, 358.4, 1.0), `Test2: P ≈ 358.4 W (got ${r2.result!.value})`);
assert(r2.warnings.length > 0, 'Test2: warning for physically suspicious power');

// Test 3: torqueUnit = unknown → no result, warning emitted
const r3 = calculateInitialPower(
  { launchTorque: 62, launchTorqueUnit: 'unknown' },
  { rpmInitial: 1850 },
);
// unknown unit is handled by caller (analyzePhysicsLab) → power calc returns no result
// The caller passes torqueUnitBlocked override; direct call with unknown still reaches the guard
assert(r3.result === undefined, 'Test3: torqueUnit unknown → no result');

// Test 4: missing torque → missing flagged
const r4 = calculateInitialPower({}, { rpmInitial: 1850 });
assert(r4.result === undefined, 'Test4: missing torque → no result');
assert(r4.missing.some((m) => m.includes('torque')), 'Test4: torque in missing list');

// Test 5: missing RPM → missing flagged
const r5 = calculateInitialPower({ launchTorque: 62, launchTorqueUnit: 'mNm' }, {});
assert(r5.result === undefined, 'Test5: missing RPM → no result');

// calculateRequiredPowerApprox: 7.5g model, 7.8m/45s = 0.173 m/s
// P = 0.0075 × 9.80665 × 0.173 ≈ 0.01275 W ≈ 12.75 mW
const vsCalc = calculateVerticalSpeed({ maxAltitudeM: 7.8, timeToMaxAltitudeSec: 45 });
const r6 = calculateRequiredPowerApprox({ weightG: 7.5 }, vsCalc);
assert(r6.result !== undefined, 'requiredPower: result defined');
assert(approxEqual(r6.result!.value, 0.01275, 0.001), `requiredPower ≈ 12.75 mW (got ${(r6.result!.value * 1000).toFixed(2)} mW)`);

// calculateAveragePowerEstimate = 50% of initial
const avg = calculateAveragePowerEstimate(r1);
assert(avg.result !== undefined, 'averagePower: result defined');
assert(approxEqual(avg.result!.value, r1.result!.value * 0.5, 0.001), 'averagePower = 0.5 × initialPower');
assert(avg.result!.provenance === 'estimated', 'averagePower provenance = estimated');

console.log('power.test.ts: all assertions passed');

export {};
