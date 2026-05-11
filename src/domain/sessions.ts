import { calculateFlightMetrics } from './calculations';
import { analyzeRpmProfile } from './rpm';
import type {
  Flight,
  ChangedVariable,
  ChangeImpact,
  ConfigurationChange,
  FlightComparison,
  FlightConfiguration,
  FlightSession,
  IndoorModel,
  OptimalConfiguration,
  CeilingPerformanceEvaluation,
  RubberMotor,
  SessionObjective,
  Venue,
} from './types';

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function scoreFlight(flight: Flight, venue?: Venue, motor?: RubberMotor): number {
  const metrics = calculateFlightMetrics(flight, venue, motor);
  const ceilingPenalty = flight.touchedCeiling || flight.secondCeilingTouch
    ? 12 + Math.max(0, metrics.ceilingContactPercent)
    : Math.abs(85 - metrics.ceilingUsePercent) * 0.12;
  const remainingPenalty = Math.abs(10 - metrics.remainingPercent) * 0.35;
  const stabilityPenalty = flight.stability === 'stable' && flight.turnPattern !== 'irregular' ? 0 : 18;
  return round(Math.max(0, flight.durationSec - ceilingPenalty - remainingPenalty - stabilityPenalty), 1);
}

export function ceilingBandForVenue(venue?: Venue): CeilingPerformanceEvaluation['ceilingBand'] {
  const height = venue?.ceilingHeightM ?? 0;
  if (!height) return 'general';
  if (height < 8) return 'menos_8m';
  if (height <= 15) return 'techo_bajo';
  if (height <= 30) return 'techo_medio';
  return 'techo_alto';
}

function defaultReferenceDuration(venue?: Venue): number {
  const band = ceilingBandForVenue(venue);
  if (band === 'menos_8m') return 18 * 60 + 48;
  if (band === 'techo_bajo') return 20 * 60 + 9;
  if (band === 'techo_medio') return 22 * 60 + 41;
  if (band === 'techo_alto') return 23 * 60;
  return 20 * 60 + 9;
}

