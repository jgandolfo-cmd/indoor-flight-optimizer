import type { PhysicsLabInput } from '../core/types';
import type { CaseMetadata } from './importNormalizer';

const STORAGE_KEY = 'indoorFlightOptimizer.physicsLab.v1';
const HISTORY_KEY = 'indoorFlightOptimizer.physicsLab.history.v1';
const HISTORY_MAX = 5;

export type HistoryEntry = {
  savedAt: string;
  input: PhysicsLabInput;
  metadata?: CaseMetadata;
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

export function saveToHistory(input: PhysicsLabInput, metadata?: CaseMetadata): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: HistoryEntry[] = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    history.unshift({ savedAt: new Date().toISOString(), input, metadata });
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
