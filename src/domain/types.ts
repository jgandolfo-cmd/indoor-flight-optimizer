export type TurnPattern = 'left' | 'right' | 'irregular';
export type ClimbQuality = 'low' | 'good' | 'too_aggressive';
export type StabilityQuality = 'stable' | 'oscillating' | 'stalling' | 'diving';
export type LandingQuality = 'soft' | 'hard' | 'hung' | 'collision';
export type PropellerType = 'fixed_pitch' | 'variable_pitch' | 'unknown';
export type RpmVisual = 'slow' | 'normal' | 'fast' | 'unknown';
export type RpmTrend = 'rising' | 'stable' | 'slow_decay' | 'fast_decay' | 'sudden_drop' | 'unknown';
export type VpTransitionObserved = 'early' | 'normal' | 'late' | 'unknown';
export type VpMechanismMode = 'known' | 'unknown';
export type ProblemFamily =
  | 'ceiling'
  | 'motor'
  | 'propeller'
  | 'variable_pitch'
  | 'friction'
  | 'trim'
  | 'environment'
  | 'insufficient_data';
export type RecommendationConfidence = 'low' | 'medium' | 'high';

export interface RecommendationAction {
  variable: string;
  action: string;
  exactAdjustment: string;
  warning?: string;
}

export interface FlightHypothesis {
  id: string;
  family: ProblemFamily;
  label: string;
  evidence: string[];
  confidence: RecommendationConfidence;
  recommendedAction?: RecommendationAction;
}

export interface FlightHypothesisEvaluation {
  symptomSummary: string;
  primaryProblemFamily: ProblemFamily;
  hypotheses: FlightHypothesis[];
  recommendedAction: string;
  exactAdjustment: string;
  keepConstant: string[];
  missingData: string[];
  warning?: string;
}

export interface RpmSample {
  timeSec: number;
  rpm: number;
  note?: string;
}

export interface RpmProfileAnalysis {
  rpmInitial?: number;
  rpmMid?: number;
  rpmFinal?: number;
  rpmDecayPct?: number;
  rpmTrend: RpmTrend;
  interpretation: string;
  evidence: string[];
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  ceilingHeightM: number;
  usableLengthM: number;
  usableWidthM: number;
  notes?: string;
}

export interface IndoorModel {
  id: string;
  name: string;
  wingspanMm: number;
  weightG: number;
  wingAreaDm2?: number;
  wingLeadingEdgeHeightMm?: number;
  wingTrailingEdgeHeightMm?: number;
  stabilizerLeadingEdgeHeightMm?: number;
  stabilizerTrailingEdgeHeightMm?: number;
  cgFromWingLeadingEdgeMm?: number;
  notes?: string;
}

export interface RubberBatch {
  id: string;
  name: string;
  manufacturer: string;
  widthMm: number;
  thicknessMm: number;
  densityNotes?: string;
  purchaseDate?: string;
  notes?: string;
}

export interface RubberMotor {
  id: string;
  name: string;
  batchId: string;
  loopLengthMm: number;
  weightG: number;
  strands: number;
  lubricant?: string;
  notes?: string;
}

export interface Propeller {
  id: string;
  name: string;
  type: PropellerType;
  diameterMm: number;
  maxPitchMm?: number;
  minPitchMm?: number;
  springHardness?: number;
  vpMechanismMode?: VpMechanismMode;
  bladeMaterial?: string;
  notes?: string;
}

export interface VpPropellerSettings {
  maxPitchMm?: number;
  minPitchMm?: number;
  springHardness?: number;
  notes?: string;
}

export interface Flight {
  id: string;
  date: string;
  venueId: string;
  modelId: string;
  propellerId?: string;
  motorId: string;
  turnsLoaded: number;
  backOff: number;
  durationSec: number;
  maxAltitudeM: number;
  touchedCeiling: boolean;
  timeToCeilingSec?: number;
  ceilingContactDurationSec?: number;
  secondClimb: boolean;
  secondCeilingTouch: boolean;
  secondCeilingTimeSec?: number;
  secondCeilingContactDurationSec?: number;
  turnPattern: TurnPattern;
  climb: ClimbQuality;
  stability: StabilityQuality;
  landing: LandingQuality;
  propType: PropellerType;
  rpmVisual: RpmVisual;
  rpmSamples?: RpmSample[];
  rpmInitial?: number;
  rpmMid?: number;
  rpmFinal?: number;
  rpmTrend?: RpmTrend;
  vpPropeller: VpPropellerSettings;
  vpTransitionObserved: VpTransitionObserved;
  vpMechanismMode: VpMechanismMode;
  vpTransitionTimeSec?: number;
  rpmBeforeVpTransition?: number;
  rpmAfterVpTransition?: number;
  launchTorque?: number;
  descentStartSec?: number;
  descentStartTorque?: number;
  turnsAtDescentStart?: number;
  remainingTurns: number;
  notes?: string;
}

export interface FlightMetrics {
  netTurns: number;
  remainingPercent: number;
  ceilingUsePercent: number;
  timeToCeilingPercent: number;
  ceilingContactPercent: number;
  totalCeilingContactSec: number;
  efficiencyPerTurn: number;
  efficiencyPerRubberGram: number;
}