export function evaluateAgainstCeilingRecord(params: {
  flight: Flight;
  venue?: Venue;
  motor?: RubberMotor;
  optimals?: OptimalConfiguration[];
}): CeilingPerformanceEvaluation {
  const { flight, venue, motor } = params;
  const metrics = calculateFlightMetrics(flight, venue, motor);
  const rpm = analyzeRpmProfile(flight);
  const band = ceilingBandForVenue(venue);
  const matchingOptimals = (params.optimals ?? []).filter((optimal) => {
    if (optimal.venueId && optimal.venueId === flight.venueId) return true;
    return optimal.validFor === band || optimal.validFor === 'general';
  });
  const bestOptimal = matchingOptimals.sort((a, b) => b.durationSec - a.durationSec)[0];
  const referenceDurationSec = bestOptimal?.durationSec ?? defaultReferenceDuration(venue);
  const referenceSource = bestOptimal ? 'optimal_guardado' : 'referencia_por_altura';
  const score = scoreFlight(flight, venue, motor);
  const referenceScore = referenceDurationSec * 0.9;
  const durationGapSec = referenceDurationSec - flight.durationSec;
  const durationGapPct = referenceDurationSec > 0 ? (durationGapSec / referenceDurationSec) * 100 : 0;
  const evidence = [
    `duracion ${flight.durationSec}s vs referencia ${referenceDurationSec}s`,
    `uso de techo ${metrics.ceilingUsePercent}%`,
    `remanente ${metrics.remainingPercent}%`,
    `vueltas al inicio de caida ${flight.turnsAtDescentStart ?? 'sin dato'}`,
    `RPM ${rpm.rpmTrend}`,
  ];

  const touchedCeilingEarly = (flight.touchedCeiling || flight.secondCeilingTouch)
    && flight.timeToCeilingSec !== undefined
    && flight.timeToCeilingSec < flight.durationSec * 0.3;
  const highDescentTurns = flight.turnsAtDescentStart !== undefined && metrics.netTurns > 0
    ? flight.turnsAtDescentStart / metrics.netTurns > 0.18
    : false;
  const highRemaining = metrics.remainingPercent > 15;
  const lowCeilingUse = metrics.ceilingUsePercent < 65;
  const stable = flight.stability === 'stable' && flight.turnPattern !== 'irregular';

  let recommendation = 'Repetir baseline con RPM, vueltas al inicio de caida y remanente para confirmar lectura.';
  let exactAdjustment = 'sin cambios';
  let keepConstant = ['modelo', 'salon', 'helice', 'motor', 'trimado'];
  let energyUseSummary = 'Uso de energia sin limitante dominante.';

  if (!stable) {
    energyUseSummary = 'La energia no es interpretable con confianza porque el vuelo no esta estable.';
    recommendation = 'Corregir trimado antes de cambiar motor, helice o vueltas.';
    exactAdjustment = 'no tocar energia; ajustar trimado y repetir';
    keepConstant = ['motor', 'helice', 'vueltas cargadas', 'back-off'];
  } else if (touchedCeilingEarly) {
    energyUseSummary = 'La energia llega demasiado pronto al techo.';
    recommendation = 'Ralentizar llegada al techo antes de buscar mas duracion.';
    exactAdjustment = metrics.remainingPercent > 25 ? 'aumentar back-off +80 vueltas' : 'aumentar back-off +40 a +60 vueltas';
    keepConstant = ['modelo', 'salon', 'motor', 'paso minimo VP', 'trimado'];
  } else if (highDescentTurns || highRemaining) {
    energyUseSummary = 'El vuelo cae con energia disponible; hay que mejorar consumo de vueltas en fase media/final.';
    if (rpm.rpmTrend === 'fast_decay' || flight.rpmVisual === 'slow') {
      recommendation = 'Disminuir paso minimo VP para recuperar RPM util al final; inspeccionar friccion si no mejora.';
      exactAdjustment = flight.vpPropeller.minPitchMm
        ? `minPitch ${flight.vpPropeller.minPitchMm} -> ${round(flight.vpPropeller.minPitchMm * 0.96, 0)} mm (-4%)`
        : 'medir paso minimo; objetivo -3% a -5%';
      keepConstant = ['modelo', 'salon', 'motor', 'paso maximo VP', 'trimado'];
    } else if (rpm.rpmTrend === 'stable' || flight.rpmVisual === 'fast') {
      recommendation = 'Cargar mas la helice al final para convertir RPM en empuje util.';
      exactAdjustment = flight.vpPropeller.minPitchMm
        ? `minPitch ${flight.vpPropeller.minPitchMm} -> ${round(flight.vpPropeller.minPitchMm * 1.03, 0)} mm (+3%)`
        : 'medir paso minimo; objetivo +2% a +4%';
      keepConstant = ['modelo', 'salon', 'motor', 'paso maximo VP', 'trimado'];
    } else {
      recommendation = 'Acortar motor manteniendo masa para consumir vueltas con mas densidad lineal.';
      exactAdjustment = motor
        ? `loop ${motor.loopLengthMm} -> ${round(motor.loopLengthMm * 0.96, 0)} mm (-4%), masa ${motor.weightG} g`
        : 'acortar loop 3% a 5% manteniendo masa';
      keepConstant = ['modelo', 'salon', 'helice', 'trimado'];
    }
  } else if (lowCeilingUse) {
    energyUseSummary = 'El vuelo no usa suficiente altura disponible.';
    recommendation = 'Aumentar energia util de lanzamiento sin cambiar trimado.';
    exactAdjustment = 'reducir back-off 20 a 40 vueltas o aumentar vueltas cargadas +30 a +50';
    keepConstant = ['modelo', 'salon', 'helice', 'motor', 'trimado'];
  } else if (durationGapPct > 20) {
    energyUseSummary = 'El perfil es razonable, pero todavia lejos de la referencia por altura.';
    recommendation = 'Hacer segundo vuelo con una sola mejora medible: repetir o ajustar la variable dominante del diagnostico.';
    exactAdjustment = 'repetir baseline si no hay RPM confiable; si hay RPM, aplicar ajuste menor 2% a 3%';
  } else {
    energyUseSummary = 'El vuelo esta cerca de la referencia para este techo.';
    recommendation = 'Repetir misma configuracion para confirmar reproducibilidad.';
    exactAdjustment = 'sin cambios';
  }

  return {
    ceilingBand: band,
    referenceDurationSec,
    referenceSource,
    durationGapSec: round(durationGapSec, 1),
    durationGapPct: round(durationGapPct, 1),
    score,
    scoreGap: round(referenceScore - score, 1),
    energyUseSummary,
    recommendation,
    exactAdjustment,
    keepConstant,
    evidence,
  };
}

