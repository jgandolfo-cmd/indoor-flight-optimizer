import { mockData } from '../domain/mockData';
import type { AppData } from '../domain/types';

const STORAGE_KEY = 'indoor-flight-optimizer:data:v1';

export function loadAppData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return mockData;

  try {
    const parsed = JSON.parse(raw) as AppData;
    return {
      venues: parsed.venues ?? [],
      models: parsed.models ?? [],
      propellers: parsed.propellers ?? [],
      rubberBatches: parsed.rubberBatches ?? [],
      motors: parsed.motors ?? [],
      flights: parsed.flights ?? [],
      sessions: parsed.sessions ?? [],
      flightConfigurations: parsed.flightConfigurations ?? [],
      configurationChanges: parsed.configurationChanges ?? [],
      optimalConfigurations: parsed.optimalConfigurations ?? [],
      activeSessionId: parsed.activeSessionId,
    };
  } catch {
    return mockData;
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetAppData(): AppData {
  saveAppData(mockData);
  return mockData;
}