export interface Diagnosis {
  flightId: string;
  text: string;
  probableLimiter: string;
  nextTestRecommendation: string;
  suggestedVariableToChange: string;
  suggestedVariablesToHold: string[];
}

export type SessionObjective =
  | 'buscar_optimo'
  | 'comparar_motores'
  | 'ajustar_vp'
  | 'validar_baseline'
  | 'trimado'
  | 'competencia';

export type SessionStatus = 'open' | 'closed' | 'archived';

export interface FlightSession {
  id: string;
  name: string;
  date: string;
  venueId: string;
  modelId: string;
  propellerId?: string;
  motorId?: string;
  objective: SessionObjective;
  baselineConfigId?: string;
  flightIds: string[];
  status: SessionStatus;
  bestFlightId?: string;
  bestConfigurationId?: string;
  notes?: string;
}

export interface FlightConfiguration {
  id: string;
  sessionId?: string;
  modelId: string;
  propellerId?: string;
  venueId?: string;
  motorId: string;
  motorLoopLength?: number;
  motorWeight?: number;
  turnsLoaded: number;
  backOff: number;
  launchTurnsNet: number;
  launchTorque?: number;
  maxPitchMm?: number;
  minPitchMm?: number;
  springHardness?: number;
  vpMechanismMode?: string;
  trimNotes?: string;
  createdFromFlightId?: string;
  suggestedForSessionId?: string;
  suggestedReason?: string;
  changedVariable?: string;
  notes?: string;
}

export type ChangedVariableName =
  | 'turnsLoaded'
  | 'backOff'
  | 'launchTorque'
  | 'motorId'
  | 'motorLoopLength'
  | 'motorWeight'
  | 'maxPitchMm'
  | 'minPitchMm'
  | 'springHardness'
  | 'vpMechanismMode'
  | 'trim'
  | 'propellerId'
  | 'modelId'
  | 'venueId'
  | 'other';

export interface ChangedVariable {
  variable: ChangedVariableName;
  previousValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  delta?: number;
  deltaPct?: number;
  direction?: 'increase' | 'decrease' | 'changed' | 'unknown';
}

export interface ConfigurationChange {
  id: string;
  sessionId: string;
  fromFlightId: string;
  toFlightId: string;
  changedVariables: ChangedVariable[];
  summary: string;
  detectedAutomatically: boolean;
  userConfirmed: boolean;
  notes?: string;
}

export interface ChangeImpact {
  decision: 'mejoro' | 'empeoro' | 'igual' | 'inconcluso';
  confidence: 'low' | 'medium' | 'high';
  durationDeltaSec: number;
  durationDeltaPct: number;
  scoreDelta: number;
  ceilingUseDeltaPct: number;
  remainingTurnsDeltaPct?: number;
  rpmTrendChange?: string;
  explanation: string;
  recommendation:
    | 'repetir'
    | 'profundizar_cambio'
    | 'revertir'
    | 'probar_variable_alternativa'
    | 'guardar_como_optimo'
    | 'recolectar_mas_datos';
}

export interface OptimalConfiguration {
  id: string;
  name: string;
  modelId: string;
  propellerId?: string;
  venueId?: string;
  configurationId: string;
  sourceSessionId: string;
  sourceFlightId: string;
  durationSec: number;
  score: number;
  ceilingUsePct: number;
  remainingTurnsPct: number;
  rpmProfileSummary?: string;
  confidence: 'low' | 'medium' | 'high';
  validFor: 'este_salon' | 'menos_8m' | 'techo_bajo' | 'techo_medio' | 'techo_alto' | 'general';
  notes?: string;
}

export interface FlightComparison {
  currentFlightId: string;
  previousFlightId?: string;
  bestSessionFlightId?: string;
  durationDeltaSec: number;
  durationDeltaPct: number;
  scoreDelta: number;
  ceilingUseDelta: number;
  remainingTurnsDelta: number;
  rpmTrendChange?: string;
  decision: 'mejoro' | 'empeoro' | 'igual' | 'inconcluso';
  recommendation:
    | 'repetir'
    | 'profundizar_cambio'
    | 'revertir'
    | 'probar_variable_alternativa'
    | 'guardar_como_optimo'
    | 'recolectar_mas_datos';
  explanation: string;
}

export interface CeilingPerformanceEvaluation {
  ceilingBand: 'menos_8m' | 'techo_bajo' | 'techo_medio' | 'techo_alto' | 'general';
  referenceDurationSec: number;
  referenceSource: 'optimal_guardado' | 'referencia_por_altura';
  durationGapSec: number;
  durationGapPct: number;
  score: number;
  scoreGap: number;
  energyUseSummary: string;
  recommendation: string;
  exactAdjustment: string;
  keepConstant: string[];
  evidence: string[];
}

export interface AppData {
  venues: Venue[];
  models: IndoorModel[];
  propellers: Propeller[];
  rubberBatches: RubberBatch[];
  motors: RubberMotor[];
  flights: Flight[];
  sessions: FlightSession[];
  flightConfigurations: FlightConfiguration[];
  configurationChanges: ConfigurationChange[];
  optimalConfigurations: OptimalConfiguration[];
  activeSessionId?: string;
}