export function createSession(input: {
  id: string;
  name: string;
  venueId: string;
  modelId: string;
  objective: SessionObjective;
  date?: string;
  propellerId?: string;
  motorId?: string;
  baselineConfigId?: string;
  notes?: string;
}): FlightSession {
  return {
    id: input.id,
    name: input.name,
    date: input.date ?? new Date().toISOString(),
    venueId: input.venueId,
    modelId: input.modelId,
    propellerId: input.propellerId,
    motorId: input.motorId,
    objective: input.objective,
    baselineConfigId: input.baselineConfigId,
    flightIds: [],
    status: 'open',
    notes: input.notes,
  };
}

export function createConfigurationFromFlight(flight: Flight, propellerId?: string, motor?: RubberMotor, sessionId?: string): FlightConfiguration {
  return {
    id: `config-${flight.id}`,
    sessionId,
    modelId: flight.modelId,
    propellerId,
    venueId: flight.venueId,
    motorId: flight.motorId,
    motorLoopLength: motor?.loopLengthMm,
    motorWeight: motor?.weightG,
    turnsLoaded: flight.turnsLoaded,
    backOff: flight.backOff,
    launchTurnsNet: Math.max(0, flight.turnsLoaded - flight.backOff),
    launchTorque: flight.launchTorque,
    maxPitchMm: flight.vpPropeller?.maxPitchMm,
    minPitchMm: flight.vpPropeller?.minPitchMm,
    springHardness: flight.vpPropeller?.springHardness,
    vpMechanismMode: flight.vpMechanismMode,
    trimNotes: `${flight.turnPattern}, ${flight.climb}, ${flight.stability}`,
    createdFromFlightId: flight.id,
    notes: flight.notes,
  };
}

export function createSuggestedConfiguration(params: {
  id: string;
  base: FlightConfiguration;
  variable: string;
  exactAdjustment: string;
  reason: string;
  sessionId: string;
  compatibleMotors?: RubberMotor[];
}): FlightConfiguration {
  const next: FlightConfiguration = {
    ...params.base,
    id: params.id,
    createdFromFlightId: undefined,
    suggestedForSessionId: params.sessionId,
    suggestedReason: params.reason,
    changedVariable: params.variable,
    notes: `Sugerida: ${params.reason}. Mantener una sola variable por ensayo.`,
  };
  const numeric = params.exactAdjustment.match(/->\s*([0-9]+(?:\.[0-9]+)?)/);
  const firstNumber = numeric ? Number(numeric[1]) : undefined;

  if (params.variable.includes('back-off') || params.variable.includes('backoff')) {
    next.backOff += params.exactAdjustment.includes('80') ? 80 : params.exactAdjustment.includes('60') ? 60 : 40;
    next.launchTurnsNet = Math.max(0, next.turnsLoaded - next.backOff);
  } else if (params.variable.includes('paso maximo') || params.variable.includes('maxPitch')) {
    next.maxPitchMm = firstNumber ?? (next.maxPitchMm ? round(next.maxPitchMm * 1.04, 0) : next.maxPitchMm);
  } else if (params.variable.includes('paso minimo') || params.variable.includes('minPitch')) {
    const decrease = params.exactAdjustment.includes('-') || params.reason.toLowerCase().includes('disminuir');
    next.minPitchMm = firstNumber ?? (next.minPitchMm ? round(next.minPitchMm * (decrease ? 0.96 : 1.03), 0) : next.minPitchMm);
  } else if (params.variable.includes('resorte')) {
    next.springHardness = next.springHardness !== undefined ? next.springHardness + 1 : next.springHardness;
  } else if (params.variable.includes('motor')) {
    const alternative = params.compatibleMotors?.find((motor) => motor.id !== next.motorId);
    if (alternative) {
      next.motorId = alternative.id;
      next.motorLoopLength = alternative.loopLengthMm;
      next.motorWeight = alternative.weightG;
    }
  }

  return next;
}

