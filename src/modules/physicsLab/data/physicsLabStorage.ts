import type { PhysicsLabInput, PhysicsLabRecommendation, PhysicsLabResult } from '../core/types';
import type { CaseMetadata } from './importNormalizer';

const STORAGE_KEY = 'indoorFlightOptimizer.physicsLab.v1';
const HISTORY_KEY = 'indoorFlightOptimizer.physicsLab.history.v1';
const HISTORY_MAX = 10;

export type HistoryEntry = {
  id: string;
  savedAt: string;
  input: PhysicsLabInput;
  result?: PhysicsLabResult;
  recommendations?: PhysicsLabRecommendation[];
  metadata?: CaseMetadata;
  notes?: string;
};

export function loadPhysicsLabInput(): PhysicsLabInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PhysicsLabInput;
  } catch {
    return null;
  }
}

export function savePhysicsLabInput(input: PhysicsLabInput): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
}

export function clearPhysicsLabInput(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function saveToHistory(
  input: PhysicsLabInput,
  metadata?: CaseMetadata,
  result?: PhysicsLabResult,
  recommendations?: PhysicsLabRecommendation[],
): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: HistoryEntry[] = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    const entry: HistoryEntry = {
      id: `ph-${Date.now()}`,
      savedAt: new Date().toISOString(),
      input,
      result,
      recommendations,
      metadata,
    };
    history.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
  } catch {
    // non-critical
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}
