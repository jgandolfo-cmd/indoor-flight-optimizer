import { calculateLinearDensity } from '../core/rubber';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

function approxEqual(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol;
}

// Missing mass
const r1 = calculateLinearDensity({ loopLengthMm: 430, strandCount: 1 });
assert(r1.result === undefined, 'Missing rubberMassG → no result');
assert(r1.missing.some((m) => m.includes('masa')), 'Missing mass flagged');

// Missing loop length
const r2 = calculateLinearDensity({ rubberMassG: 1.2 });
assert(r2.result === undefined, 'Missing loopLengthMm → no result');

// Valid calculation: 1.2g / (430mm × 1 strand) = 1.2 / 0.430 g/m ≈ 2.790 g/m
const r3 = calculateLinearDensity({ rubberMassG: 1.2, loopLengthMm: 430, strandCount: 1 });
assert(r3.result !== undefined, 'Valid input → result defined');
assert(approxEqual(r3.result!.value, 2.79, 0.05), `linearDensity(1.2g, 430mm, 1) ≈ 2.79 g/m (got ${r3.result!.value})`);
assert(r3.result!.unit === 'g/m', 'unit = g/m');
assert(r3.result!.confidence === 'high', 'confidence = high when strandCount provided');

// 2 strands: 1.2g / (430mm × 2) = 1.2 / 0.860 ≈ 1.395 g/m
const r4 = calculateLinearDensity({ rubberMassG: 1.2, loopLengthMm: 430, strandCount: 2 });
assert(r4.result !== undefined, '2 strands → result defined');
assert(approxEqual(r4.result!.value, 1.395, 0.05), `2 strands ≈ 1.395 g/m (got ${r4.result!.value})`);

// No strandCount → confidence medium + assumption added
const r5 = calculateLinearDensity({ rubberMassG: 1.2, loopLengthMm: 430 });
assert(r5.result?.confidence === 'medium', 'No strandCount → confidence medium');
assert(r5.assumptions.length > 0, 'No strandCount → assumption added');

console.log('rubber.test.ts: all assertions passed');

export {};