function changed(
  variable: ChangedVariable['variable'],
  previousValue: string | number | boolean | null | undefined,
  newValue: string | number | boolean | null | undefined,
): ChangedVariable | undefined {
  const prev = previousValue ?? null;
  const next = newValue ?? null;
  if (prev === next) return undefined;
  const numeric = typeof prev === 'number' && typeof next === 'number';
  const delta = numeric ? round(next - prev, 3) : undefined;
  const deltaPct = numeric && prev !== 0 ? round(((next - prev) / prev) * 100, 1) : undefined;
  const direction = numeric ? (next > prev ? 'increase' : 'decrease') : 'changed';
  return { variable, previousValue: prev, newValue: next, delta, deltaPct, direction };
}

export function detectConfigurationChange(
  previousConfig: FlightConfiguration,
  currentConfig: FlightConfiguration,
  sessionId = '',
): ConfigurationChange {
  const changedVariables = [
    changed('turnsLoaded', previousConfig.turnsLoaded, currentConfig.turnsLoaded),
    changed('backOff', previousConfig.backOff, currentConfig.backOff),
    changed('other', previousConfig.launchTurnsNet, currentConfig.launchTurnsNet),
    changed('launchTorque', previousConfig.launchTorque, currentConfig.launchTorque),
    changed('motorId', previousConfig.motorId, currentConfig.motorId),
    changed('motorLoopLength', previousConfig.motorLoopLength, currentConfig.motorLoopLength),
    changed('motorWeight', previousConfig.motorWeight, currentConfig.motorWeight),
    changed('maxPitchMm', previousConfig.maxPitchMm, currentConfig.maxPitchMm),
    changed('minPitchMm', previousConfig.minPitchMm, currentConfig.minPitchMm),
    changed('springHardness', previousConfig.springHardness, currentConfig.springHardness),
    changed('vpMechanismMode', previousConfig.vpMechanismMode, currentConfig.vpMechanismMode),
    changed('trim', previousConfig.trimNotes, currentConfig.trimNotes),
    changed('propellerId', previousConfig.propellerId, currentConfig.propellerId),
    changed('modelId', previousConfig.modelId, currentConfig.modelId),
    changed('venueId', previousConfig.venueId, currentConfig.venueId),
  ].filter((item): item is ChangedVariable => Boolean(item));
  const importantCount = changedVariables.filter((item) => item.variable !== 'other').length;
  const warning = importantCount > 1
    ? ' Se modificaron varias variables; la causa de la mejora/empeoramiento es menos confiable.'
    : '';
  const summary = changedVariables.length
    ? `${changedVariables.map((item) => item.variable).join(', ')}.${warning}`
    : 'Sin cambios de configuracion detectados.';

  return {
    id: `change-${previousConfig.createdFromFlightId ?? previousConfig.id}-${currentConfig.createdFromFlightId ?? currentConfig.id}`,
    sessionId,
    fromFlightId: previousConfig.createdFromFlightId ?? '',
    toFlightId: currentConfig.createdFromFlightId ?? '',
    changedVariables,
    summary,
    detectedAutomatically: true,
    userConfirmed: false,
    notes: importantCount > 1 ? 'Comparacion de baja confianza por multiples variables.' : undefined,
  };
}

