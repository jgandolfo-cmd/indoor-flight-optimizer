export const gramsToKilograms = (g: number): number => g / 1000;
export const millimetersToMeters = (mm: number): number => mm / 1000;
export const rpmToRadPerSecond = (rpm: number): number => (rpm * 2 * Math.PI) / 60;
export const turnsToRadians = (turns: number): number => turns * 2 * Math.PI;
export const mNmToNm = (mNm: number): number => mNm / 1000;
export const gCmToNm = (gCm: number): number => gCm * 9.80665e-5;
export const ozInToNm = (ozIn: number): number => ozIn * 0.007061552;
export const lbInToNm = (lbIn: number): number => lbIn * 0.112984829;

export type TorqueUnit = 'Nmm' | 'mNm' | 'gcm' | 'ozin' | 'lbIn' | 'inLb' | 'lbfIn';

export function convertTorqueToNm(value: number, unit: TorqueUnit): number {
  switch (unit) {
    case 'Nmm':  return value / 1000;
    case 'mNm':  return mNmToNm(value);
    case 'gcm':  return gCmToNm(value);
    case 'ozin': return ozInToNm(value);
    case 'lbIn':
    case 'inLb':
    case 'lbfIn': return lbInToNm(value);
  }
}
