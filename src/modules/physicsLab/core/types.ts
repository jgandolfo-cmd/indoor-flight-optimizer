export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type DataProvenance =
  | 'measured'
  | 'estimated'
  | 'calculated'
  | 'simulated'
  | 'assumption'
  | 'calibrated';

export type PhysicalValue<T = number> = {
  value: T;
  unit: string;
  provenance: DataProvenance;
  confidence: ConfidenceLevel;
  source?: string;
  uncertainty?: number;
  notes?: string;
};

export type AircraftCategory = 'F1M' | 'F1L' | 'EZB' | 'P25';

export type PhysicsLabInput = {
  category?: AircraftCategory;
  model?: {
    id?: string;
    name?: string;
    weightG?: number;
    wingspanMm?: number;
    wingAreaDm2?: number;
  };
  motor?: {
    id?: string;
    name?: string;
    rubberMassG?: number;
    linearDensityGPerM?: number;
    loopLengthMm?: number;
    strandCount?: number;
    turnsLoaded?: number;
    backoffTurns?: number;
    remainingTurns?: number;
    launchTorque?: number;
    launchTorqueUnit?: 'Nmm' | 'mNm' | 'gcm' | 'ozin' | 'lbIn' | 'inLb' | 'lbfIn' | 'unknown';
  };
  sourceType?: 'measured' | 'published_partial' | 'synthetic' | 'hybrid';
  propeller?: {
    id?: string;
    name?: string;
    diameterMm?: number;
    propType?: 'fixed' | 'variable_pitch';
    minPitchMm?: number;
    maxPitchMm?: number;
    minPitchDeg?: number;
    maxPitchDeg?: number;
    springHardness?: number;
    vpMechanismMode?: 'torque_opens_to_high_pitch' | 'torque_closes_to_low_pitch' | 'unknown';
  };
  flight?: {
    durationSec?: number;
    maxAltitudeM?: number;
    timeToMaxAltitudeSec?: number;
    touchedCeiling?: 'no' | 'light' | 'hard' | boolean | string;
    rpmInitial?: number;
    rpmMid?: number;
    rpmFinal?: number;
    descentType?: 'smooth' | 'abrupt' | 'stall' | 'unknown';
    stability?: string;
    notes?: string;
  };
};

export type PropellerLoadClass = 'high_absorption' | 'normal' | 'unloaded' | 'unknown';

export type PhysicsLabResult = {
  linearDensity?: PhysicalValue<number>;
  initialPower?: PhysicalValue<number>;
  averagePower?: PhysicalValue<number>;
  verticalSpeed?: PhysicalValue<number>;
  requiredPower?: PhysicalValue<number>;
  energyTotal?: PhysicalValue<number>;
  energyRemaining?: PhysicalValue<number>;
  energyUseRatio?: PhysicalValue<number>;
  remainingTurnsRatio?: PhysicalValue<number>;
  propellerLoadRatio?: PhysicalValue<number>;
  propellerLoadClass?: PropellerLoadClass;
  assumptions: string[];
  missingData: string[];
  warnings: string[];
  confidence: ConfidenceLevel;
};

export type RecommendationTargetVariable =
  | 'measure_more'
  | 'backoff'
  | 'turns_loaded'
  | 'motor_length'
  | 'motor_density'
  | 'min_pitch'
  | 'max_pitch'
  | 'vp_transition'
  | 'friction'
  | 'trim'
  | 'repeat_baseline'
  | 'no_change';

export type PhysicsLabRecommendation = {
  title: string;
  recommendation: string;
  targetVariable: RecommendationTargetVariable;
  direction: 'increase' | 'decrease' | 'inspect' | 'repeat' | 'keep' | 'unknown';
  magnitude?: string;
  rationale: string[];
  evidenceUsed: string[];
  assumptionsUsed: string[];
  missingData: string[];
  doNotTouch: string[];
  confidence: ConfidenceLevel;
  operationalNote?: string;
  riskLevel: 'low' | 'medium' | 'high';
  blocked?: boolean;
  blockReason?: string;
};

export type TorqueSample = {
  turns: number;
  torqueNm: number;
};

export type CalcOutput<T = number> = {
  result?: PhysicalValue<T>;
  missing: string[];
  warnings: string[];
  assumptions: string[];
};