export function evaluateChangeOutcome(
  previousFlight: Flight | undefined,
  currentFlight: Flight,
  previousVenue?: Venue,
  currentVenue?: Venue,
  previousMotor?: RubberMotor,
  currentMotor?: RubberMotor,
): FlightComparison['decision'] {
  if (!previousFlight) return 'inconcluso';
  if (currentFlight.stability !== 'stable' || currentFlight.turnPattern === 'irregular') return 'inconcluso';
  if (currentFlight.remainingTurns < 0 || currentFlight.durationSec <= 0) return 'inconcluso';

  const previousScore = scoreFlight(previousFlight, previousVenue, previousMotor);
  const currentScore = scoreFlight(currentFlight, currentVenue, currentMotor);
  const durationDeltaPct = previousFlight.durationSec > 0
    ? (currentFlight.durationSec - previousFlight.durationSec) / previousFlight.durationSec
    : 0;
  const prevMetrics = calculateFlightMetrics(previousFlight, previousVenue, previousMotor);
  const curMetrics = calculateFlightMetrics(currentFlight, currentVenue, currentMotor);
  const newHardCeiling = !previousFlight.touchedCeiling && currentFlight.touchedCeiling && curMetrics.totalCeilingContactSec > 5;
  const remnantWorse = curMetrics.remainingPercent - prevMetrics.remainingPercent > 10 && durationDeltaPct < 0.02;

  if (durationDeltaPct < -0.05 || currentScore < previousScore - 5 || newHardCeiling || remnantWorse) return 'empeoro';
  if (durationDeltaPct > 0.03 && currentScore >= previousScore - 2) return 'mejoro';
  if (currentScore > previousScore + 5) return 'mejoro';
  if (Math.abs(durationDeltaPct) <= 0.03 && Math.abs(currentScore - previousScore) <= 5) return 'igual';
  return 'inconcluso';
}

