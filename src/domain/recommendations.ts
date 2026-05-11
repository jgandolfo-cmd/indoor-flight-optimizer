import { calculateFlightMetrics, calculateModelGeometry } from './calculations';
import { analyzeRpmProfile } from './rpm';
import type {
  Flight,
  FlightHypothesis,
  FlightHypothesisEvaluation,
  IndoorModel,
  ProblemFamily,
  RecommendationAction,
  RubberMotor,
  Venue,
} from './types';

type Severity = 'small' | 'medium' | 'large';
type AdjustmentVariable = 'backoff' | 'percent' | 'spring';

const pct = (value: number) => `${Math.round(value * 100)}%`;
const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function getAdjustmentMagnitude(severity: Severity, variable: AdjustmentVariable): string {
  if (variable === 'backoff') {
    if (severity === 'small') return '+20 vueltas';
    if (severity === 'medium') return '+40 a +60 vueltas';
    return '+80 a +120 vueltas';
  }

  if (variable === 'spring') {
    return 'un paso de preload como maximo';
  }

  if (severity === 'small') return '2%';
  if (severity === 'medium') return '3% a 5%';
  return '5% a 8%';
}

function severityFrom(
  remainingPct: number,
  useOfCeiling: number,
  touchedCeiling: boolean,
  earlyDescent: boolean,
): Severity {
  if (remainingPct > 0.25 || (touchedCeiling && useOfCeiling > 0.95) || earlyDescent) return 'large';
  if (remainingPct > 0.15 || useOfCeiling > 0.8) return 'medium';
  return 'small';
}

function action(variable: string, actionText: string, exactAdjustment: string, warning?: string): RecommendationAction {
  return {
    variable,
    action: actionText,
    exactAdjustment,
    warning,
  };
}

function hypothesis(
  id: string,
  family: ProblemFamily,
  label: string,
  evidence: string[],
  confidence: FlightHypothesis['confidence'],
  recommendedAction?: RecommendationAction,
): FlightHypothesis {
  return { id, family, label, evidence, confidence, recommendedAction };
}

function choosePrimary(hypotheses: FlightHypothesis[]): FlightHypothesis | undefined {
  return hypotheses[0];
}

function rpmFinalBand(flight: Flight, rpmAnalysis: ReturnType<typeof analyzeRpmProfile>): 'low' | 'normal' | 'high' | 'unknown' {
  if (rpmAnalysis.rpmInitial && rpmAnalysis.rpmFinal) {
    const ratio = rpmAnalysis.rpmFinal / rpmAnalysis.rpmInitial;
    if (rpmAnalysis.rpmTrend === 'rising' || ratio > 0.9) return 'high';
    if (ratio < 0.6 || rpmAnalysis.rpmTrend === 'fast_decay') return 'low';
    return 'normal';
  }

  if (flight.rpmVisual === 'slow') return 'low';
  if (flight.rpmVisual === 'fast') return 'high';
  if (flight.rpmVisual === 'normal') return 'normal';
  return 'unknown';
}

function transitionMatchesDrop(flight: Flight): boolean {
  if (!flight.rpmSamples?.length || flight.vpTransitionTimeSec === undefined) return false;
  const samples = [...flight.rpmSamples].sort((a, b) => a.timeSec - b.timeSec);
  return samples.some((sample, index) => {
    if (index === 0) return false;
    const previous = samples[index - 1];
    const drop = previous.rpm > 0 && (previous.rpm - sample.rpm) / previous.rpm > 0.25;
    const nearTransition = Math.abs(sample.timeSec - flight.vpTransitionTimeSec!) <= 3;
    return drop && nearTransition;
  });
}

