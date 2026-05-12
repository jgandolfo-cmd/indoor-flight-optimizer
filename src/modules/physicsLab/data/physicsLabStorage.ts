import type { PhysicsLabInput } from '../core/types';

const STORAGE_KEY = 'indoorFlightOptimizer.physicsLab.v1';

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