export function evaluateChangeImpact(
  previousFlight: Flight,
  currentFlight: Flight,
  configurationChange: ConfigurationChange,
  previousVenue?: Venue,
  currentVenue?: Venue,
  previousMotor?: RubberMotor,
  currentMotor?: RubberMotor,
): ChangeImpact {
  const prevMetrics = calculateFlightMetrics(previousFlight, previousVenue, previousMotor);
  const curMetrics = calculateFlightMetrics(currentFlight, currentVenue, currentMotor);
  const previousScore = scoreFlight(previousFlight, previousVenue, previousMotor);
  const currentScore = scoreFlight(currentFlight, currentVenue, currentMotor);
  const durationDeltaSec = currentFlight.durationSec - previousFlight.durationSec;
  const durationDeltaPct = previousFlight.durationSec > 0 ? (durationDeltaSec / previousFlight.durationSec) * 100 : 0;
  const scoreDelta = currentScore - previousScore;
  const ceilingUseDeltaPct = curMetrics.ceilingUsePercent - prevMetrics.ceilingUsePercent;
  const remainingTurnsDeltaPct = curMetrics.remainingPercent - prevMetrics.remainingPercent;
  const prevRpm = analyzeRpmProfile(previousFlight);
  const curRpm = analyzeRpmProfile(currentFlight);
  const manyVariables = configurationChange.changedVariables.filter((item) => item.variable !== 'other').length > 1;
  const unstable = currentFlight.stability !== 'stable' || currentFlight.turnPattern === 'irregular';
  const missingCritical = curRpm.rpmTrend === 'unknown' || !Number.isFinite(currentFlight.remainingTurns);
  const previousHardCeiling = (previousFlight.touchedCeiling || previousFlight.secondCeilingTouch) && prevMetrics.totalCeilingContactSec > 5;
  const currentHardCeiling = (currentFlight.touchedCeiling || currentFlight.secondCeilingTouch) && curMetrics.totalCeilingContactSec > 5;
  const removedHardCeiling = previousHardCeiling && !currentHardCeiling && durationDeltaPct > -5;
  const introducedHardCeiling = !previousHardCeiling && currentHardCeiling;
  const reducedExcessRemnant = prevMetrics.remainingPercent > 15 && remainingTurnsDeltaPct < -4 && durationDeltaPct >= -2;
  const increasedHighRemnant = curMetrics.remainingPercent > 15 && remainingTurnsDeltaPct > 6 && durationDeltaPct < 2;

  let decision: ChangeImpact['decision'] = 'igual';
  let confidence: ChangeImpact['confidence'] = 'high';
  let recommendation: ChangeImpact['recommendation'] = 'repetir';
  let explanation = `Cambio ${configurationChange.summary} Duracion ${round(durationDeltaSec, 1)}s (${round(durationDeltaPct, 1)}%), score ${round(scoreDelta, 1)}.`;

  if (manyVariables || unstable || missingCritical) {
    decision = 'inconcluso';
    confidence = manyVariables ? 'low' : 'medium';
    recommendation = missingCritical ? 'recolectar_mas_datos' : 'repetir';
    explanation += manyVariables
      ? ' Se modificaron varias variables; no se puede atribuir causalidad con confianza.'
      : ' Faltan datos criticos o el vuelo no fue estable.';
  } else if (durationDeltaPct < -5 || introducedHardCeiling || increasedHighRemnant || scoreDelta < -5) {
    decision = 'empeoro';
    recommendation = 'revertir';
    explanation += introducedHardCeiling
      ? ' Aparecio toque fuerte de techo.'
      : increasedHighRemnant
        ? ' Aumento el remanente sin ganar duracion.'
        : ' Bajo la performance.';
  } else if ((durationDeltaPct > 3 && scoreDelta >= 0) || removedHardCeiling || reducedExcessRemnant) {
    decision = 'mejoro';
    recommendation = durationDeltaPct > 8 || reducedExcessRemnant ? 'profundizar_cambio' : 'repetir';
    explanation += removedHardCeiling
      ? ' El cambio elimino techo fuerte sin perdida relevante.'
      : reducedExcessRemnant
        ? ' El cambio redujo remanente excesivo manteniendo duracion.'
        : ' Aumento duracion y mantuvo score.';
  }

  return {
    decision,
    confidence,
    durationDeltaSec: round(durationDeltaSec, 1),
    durationDeltaPct: round(durationDeltaPct, 1),
    scoreDelta: round(scoreDelta, 1),
    ceilingUseDeltaPct: round(ceilingUseDeltaPct, 1),
    remainingTurnsDeltaPct: round(remainingTurnsDeltaPct, 1),
    rpmTrendChange: `${prevRpm.rpmTrend} -> ${curRpm.rpmTrend}`,
    explanation,
    recommendation,
  };
}

export function recommendAfterChange(
  session: FlightSession,
  previousFlight: Flight | undefined,
  currentFlight: Flight,
  changedVariable: string,
  decision: FlightComparison['decision'],
  currentVenue?: Venue,
  currentMotor?: RubberMotor,
  similarRepeatCount = 0,
): FlightComparison['recommendation'] {
  const metrics = calculateFlightMetrics(currentFlight, currentVenue, currentMotor);
  const rpm = analyzeRpmProfile(currentFlight);
  if (rpm.rpmTrend === 'unknown' || currentFlight.remainingTurns === undefined) return 'recolectar_mas_datos';
  if (decision === 'empeoro') return 'revertir';
  if (decision === 'mejoro') {
    const score = scoreFlight(currentFlight, currentVenue, currentMotor);
    const goodCeiling = metrics.ceilingUsePercent >= 75 && metrics.ceilingUsePercent <= 95 && !currentFlight.touchedCeiling;
    const goodRemaining = metrics.remainingPercent >= 4 && metrics.remainingPercent <= 18;
    if (score > 180 && goodCeiling && goodRemaining && similarRepeatCount >= 2) return 'guardar_como_optimo';
    return 'profundizar_cambio';
  }
  if (decision === 'igual') return changedVariable === 'baseline' || session.objective === 'validar_baseline' ? 'repetir' : 'probar_variable_alternativa';
  return previousFlight ? 'repetir' : 'recolectar_mas_datos';
}

