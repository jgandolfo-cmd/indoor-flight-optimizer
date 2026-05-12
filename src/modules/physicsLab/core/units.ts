export const gramsToKilograms = (g: number): number => g / 1000;
export const millimetersToMeters = (mm: number): number => mm / 1000;
export const rpmToRadPerSecond = (rpm: number): number => (rpm * 2 * Math.PI) / 60;
export const turnsToRadians = (turns: number): number => turns * 2 * Math.PI;
export const mNmToNm = (mNm: number): number => mNm / 1000;
export const gCmToNm = (gCm: number): number => gCm * 9.80665e-5;
export const ozInToNm = (ozIn: number): number => ozIn * 0.00706155;

export function convertTorqueToNm(
  value: number,
  unit: 'Nmm' | 'mNm' | 'gcm' | 'ozin',
): number {
  switch (unit) {
    case 'Nmm': return value / 1000;
    case 'mNm': return mNmToNm(value);
    case 'gcm': return gCmToNm(value);
    case 'ozin': return ozInToNm(value);
  }
}
