import type { AircraftCategory, PhysicsLabInput } from '../core/types';

export type CaseMetadata = {
  id?: string;
  label?: string;
  sourceType?: string;
  expected?: unknown;
};

export type NormalizeSuccess = {
  ok: true;
  input: PhysicsLabInput;
  metadata?: CaseMetadata;
};

export type NormalizeMulti = {
  ok: 'multi';
  cases: Array<{ input: PhysicsLabInput; metadata: CaseMetadata }>;
};

export type NormalizeError = {
  ok: false;
  error: string;
};

export type NormalizeResult = NormalizeSuccess | NormalizeMulti | NormalizeError;

// ── validators ────────────────────────────────────────────────────────────────

const VALID_CATEGORIES: AircraftCategory[] = ['F1M', 'F1L', 'EZB', 'P25'];
const VALID_TORQUE_UNITS = ['Nmm', 'mNm', 'gcm', 'ozin', 'lbIn', 'inLb', 'lbfIn', 'unknown'] as const;

function sanitizeCategory(raw: unknown): AircraftCategory {
  if (typeof raw === 'string' && (VALID_CATEGORIES as string[]).includes(raw)) {
    return raw as AircraftCategory;
  }
  return 'F1M';
}

type TorqueUnitValue = 'Nmm' | 'mNm' | 'gcm' | 'ozin' | 'lbIn' | 'inLb' | 'lbfIn' | 'unknown';

function sanitizeTorqueUnit(raw: unknown): TorqueUnitValue {
  if (typeof raw === 'string' && (VALID_TORQUE_UNITS as readonly string[]).includes(raw)) {
    return raw as TorqueUnitValue;
  }
  return 'unknown';
}

function sanitizeNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function sanitizeString(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}

function sanitizeMotor(raw: unknown): PhysicsLabInput['motor'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  return {
    id: sanitizeString(m['id']),
    name: sanitizeString(m['name']),
    rubberMassG: sanitizeNumber(m['rubberMassG']),
    linearDensityGPerM: sanitizeNumber(m['linearDensityGPerM']),
    loopLengthMm: sanitizeNumber(m['loopLengthMm']),
    strandCount: sanitizeNumber(m['strandCount']),
    turnsLoaded: sanitizeNumber(m['turnsLoaded']),
    backoffTurns: sanitizeNumber(m['backoffTurns']),
    remainingTurns: sanitizeNumber(m['remainingTurns']),
    launchTorque: sanitizeNumber(m['launchTorque']),
    launchTorqueUnit: sanitizeTorqueUnit(m['launchTorqueUnit']),
  };
}

function sanitizeModel(raw: unknown): PhysicsLabInput['model'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  return {
    id: sanitizeString(m['id']),
    name: sanitizeString(m['name']),
    weightG: sanitizeNumber(m['weightG']),
    wingspanMm: sanitizeNumber(m['wingspanMm']),
    wingAreaDm2: sanitizeNumber(m['wingAreaDm2']),
  };
}

function sanitizePropeller(raw: unknown): PhysicsLabInput['propeller'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  const propType = p['propType'] === 'variable_pitch' ? 'variable_pitch'
    : p['propType'] === 'fixed' ? 'fixed'
    : undefined;
  type VpMode = 'torque_opens_to_high_pitch' | 'torque_closes_to_low_pitch' | 'unknown';
  const vpMode = p['vpMechanismMode'];
  const validVpMode: VpMode | undefined = vpMode === 'torque_opens_to_high_pitch' || vpMode === 'torque_closes_to_low_pitch' || vpMode === 'unknown'
    ? (vpMode as VpMode)
    : undefined;
  return {
    id: sanitizeString(p['id']),
    name: sanitizeString(p['name']),
    diameterMm: sanitizeNumber(p['diameterMm']),
    propType,
    minPitchMm: sanitizeNumber(p['minPitchMm']),
    maxPitchMm: sanitizeNumber(p['maxPitchMm']),
    minPitchDeg: sanitizeNumber(p['minPitchDeg']),
    maxPitchDeg: sanitizeNumber(p['maxPitchDeg']),
    springHardness: sanitizeNumber(p['springHardness']),
    vpMechanismMode: validVpMode,
  };
}

