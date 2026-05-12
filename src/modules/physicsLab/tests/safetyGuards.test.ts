import { guardVpSpring, guardVpNotAllowedInCategory, guardMultipleVariables, applyGuards } from '../core/safetyGuards';
import type { PhysicsLabRecommendation } from '../core/types';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

// guardVpSpring: unknown mechanism → blocked
const g1 = guardVpSpring({ propType: 'variable_pitch', vpMechanismMode: 'unknown' });
assert(g1.blocked === true, 'VP spring blocked when mechanism unknown');

// guardVpSpring: known mechanism → not blocked
const g2 = guardVpSpring({ propType: 'variable_pitch', vpMechanismMode: 'torque_opens_to_high_pitch' });
assert(g2.blocked === false, 'VP spring not blocked when mechanism known');

// guardVpSpring: no mechanism specified → blocked
const g3 = guardVpSpring({});
assert(g3.blocked === true, 'VP spring blocked when vpMechanismMode not specified');

// guardVpNotAllowedInCategory: F1L + VP → blocked
const g4 = guardVpNotAllowedInCategory('F1L', 'variable_pitch');
assert(g4.blocked === true, 'VP blocked in F1L');

// guardVpNotAllowedInCategory: EZB + VP → blocked
const g5 = guardVpNotAllowedInCategory('EZB', 'variable_pitch');
assert(g5.blocked === true, 'VP blocked in EZB');

// guardVpNotAllowedInCategory: P25 + VP → blocked
const g6 = guardVpNotAllowedInCategory('P25', 'variable_pitch');
assert(g6.blocked === true, 'VP blocked in P25');

// guardVpNotAllowedInCategory: F1M + VP → allowed
const g7 = guardVpNotAllowedInCategory('F1M', 'variable_pitch');
assert(g7.blocked === false, 'VP allowed in F1M');

// guardVpNotAllowedInCategory: undefined category → allowed
const g8 = guardVpNotAllowedInCategory(undefined, 'variable_pitch');
assert(g8.blocked === false, 'VP allowed when category undefined');

// guardVpNotAllowedInCategory: fixed propeller → always allowed regardless of category
const g9 = guardVpNotAllowedInCategory('F1L', 'fixed');
assert(g9.blocked === false, 'Fixed propeller allowed in F1L');

// guardMultipleVariables
const g10 = guardMultipleVariables(['backoff', 'min_pitch']);
assert(g10.blocked === true, 'Multiple variables → blocked');

const g11 = guardMultipleVariables(['backoff']);
assert(g11.blocked === false, 'Single variable → not blocked');

// applyGuards: VP in F1L should block min_pitch recommendation
const baseRec: PhysicsLabRecommendation = {
  title: 'Test',
  recommendation: 'test',
  targetVariable: 'min_pitch',
  direction: 'decrease',
  rationale: [],
  evidenceUsed: [],
  assumptionsUsed: [],
  missingData: [],
  doNotTouch: [],
  confidence: 'medium',
  riskLevel: 'low',
};
const blocked = applyGuards(baseRec, { category: 'F1L', propeller: { propType: 'variable_pitch' } });
assert(blocked.blocked === true, 'min_pitch rec in F1L with VP → blocked');
assert(typeof blocked.blockReason === 'string' && blocked.blockReason.length > 0, 'blockReason set');

console.log('safetyGuards.test.ts: all assertions passed');

export {};