export function compareFlights(params: {
  session: FlightSession;
  previousFlight?: Flight;
  currentFlight: Flight;
  bestFlight?: Flight;
  previousVenue?: Venue;
  currentVenue?: Venue;
  previousMotor?: RubberMotor;
  currentMotor?: RubberMotor;
  changedVariable?: string;
  similarRepeatCount?: number;
}): FlightComparison {
  const { session, previousFlight, currentFlight, bestFlight } = params;
  const prevScore = previousFlight ? scoreFlight(previousFlight, params.previousVenue, params.previousMotor) : 0;
  const curScore = scoreFlight(currentFlight, params.currentVenue, params.currentMotor);
  const prevMetrics = previousFlight ? calculateFlightMetrics(previousFlight, params.previousVenue, params.previousMotor) : undefined;
  const curMetrics = calculateFlightMetrics(currentFlight, params.currentVenue, params.currentMotor);
  const decision = evaluateChangeOutcome(
    previousFlight,
    currentFlight,
    params.previousVenue,
    params.currentVenue,
    params.previousMotor,
    params.currentMotor,
  );
  const recommendation = recommendAfterChange(
    session,
    previousFlight,
    currentFlight,
    params.changedVariable ?? 'variable no registrada',
    decision,
    params.currentVenue,
    params.currentMotor,
    params.similarRepeatCount ?? 0,
  );
  const durationDeltaSec = previousFlight ? currentFlight.durationSec - previousFlight.durationSec : 0;
  const durationDeltaPct = previousFlight?.durationSec ? (durationDeltaSec / previousFlight.durationSec) * 100 : 0;
  const rpmPrev = previousFlight ? analyzeRpmProfile(previousFlight).rpmTrend : undefined;
  const rpmCur = analyzeRpmProfile(currentFlight).rpmTrend;

  return {
    currentFlightId: currentFlight.id,
    previousFlightId: previousFlight?.id,
    bestSessionFlightId: bestFlight?.id,
    durationDeltaSec: round(durationDeltaSec, 1),
    durationDeltaPct: round(durationDeltaPct, 1),
    scoreDelta: round(curScore - prevScore, 1),
    ceilingUseDelta: round(curMetrics.ceilingUsePercent - (prevMetrics?.ceilingUsePercent ?? curMetrics.ceilingUsePercent), 1),
    remainingTurnsDelta: round(curMetrics.remainingPercent - (prevMetrics?.remainingPercent ?? curMetrics.remainingPercent), 1),
    rpmTrendChange: rpmPrev ? `${rpmPrev} -> ${rpmCur}` : rpmCur,
    decision,
    recommendation,
    explanation: previousFlight
      ? `Se cambio ${params.changedVariable ?? 'una variable'}: duracion ${durationDeltaSec >= 0 ? '+' : ''}${round(durationDeltaSec, 1)}s, score ${round(curScore - prevScore, 1)}.`
      : 'Primer vuelo de la sesion: usar como baseline antes de optimizar.',
  };
}

export function compareFlightToPrevious(
  session: FlightSession,
  currentFlight: Flight,
  allFlights: Flight[] = [],
  venues: Venue[] = [],
  motors: RubberMotor[] = [],
): FlightComparison {
  const index = session.flightIds.indexOf(currentFlight.id);
  const previousId = index > 0 ? session.flightIds[index - 1] : undefined;
  const previousFlight = allFlights.find((flight) => flight.id === previousId);
  return compareFlights({
    session,
    previousFlight,
    currentFlight,
    previousVenue: previousFlight ? venues.find((venue) => venue.id === previousFlight.venueId) : undefined,
    currentVenue: venues.find((venue) => venue.id === currentFlight.venueId),
    previousMotor: previousFlight ? motors.find((motor) => motor.id === previousFlight.motorId) : undefined,
    currentMotor: motors.find((motor) => motor.id === currentFlight.motorId),
    changedVariable: inferChangedVariable(previousFlight, currentFlight),
  });
}

