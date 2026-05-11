import type { Flight, FlightMetrics, IndoorModel, RubberMotor, Venue } from './types';

export const F1M_LIMITS = {
  maxWingspanMm: 460,
  minModelWeightG: 3,
  maxMotorWeightG: 1.5,
};

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function calculateFlightMetrics(
  flight: Flight,
  venue?: Venue,
  motor?: RubberMotor,
): FlightMetrics {
  const netTurns = Math.max(0, flight.turnsLoaded - flight.backOff);
  const remainingPercent = netTurns > 0 ? (flight.remainingTurns / netTurns) * 100 : 0;
  const ceilingUsePercent = venue?.ceilingHeightM
    ? (flight.maxAltitudeM / venue.ceilingHeightM) * 100
    : 0;
  const totalCeilingContactSec =
    (flight.ceilingContactDurationSec ?? 0) + (flight.secondCeilingContactDurationSec ?? 0);
  const timeToCeilingPercent =
    flight.durationSec > 0 && flight.timeToCeilingSec !== undefined
      ? (flight.timeToCeilingSec / flight.durationSec) * 100
      : 0;
  const ceilingContactPercent =
    flight.durationSec > 0 ? (totalCeilingContactSec / flight.durationSec) * 100 : 0;
  const efficiencyPerTurn = netTurns > 0 ? flight.durationSec / netTurns : 0;
  const efficiencyPerRubberGram = motor?.weightG ? flight.durationSec / motor.weightG : 0;

  return {
    netTurns,
    remainingPercent: round(remainingPercent, 1),
    ceilingUsePercent: round(ceilingUsePercent, 1),
    timeToCeilingPercent: round(timeToCeilingPercent, 1),
    ceilingContactPercent: round(ceilingContactPercent, 1),
    totalCeilingContactSec: round(totalCeilingContactSec, 1),
    efficiencyPerTurn: round(efficiencyPerTurn, 3),
    efficiencyPerRubberGram: round(efficiencyPerRubberGram, 1),
  };
}

export function validateModelF1M(model: IndoorModel): string[] {
  const issues: string[] = [];
  if (model.wingspanMm > F1M_LIMITS.maxWingspanMm) {
    issues.push(`Envergadura excedida: ${model.wingspanMm} mm > ${F1M_LIMITS.maxWingspanMm} mm.`);
  }
  if (model.weightG < F1M_LIMITS.minModelWeightG) {
    issues.push(`Peso del modelo por debajo del minimo: ${model.weightG} g < ${F1M_LIMITS.minModelWeightG} g.`);
  }
  return issues;
}

export function calculateModelGeometry(model: IndoorModel): {
  wingIncidenceProxyMm: number;
  stabilizerIncidenceProxyMm: number;
  decalageProxyMm: number;
  dragRisk: 'low' | 'medium' | 'high' | 'unknown';
  evidence: string[];
} {
  const wingKnown = model.wingLeadingEdgeHeightMm !== undefined && model.wingTrailingEdgeHeightMm !== undefined;
  const stabKnown = model.stabilizerLeadingEdgeHeightMm !== undefined && model.stabilizerTrailingEdgeHeightMm !== undefined;
  const wingIncidenceProxyMm = wingKnown ? model.wingLeadingEdgeHeightMm! - model.wingTrailingEdgeHeightMm! : 0;
  const stabilizerIncidenceProxyMm = stabKnown ? model.stabilizerLeadingEdgeHeightMm! - model.stabilizerTrailingEdgeHeightMm! : 0;
  const decalageProxyMm = wingIncidenceProxyMm - stabilizerIncidenceProxyMm;
  const evidence: string[] = [];

  if (!wingKnown || !stabKnown) {
    return {
      wingIncidenceProxyMm,
      stabilizerIncidenceProxyMm,
      decalageProxyMm,
      dragRisk: 'unknown',
      evidence: ['faltan alturas de ala o estabilizador'],
    };
  }

  evidence.push(`ala BA-BF ${wingIncidenceProxyMm} mm`);
  evidence.push(`estabilizador BA-BF ${stabilizerIncidenceProxyMm} mm`);
  evidence.push(`decalage proxy ${decalageProxyMm} mm`);
  if (model.cgFromWingLeadingEdgeMm !== undefined) evidence.push(`CG ${model.cgFromWingLeadingEdgeMm} mm desde BA`);

  const absDecalage = Math.abs(decalageProxyMm);
  const dragRisk = absDecalage > 8 ? 'high' : absDecalage > 4 ? 'medium' : 'low';

  return {
    wingIncidenceProxyMm,
    stabilizerIncidenceProxyMm,
    decalageProxyMm,
    dragRisk,
    evidence,
  };
}

export function validateMotorF1M(motor: RubberMotor): string[] {
  if (motor.weightG > F1M_LIMITS.maxMotorWeightG) {
    return [`Peso del motor excedido: ${motor.weightG} g > ${F1M_LIMITS.maxMotorWeightG} g.`];
  }
  return [];
}

export function validateFlightInputs(flight: Flight): string[] {
  const issues: string[] = [];
  if (flight.backOff > flight.turnsLoaded) issues.push('El back-off no puede superar las vueltas cargadas.');
  if (flight.durationSec <= 0) issues.push('La duracion debe ser mayor que cero.');
  if (flight.maxAltitudeM < 0) issues.push('La altura maxima no puede ser negativa.');
  if (flight.remainingTurns < 0) issues.push('Las vueltas remanentes no pueden ser negativas.');
  if ((flight.timeToCeilingSec ?? 0) < 0) issues.push('El tiempo hasta techo no puede ser negativo.');
  if ((flight.ceilingContactDurationSec ?? 0) < 0) issues.push('El tiempo de contacto con techo no puede ser negativo.');
  if ((flight.secondCeilingTimeSec ?? 0) < 0) issues.push('El tiempo del segundo toque de techo no puede ser negativo.');
  if ((flight.secondCeilingContactDurationSec ?? 0) < 0) issues.push('El segundo contacto con techo no puede ser negativo.');
  if (flight.timeToCeilingSec !== undefined && flight.timeToCeilingSec > flight.durationSec) {
    issues.push('El tiempo hasta techo no puede superar la duracion del vuelo.');
  }
  if (flight.secondCeilingTimeSec !== undefined && flight.secondCeilingTimeSec > flight.durationSec) {
    issues.push('El segundo toque de techo no puede superar la duracion del vuelo.');
  }
  if ((flight.turnsAtDescentStart ?? 0) < 0) issues.push('Las vueltas al inicio de caida no pueden ser negativas.');
  if ((flight.launchTorque ?? 0) < 0 || (flight.descentStartTorque ?? 0) < 0) {
    issues.push('Los valores de torque no pueden ser negativos.');
  }
  return issues;
}
