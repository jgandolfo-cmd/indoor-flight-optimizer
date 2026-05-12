import { rpmToRadPerSecond, mNmToNm, ozInToNm, lbInToNm, convertTorqueToNm } from '../core/units';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

function approxEqual(a: number, b: number, tol = 0.001): boolean {
  return Math.abs(a - b) <= tol;
}

// ── rpmToRadPerSecond ──────────────────────────────────────────────────────────
assert(approxEqual(rpmToRadPerSecond(60), 2 * Math.PI, 0.0001), 'rpmToRadPerSecond(60) = 2π rad/s');
assert(approxEqual(rpmToRadPerSecond(0), 0), 'rpmToRadPerSecond(0) = 0');
assert(approxEqual(rpmToRadPerSecond(1850), 193.73, 0.1), 'rpmToRadPerSecond(1850) ≈ 193.73 rad/s');

// ── mNmToNm ────────────────────────────────────────────────────────────────────
assert(approxEqual(mNmToNm(1000), 1.0), 'mNmToNm(1000) = 1.0 N·m');
assert(approxEqual(mNmToNm(1.85), 0.00185, 0.000001), 'mNmToNm(1.85) = 0.00185 N·m');

// ── lbInToNm ───────────────────────────────────────────────────────────────────
assert(
  approxEqual(lbInToNm(1), 0.112984829, 0.000001),
  `lbInToNm(1) = 0.112984829 N·m (got ${lbInToNm(1)})`,
);

// ── ozInToNm ───────────────────────────────────────────────────────────────────
assert(
  approxEqual(ozInToNm(1), 0.007061552, 0.000001),
  `ozInToNm(1) = 0.007061552 N·m (got ${ozInToNm(1)})`,
);

// ── lbIn / ozin ratio ─────────────────────────────────────────────────────────
// 1 lb = 16 oz → lbInToNm(1) / ozInToNm(1) ≈ 16
const ratio = lbInToNm(1) / ozInToNm(1);
assert(
  approxEqual(ratio, 16, 0.01),
  `lbIn/ozin ratio ≈ 16 (got ${ratio.toFixed(4)})`,
);

// ── convertTorqueToNm — lb·in variants ────────────────────────────────────────
assert(
  approxEqual(convertTorqueToNm(1, 'lbIn'), 0.112984829, 0.000001),
  `convertTorqueToNm(1, 'lbIn') = 0.112984829 N·m`,
);
assert(
  approxEqual(convertTorqueToNm(1, 'inLb'), 0.112984829, 0.000001),
  `convertTorqueToNm(1, 'inLb') = 0.112984829 N·m`,
);
assert(
  approxEqual(convertTorqueToNm(1, 'lbfIn'), 0.112984829, 0.000001),
  `convertTorqueToNm(1, 'lbfIn') = 0.112984829 N·m`,
);

// All three aliases must be identical
assert(
  convertTorqueToNm(3.5, 'lbIn') === convertTorqueToNm(3.5, 'inLb'),
  'lbIn and inLb are identical',
);
assert(
  convertTorqueToNm(3.5, 'lbIn') === convertTorqueToNm(3.5, 'lbfIn'),
  'lbIn and lbfIn are identical',
);

// ── convertTorqueToNm — ozin ──────────────────────────────────────────────────
assert(
  approxEqual(convertTorqueToNm(1, 'ozin'), 0.007061552, 0.000001),
  `convertTorqueToNm(1, 'ozin') = 0.007061552 N·m`,
);

// ── convertTorqueToNm — mNm ───────────────────────────────────────────────────
assert(
  approxEqual(convertTorqueToNm(1.85, 'mNm'), 0.00185, 0.000001),
  'convertTorqueToNm(1.85, mNm) = 0.00185 N·m',
);

// ── Power formula — P[W] = torque[N·m] × rpmToRadPerSecond(rpm) ───────────────
// Test A: 1.85 mN·m, 1850 RPM → P ≈ 0.358 W
const pA = convertTorqueToNm(1.85, 'mNm') * rpmToRadPerSecond(1850);
assert(approxEqual(pA, 0.3584, 0.005), `P(1.85 mNm, 1850 rpm) ≈ 0.358 W (got ${pA.toFixed(4)} W)`);

// Test B: 0.01 lb·in, 1850 RPM → torqueNm ≈ 0.001129848 → P ≈ 0.2189 W
// torqueNm = 0.01 × 0.112984829 = 0.00112984829
// omega    = 1850 × 2π / 60     = 193.7316... rad/s
// power    = 0.00112984829 × 193.7316 = 0.21888... W ≈ 218.9 mW
const torqueB = convertTorqueToNm(0.01, 'lbIn');
const omegaB = rpmToRadPerSecond(1850);
const pB = torqueB * omegaB;
assert(
  approxEqual(torqueB, 0.001129848, 0.000001),
  `torqueNm(0.01 lb·in) = 0.001129848 N·m (got ${torqueB.toFixed(9)})`,
);
assert(
  approxEqual(pB, 0.2189, 0.002),
  `P(0.01 lb·in, 1850 rpm) ≈ 0.2189 W (got ${pB.toFixed(4)} W)`,
);

console.log('units.test.ts: all assertions passed');

export {};
