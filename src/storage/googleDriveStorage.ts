import { mockData } from '../domain/mockData';
import type { AppData } from '../domain/types';

const CLIENT_ID = '405210962088-n6lptcol9ibfkc99chevg4idjof5jf4b.apps.googleusercontent.com';
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
const DATA_FILENAME = 'indoor-flight-optimizer-data.json';

type TokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type TokenResponse = {
  access_token?: string;
  error?: string;
};

export type GoogleUserProfile = {
  email: string;
  name?: string;
  picture?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

let gisPromise: Promise<void> | undefined;

export function normalizeAppData(parsed: Partial<AppData>): AppData {
  return {
    venues: parsed.venues ?? mockData.venues,
    models: parsed.models ?? mockData.models,
    propellers: parsed.propellers ?? mockData.propellers,
    rubberBatches: parsed.rubberBatches ?? mockData.rubberBatches,
    motors: parsed.motors ?? mockData.motors,
    flights: parsed.flights ?? [],
    sessions: parsed.sessions ?? [],
    flightConfigurations: parsed.flightConfigurations ?? [],
    configurationChanges: parsed.configurationChanges ?? [],
    optimalConfigurations: parsed.optimalConfigurations ?? [],
    activeSessionId: parsed.activeSessionId,
  };
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;

  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity Services.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'));
    document.head.appendChild(script);
  });

  return gisPromise;
}

export async function requestDriveAccessToken(prompt = ''): Promise<string> {
  await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    const tokenClient = window.google?.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? 'Google no devolvio token de acceso.'));
          return;
        }
        resolve(response.access_token);
      },
    });

    if (!tokenClient) {
      reject(new Error('Google Identity Services no esta disponible.'));
      return;
    }

    tokenClient.requestAccessToken({ prompt });
  });
}

export async function loadGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo validar usuario Google (${response.status}).`);
  }

  const profile = await response.json() as GoogleUserProfile;
  if (!profile.email) {
    throw new Error('Google no devolvio email del usuario.');
  }
  return profile;
}

async function driveFetch<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Drive respondio ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export async function findDriveDataFile(accessToken: string): Promise<string | undefined> {
  const query = encodeURIComponent(`name='${DATA_FILENAME}' and 'appDataFolder' in parents and trashed=false`);
  const result = await driveFetch<{ files: Array<{ id: string; name: string }> }>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name)`,
  );
  return result.files[0]?.id;
}

export async function loadDataFromDrive(accessToken: string): Promise<AppData | undefined> {
  const fileId = await findDriveDataFile(accessToken);
  if (!fileId) return undefined;

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo leer datos de Drive (${response.status}).`);
  }

  return normalizeAppData(await response.json());
}

export async function saveDataToDrive(accessToken: string, data: AppData): Promise<void> {
  const fileId = await findDriveDataFile(accessToken);
  const metadata = {
    name: DATA_FILENAME,
    mimeType: 'application/json',
    parents: fileId ? undefined : ['appDataFolder'],
  };
  const boundary = `ifo-${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(data, null, 2),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const method = fileId ? 'PATCH' : 'POST';
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`No se pudo guardar en Drive (${response.status}).`);
  }
}
