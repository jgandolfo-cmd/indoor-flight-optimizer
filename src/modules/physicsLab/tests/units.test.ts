import { rpmToRadPerSecond, mNmToNm, convertTorqueToNm } from '../core/units';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

function approxEqual(a: number, b: number, tol = 0.001): boolean {
  return Math.abs(a - b) <= tol;
}

// rpmToRadPerSecond
assert(approxEqual(rpmToRadPerSecond(60), 2 * Math.PI, 0.0001), 'rpmToRadPerSecond(60) = 2π rad/s');
assert(approxEqual(rpmToRadPerSecond(0), 0), 'rpmToRadPerSecond(0) = 0');
assert(approxEqual(rpmToRadPerSecond(1850), 193.73, 0.1), 'rpmToRadPerSecond(1850) ≈ 193.73 rad/s');

// mNmToNm
assert(approxEqual(mNmToNm(1000), 1.0), 'mNmToNm(1000) = 1.0 N·m');
assert(approxEqual(mNmToNm(1.85), 0.00185, 0.000001), 'mNmToNm(1.85) = 0.00185 N·m');

// convertTorqueToNm — mNm
assert(
  approxEqual(convertTorqueToNm(1.85, 'mNm'), 0.00185, 0.000001),
  'convertTorqueToNm(1.85, mNm) = 0.00185 N·m',
);

// Power formula: P[W] = torque[N·m] × rpmToRadPerSecond(rpm)
// Test case 1: torque = 1.85 mN·m, rpm = 1850 → P ≈ 0.358 W = 358 mW
const torqueNm1 = convertTorqueToNm(1.85, 'mNm');
const omega1 = rpmToRadPerSecond(1850);
const power1W = torqueNm1 * omega1;
assert(approxEqual(power1W, 0.358, 0.005), `P(1.85 mNm, 1850 rpm) ≈ 0.358 W (got ${power1W.toFixed(4)} W)`);

// Test case 2: torque = 1850 mN·m, rpm = 1850 → P ≈ 358.6 W (suspicious for F1M)
const torqueNm2 = convertTorqueToNm(1850, 'mNm');
const omega2 = rpmToRadPerSecond(1850);
const power2W = torqueNm2 * omega2;
assert(approxEqual(power2W, 358.6, 1.0), `P(1850 mNm, 1850 rpm) ≈ 358.6 W (got ${power2W.toFixed(2)} W)`);

console.log('units.test.ts: all assertions passed');

export {};