function sanitizeFlight(raw: unknown): PhysicsLabInput['flight'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  type TouchedCeiling = 'no' | 'light' | 'hard' | boolean | string;
  type DescentType = 'smooth' | 'abrupt' | 'stall' | 'unknown';
  const tc = f['touchedCeiling'];
  const touchedCeiling: TouchedCeiling | undefined = (tc === 'no' || tc === 'light' || tc === 'hard' || typeof tc === 'boolean')
    ? tc
    : sanitizeString(tc);
  const rawDescent = sanitizeString(f['descentType']);
  const descentType: DescentType | undefined = (rawDescent === 'smooth' || rawDescent === 'abrupt' || rawDescent === 'stall' || rawDescent === 'unknown')
    ? rawDescent
    : undefined;
  return {
    durationSec: sanitizeNumber(f['durationSec']),
    maxAltitudeM: sanitizeNumber(f['maxAltitudeM']),
    timeToMaxAltitudeSec: sanitizeNumber(f['timeToMaxAltitudeSec']),
    touchedCeiling,
    rpmInitial: sanitizeNumber(f['rpmInitial']),
    rpmMid: sanitizeNumber(f['rpmMid']),
    rpmFinal: sanitizeNumber(f['rpmFinal']),
    descentType,
    stability: sanitizeString(f['stability']),
    notes: sanitizeString(f['notes']),
  };
}

function sanitizeSourceType(raw: unknown): PhysicsLabInput['sourceType'] {
  const valid = ['measured', 'published_partial', 'synthetic', 'hybrid'];
  if (typeof raw === 'string' && valid.includes(raw)) {
    return raw as PhysicsLabInput['sourceType'];
  }
  return undefined;
}

function buildInput(raw: Record<string, unknown>): PhysicsLabInput {
  return {
    category: sanitizeCategory(raw['category']),
    model: sanitizeModel(raw['model']),
    motor: sanitizeMotor(raw['motor']),
    propeller: sanitizePropeller(raw['propeller']),
    flight: sanitizeFlight(raw['flight']),
    sourceType: sanitizeSourceType(raw['sourceType']),
  };
}

function extractMetadata(raw: Record<string, unknown>): CaseMetadata {
  return {
    id: sanitizeString(raw['id']),
    label: sanitizeString(raw['label']),
    sourceType: sanitizeString(raw['sourceType']),
    expected: raw['expected'],
  };
}

// ── format detection ──────────────────────────────────────────────────────────

function isDirectInput(json: Record<string, unknown>): boolean {
  return !('input' in json)
    && !('cases' in json)
    && ('category' in json || 'motor' in json || 'model' in json || 'flight' in json || 'propeller' in json);
}

function isWrapped(json: Record<string, unknown>): boolean {
  return 'input' in json && json['input'] !== null && typeof json['input'] === 'object';
}

function isMulti(json: Record<string, unknown>): boolean {
  return 'cases' in json && Array.isArray(json['cases']);
}

// ── public API ────────────────────────────────────────────────────────────────

export function normalizePhysicsLabImport(json: unknown): NormalizeResult {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, error: 'Formato JSON no reconocido para Physics Lab.' };
  }

  const obj = json as Record<string, unknown>;

  // Format 3: { cases: [...] }
  if (isMulti(obj)) {
    const rawCases = obj['cases'] as unknown[];
    const cases: NormalizeMulti['cases'] = [];
    for (const c of rawCases) {
      if (!c || typeof c !== 'object') continue;
      const cObj = c as Record<string, unknown>;
      const inputRaw = 'input' in cObj && typeof cObj['input'] === 'object' ? cObj['input'] : cObj;
      if (!inputRaw) continue;
      cases.push({
        input: buildInput(inputRaw as Record<string, unknown>),
        metadata: extractMetadata(cObj),
      });
    }
    if (cases.length === 0) {
      return { ok: false, error: 'El archivo contiene un array "cases" pero ninguno es válido.' };
    }
    return { ok: 'multi', cases };
  }

  // Format 2: { input: PhysicsLabInput, ... }
  if (isWrapped(obj)) {
    const inputRaw = obj['input'] as Record<string, unknown>;
    return {
      ok: true,
      input: buildInput(inputRaw),
      metadata: extractMetadata(obj),
    };
  }

  // Format 1: direct PhysicsLabInput
  if (isDirectInput(obj)) {
    return {
      ok: true,
      input: buildInput(obj),
      metadata: undefined,
    };
  }

  return { ok: false, error: 'Formato JSON no reconocido para Physics Lab. Se esperaba { category, motor, ... }, { input: {...}, label }, o { cases: [...] }.' };
}

export function parsePhysicsLabFile(text: string): NormalizeResult {
  try {
    const json = JSON.parse(text) as unknown;
    return normalizePhysicsLabImport(json);
  } catch {
    return { ok: false, error: 'El archivo no es JSON válido.' };
  }
}