export function evaluateFlightHypotheses(
  flight: Flight,
  model?: IndoorModel,
  motor?: RubberMotor,
  venue?: Venue,
): FlightHypothesisEvaluation {
  const metrics = calculateFlightMetrics(flight, venue, motor);
  const geometry = model ? calculateModelGeometry(model) : undefined;
  const rpmAnalysis = analyzeRpmProfile(flight);
  const rpmBand = rpmFinalBand(flight, rpmAnalysis);
  const launchTurnsNet = metrics.netTurns;
  const remainingPct = launchTurnsNet > 0 ? flight.remainingTurns / launchTurnsNet : 0;
  const useOfCeiling = venue?.ceilingHeightM ? flight.maxAltitudeM / venue.ceilingHeightM : 0;
  const touchedCeiling = flight.touchedCeiling || flight.secondCeilingTouch;
  const earlyCeilingTouch =
    touchedCeiling && flight.timeToCeilingSec !== undefined && flight.timeToCeilingSec < flight.durationSec * 0.25;
  const highInitialRpm =
    rpmAnalysis.rpmInitial !== undefined && rpmAnalysis.rpmFinal !== undefined
      ? rpmAnalysis.rpmInitial > rpmAnalysis.rpmFinal * 1.35
      : flight.rpmVisual === 'fast';
  const earlyDescent = flight.descentStartSec !== undefined && flight.descentStartSec < flight.durationSec * 0.75;
  const highRemaining = remainingPct > 0.15;
  const veryHighRemaining = remainingPct > 0.25;
  const stableFlight = flight.stability === 'stable' && flight.turnPattern !== 'irregular';
  const hasVp = flight.propType === 'variable_pitch';
  const severity = severityFrom(remainingPct, useOfCeiling, touchedCeiling, earlyDescent);
  const missingData: string[] = [];
  const hypotheses: FlightHypothesis[] = [];
  const keepBase = ['modelo', 'salon', 'motor', 'trimado'];

  if (rpmAnalysis.rpmTrend === 'unknown') missingData.push('RPM inicial/final o muestras RPM');
  if (!geometry || geometry.dragRisk === 'unknown') missingData.push('alturas BA/BF de ala y estabilizador');
  if (!venue) missingData.push('salon para calcular uso de techo');
  if (hasVp && flight.vpMechanismMode === 'unknown') missingData.push('sentido del mecanismo VP');
  if (highRemaining && flight.descentStartSec === undefined) missingData.push('tiempo de inicio de caida');
  if (hasVp && flight.vpPropeller.minPitchMm === undefined) missingData.push('paso minimo VP');

  const symptomSummary = [
    `remanente ${pct(remainingPct)}`,
    `uso de techo ${pct(useOfCeiling)}`,
    touchedCeiling ? 'toco techo' : 'sin toque de techo',
    earlyDescent ? 'caida temprana' : 'caida no temprana o no registrada',
    `rpm ${rpmAnalysis.rpmTrend}`,
  ].join(' · ');

  if (flight.stability !== 'stable' || flight.turnPattern === 'irregular') {
    const primaryAction = action(
      'trimado',
      'Corregir trimado y repetir baseline antes de modificar energia.',
      'no modificar motor, goma ni VP en este vuelo',
    );
    hypotheses.push(
      hypothesis(
        'trim-instability-first',
        'trim',
        'Vuelo inestable: el trimado domina la lectura',
        [`estabilidad: ${flight.stability}`, `patron de giro: ${flight.turnPattern}`],
        'high',
        primaryAction,
      ),
    );
    return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['motor', 'goma', 'helice VP', 'vueltas'], missingData);
  }

  if (geometry?.dragRisk === 'high' && stableFlight && metrics.ceilingUsePercent < 70) {
    const primaryAction = action(
      'geometria modelo',
      'Revisar incidencia/decalage y CG antes de seguir cambiando motor o helice.',
      'medir y corregir alturas BA/BF; no cambiar energia en este ensayo',
    );
    hypotheses.push(
      hypothesis(
        'geometry-drag-risk',
        'trim',
        'Riesgo alto de drag por geometria del modelo',
        geometry.evidence,
        'medium',
        primaryAction,
      ),
    );
    return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['motor', 'helice', 'vueltas cargadas', 'back-off'], missingData);
  }

  if ((earlyCeilingTouch && highInitialRpm) || (earlyCeilingTouch || (highRemaining && touchedCeiling))) {
    const backoffMagnitude =
      remainingPct <= 0.15 ? '+20 vueltas' : remainingPct <= 0.25 ? '+40 a +60 vueltas' : '+80 vueltas';
    const primaryAction = action(
      'back-off',
      'Aumentar back-off para sacar energia inicial antes de tocar techo.',
      earlyCeilingTouch && highInitialRpm ? '+40 a +80 vueltas' : backoffMagnitude,
    );
    hypotheses.push(
      hypothesis(
        'ceiling-initial-distribution',
        'ceiling',
        'Techo o distribucion inicial limitan antes que la fase final',
        [
          `remanente ${pct(remainingPct)}`,
          touchedCeiling ? 'hubo contacto con techo' : 'sin contacto declarado',
          earlyCeilingTouch ? `techo a ${flight.timeToCeilingSec}s` : 'contacto con techo con remanente alto',
          highInitialRpm ? 'RPM inicial alta' : rpmAnalysis.interpretation,
        ],
        'high',
        primaryAction,
      ),
    );

    if (hasVp && flight.vpPropeller.maxPitchMm !== undefined) {
      hypotheses.push(
        hypothesis(
          'vp-max-pitch-ceiling',
          'variable_pitch',
          'Paso maximo VP puede estar cargando demasiado arriba',
          [`paso maximo actual: ${flight.vpPropeller.maxPitchMm} mm`, 'VP disponible'],
          'medium',
          action(
            'paso maximo VP',
            'Aumentar paso maximo para descargar rpm inicial sin cambiar motor.',
            `+3% a +5%: ${round(flight.vpPropeller.maxPitchMm * 1.03, 0)} a ${round(flight.vpPropeller.maxPitchMm * 1.05, 0)} mm`,
          ),
        ),
      );
    }

    return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['motor', 'trimado', 'paso minimo VP'], missingData);
  }

  if (rpmAnalysis.rpmTrend === 'sudden_drop') {
    const matchesVpTransition = transitionMatchesDrop(flight);
    const warning =
      hasVp && flight.vpMechanismMode === 'unknown'
        ? 'No modificar resorte hasta registrar el sentido del mecanismo VP.'
        : undefined;
    const dropTooEarly = flight.vpTransitionTimeSec !== undefined && flight.vpTransitionTimeSec < flight.durationSec * 0.35;
    const primaryAction = hasVp
      ? action(
          'transicion VP',
          dropTooEarly ? 'Retrasar la transicion VP; no tocar resorte sin mecanismo conocido.' : 'Revisar transicion VP antes de modificar motor.',
          flight.vpMechanismMode === 'known' ? getAdjustmentMagnitude('small', 'spring') : 'registrar mecanismo VP',
          warning,
        )
      : action(
          'motor o friccion',
          'Revisar motor demasiado corto/grueso y friccion por caida brusca de RPM.',
          'inspeccion mecanica y comparar con motor baseline',
        );
    hypotheses.push(
      hypothesis(
        'rpm-sudden-drop',
        hasVp ? 'variable_pitch' : 'friction',
        matchesVpTransition ? 'Caida brusca asociada a transicion VP' : 'Caida brusca de RPM',
        [
          ...rpmAnalysis.evidence,
          matchesVpTransition ? 'la caida coincide con transicion VP' : 'no hay coincidencia VP confirmada',
        ],
        matchesVpTransition ? 'high' : 'medium',
        primaryAction,
      ),
    );
    return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['trimado', 'paso minimo', 'vueltas'], missingData, warning);
  }

  if (highRemaining && !touchedCeiling && useOfCeiling < 0.6 && stableFlight) {
    if (rpmBand === 'low') {
      const evidence = [`remanente ${pct(remainingPct)}`, `uso de techo ${pct(useOfCeiling)}`, 'RPM final baja', ...rpmAnalysis.evidence];
      if (hasVp && flight.vpPropeller.minPitchMm !== undefined) {
        const primaryAction = action(
          'paso minimo VP',
          'Disminuir paso minimo para recuperar rpm y aprovechar energia remanente.',
          `-3% a -5%: ${round(flight.vpPropeller.minPitchMm * 0.97, 0)} a ${round(flight.vpPropeller.minPitchMm * 0.95, 0)} mm`,
        );
        hypotheses.push(hypothesis('high-rem-slow-rpm-min-pitch', 'variable_pitch', 'Paso minimo demasiado alto', evidence, 'high', primaryAction));
        hypotheses.push(hypothesis('high-rem-slow-rpm-friction', 'friction', 'Friccion elevada en transmision o helice', ['rpm lenta con vueltas remanentes', 'sin techo'], 'medium', action('friccion', 'Inspeccionar eje, gancho, bujes y libre giro.', 'inspeccion mecanica sin cambiar motor')));
        return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['motor', 'trimado', 'paso maximo VP'], missingData);
      }

      const primaryAction = action('paso minimo VP', 'Medir paso minimo antes de cambiar motor.', 'registrar minPitchMm en el proximo vuelo');
      hypotheses.push(hypothesis('high-rem-slow-rpm-missing-min-pitch', 'insufficient_data', 'Falta paso minimo para decidir ajuste VP', evidence, 'medium', primaryAction));
      hypotheses.push(hypothesis('high-rem-slow-rpm-friction', 'friction', 'Friccion elevada posible', ['rpm lenta', 'energia remanente alta'], 'medium', action('friccion', 'Inspeccionar friccion.', 'inspeccion mecanica')));
      return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['motor', 'trimado'], missingData);
    }

    if (rpmBand === 'high') {
      const minPitch = flight.vpPropeller.minPitchMm;
      const primaryAction = action(
        'paso minimo VP',
        'Aumentar paso minimo para cargar la helice y convertir rpm en traccion util.',
        minPitch !== undefined ? `+2% a +4%: ${round(minPitch * 1.02, 0)} a ${round(minPitch * 1.04, 0)} mm` : '+2% a +4%; medir minPitchMm para cuantificar',
      );
      hypotheses.push(
        hypothesis(
          'high-rem-fast-rpm-min-pitch',
          'variable_pitch',
          'Paso minimo demasiado bajo o helice descargada',
          [`remanente ${pct(remainingPct)}`, 'RPM final alta', `uso de techo ${pct(useOfCeiling)}`, ...rpmAnalysis.evidence],
          minPitch !== undefined ? 'high' : 'medium',
          primaryAction,
        ),
      );
      return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['motor', 'trimado', 'paso maximo VP'], missingData);
    }

    if (rpmBand === 'normal' || rpmBand === 'unknown') {
      const confidence = rpmBand === 'unknown' ? 'low' : 'medium';
      const newLoop = motor ? round(motor.loopLengthMm * 0.96, 0) : undefined;
      const density = motor && newLoop ? round(motor.weightG / newLoop, 4) : undefined;
      const primaryAction = action(
        'longitud de motor',
        'Acortar loop manteniendo la masa del motor para aumentar densidad lineal.',
        motor && newLoop && density
          ? `loop ${motor.loopLengthMm} -> ${newLoop} mm (-4%); masa ${motor.weightG} g; densidad ${density} g/mm`
          : 'acortar loop 3% a 5% manteniendo masa; cargar datos de motor para calcular densidad',
      );
      hypotheses.push(
        hypothesis(
          'high-rem-normal-rpm-motor-long',
          'motor',
          'Motor demasiado largo o fino para convertir energia final',
          [`remanente ${pct(remainingPct)}`, `RPM ${rpmBand}`, 'vuelo estable', 'sin techo', ...rpmAnalysis.evidence],
          confidence,
          primaryAction,
        ),
      );
      return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['helice', 'trimado', 'back-off'], missingData);
    }
  }

  if (rpmBand === 'high' && flight.descentStartSec !== undefined && stableFlight) {
    const minPitch = flight.vpPropeller.minPitchMm;
    const primaryAction = action(
      'paso minimo VP',
      'Aumentar paso minimo para que la RPM final produzca empuje util.',
      minPitch !== undefined ? `+2% a +4%: ${round(minPitch * 1.02, 0)} a ${round(minPitch * 1.04, 0)} mm` : '+2% a +4%; medir minPitchMm',
    );
    hypotheses.push(
      hypothesis(
        'high-final-rpm-descending',
        hasVp ? 'variable_pitch' : 'propeller',
        'RPM final alta pero el modelo desciende',
        [...rpmAnalysis.evidence, `inicio de caida ${flight.descentStartSec}s`, 'vuelo estable'],
        'medium',
        primaryAction,
      ),
    );
    return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['motor', 'trimado', 'back-off'], missingData);
  }

  if (highRemaining && earlyDescent) {
    const warning =
      hasVp && flight.vpMechanismMode === 'unknown'
        ? 'No modificar resorte hasta registrar el sentido del mecanismo VP.'
        : undefined;
    const primaryAction =
      hasVp && flight.vpPropeller.minPitchMm !== undefined
        ? action(
            'paso minimo VP',
            'Ajustar paso minimo antes que resorte para mejorar fase media/final.',
            getAdjustmentMagnitude(severity, 'percent'),
            warning,
          )
        : action(
            'transicion VP',
            flight.vpTransitionObserved === 'late'
              ? 'Facilitar transicion a paso bajo, sin tocar resorte si el mecanismo no esta registrado.'
              : 'Registrar transicion VP antes de modificar resorte.',
            flight.vpMechanismMode === 'known' ? getAdjustmentMagnitude('small', 'spring') : 'registrar mecanismo VP',
            warning,
          );

    hypotheses.push(
      hypothesis(
        'high-rem-early-descent-mid-final',
        hasVp ? 'variable_pitch' : 'propeller',
        'Energia remanente alta con caida temprana: problema de fase media/final',
        [`remanente ${pct(remainingPct)}`, `inicio de caida ${flight.descentStartSec}s`, `duracion ${flight.durationSec}s`],
        'medium',
        primaryAction,
      ),
    );
    return buildEvaluation(symptomSummary, hypotheses, primaryAction, ['motor', 'trimado', 'vueltas cargadas'], missingData, warning);
  }

  const primaryAction = action(
    'baseline',
    'Repetir el vuelo base para confirmar repetibilidad antes de optimizar.',
    'sin cambios',
  );
  hypotheses.push(
    hypothesis(
      'near-optimal-repeat-baseline',
      'insufficient_data',
      'No hay un desvio dominante con las reglas actuales',
      [`remanente ${pct(remainingPct)}`, `uso de techo ${pct(useOfCeiling)}`, `estabilidad ${flight.stability}`],
      veryHighRemaining ? 'medium' : 'high',
      primaryAction,
    ),
  );

  return buildEvaluation(symptomSummary, hypotheses, primaryAction, keepBase, missingData);
}

function buildEvaluation(
  symptomSummary: string,
  hypotheses: FlightHypothesis[],
  primaryAction: RecommendationAction,
  keepConstant: string[],
  missingData: string[],
  warning?: string,
): FlightHypothesisEvaluation {
  const primary = choosePrimary(hypotheses);
  return {
    symptomSummary,
    primaryProblemFamily: primary?.family ?? 'insufficient_data',
    hypotheses,
    recommendedAction: primaryAction.action,
    exactAdjustment: primaryAction.exactAdjustment,
    keepConstant,
    missingData: [...new Set(missingData)],
    warning: warning ?? primaryAction.warning,
  };
}