export function compareFlightToBest(
  session: FlightSession,
  currentFlight: Flight,
  allFlights: Flight[] = [],
  venues: Venue[] = [],
  motors: RubberMotor[] = [],
): FlightComparison {
  const bestFlight = allFlights.find((flight) => flight.id === session.bestFlightId);
  return compareFlights({
    session,
    previousFlight: bestFlight,
    currentFlight,
    bestFlight,
    previousVenue: bestFlight ? venues.find((venue) => venue.id === bestFlight.venueId) : undefined,
    currentVenue: venues.find((venue) => venue.id === currentFlight.venueId),
    previousMotor: bestFlight ? motors.find((motor) => motor.id === bestFlight.motorId) : undefined,
    currentMotor: motors.find((motor) => motor.id === currentFlight.motorId),
    changedVariable: inferChangedVariable(bestFlight, currentFlight),
  });
}

export function inferChangedVariable(previous?: Flight, current?: Flight): string {
  if (!previous || !current) return 'baseline';
  if (previous.backOff !== current.backOff) return 'back-off';
  if (previous.turnsLoaded !== current.turnsLoaded) return 'vueltas cargadas';
  if (previous.motorId !== current.motorId) return 'motor';
  if (previous.vpPropeller?.minPitchMm !== current.vpPropeller?.minPitchMm) return 'paso minimo VP';
  if (previous.vpPropeller?.maxPitchMm !== current.vpPropeller?.maxPitchMm) return 'paso maximo VP';
  if (previous.vpPropeller?.springHardness !== current.vpPropeller?.springHardness) return 'resorte VP';
  return 'misma configuracion';
}

export function buildOptimalConfiguration(input: {
  id: string;
  name: string;
  session: FlightSession;
  flight: Flight;
  configuration: FlightConfiguration;
  venue?: Venue;
  motor?: RubberMotor;
  sessionFlights?: Flight[];
  notes?: string;
}): OptimalConfiguration {
  const metrics = calculateFlightMetrics(input.flight, input.venue, input.motor);
  const rpm = analyzeRpmProfile(input.flight);
  const validFor = ceilingBandForVenue(input.venue);
  const similarCount = (input.sessionFlights ?? []).filter((candidate) => {
    if (candidate.id === input.flight.id) return false;
    const candidateMetrics = calculateFlightMetrics(candidate, input.venue, input.motor);
    const durationClose = Math.abs(candidate.durationSec - input.flight.durationSec) / input.flight.durationSec <= 0.05;
    const ceilingClose = Math.abs(candidateMetrics.ceilingUsePercent - metrics.ceilingUsePercent) <= 10;
    const remClose = Math.abs(candidateMetrics.remainingPercent - metrics.remainingPercent) <= 5;
    const stableEquivalent = candidate.stability === input.flight.stability || (candidate.stability === 'stable' && input.flight.stability === 'stable');
    const noHardCeiling = !(candidate.touchedCeiling && candidateMetrics.totalCeilingContactSec > 5) && !(input.flight.touchedCeiling && metrics.totalCeilingContactSec > 5);
    return durationClose && ceilingClose && remClose && stableEquivalent && noHardCeiling;
  }).length;
  const highQuality = input.flight.stability === 'stable'
    && metrics.ceilingUsePercent >= 70
    && metrics.ceilingUsePercent <= 96
    && metrics.remainingPercent >= 3
    && metrics.remainingPercent <= 20
    && scoreFlight(input.flight, input.venue, input.motor) >= input.flight.durationSec * 0.8;
  const confidence = similarCount >= 1 && highQuality ? 'high' : highQuality ? 'medium' : 'low';
  return {
    id: input.id,
    name: input.name,
    modelId: input.flight.modelId,
    propellerId: input.session.propellerId,
    venueId: input.flight.venueId,
    configurationId: input.configuration.id,
    sourceSessionId: input.session.id,
    sourceFlightId: input.flight.id,
    durationSec: input.flight.durationSec,
    score: scoreFlight(input.flight, input.venue, input.motor),
    ceilingUsePct: metrics.ceilingUsePercent,
    remainingTurnsPct: metrics.remainingPercent,
    rpmProfileSummary: `${rpm.rpmTrend}: ${rpm.interpretation}`,
    confidence,
    validFor,
    notes: input.notes,
  };
}
