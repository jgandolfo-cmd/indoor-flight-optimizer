import type { AppData, Flight, FlightMetrics, IndoorModel, RubberMotor, Venue } from './types';

export function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportAppDataJson(data: AppData): void {
  downloadTextFile(
    `indoor-flight-optimizer-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(data, null, 2),
    'application/json',
  );
}

const csvEscape = (value: string | number | boolean | undefined): string => {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
};

export function flightsToCsv(
  flights: Flight[],
  metricsByFlight: (flight: Flight) => FlightMetrics,
  findVenue: (id: string) => Venue | undefined,
  findModel: (id: string) => IndoorModel | undefined,
  findMotor: (id: string) => RubberMotor | undefined,
): string {
  const header = [
    'fecha',
    'salon',
    'modelo',
    'motor',
    'vueltas_cargadas',
    'back_off',
    'vueltas_netas',
    'duracion_seg',
    'altura_max_m',
    'toco_techo',
    'tiempo_hasta_techo_seg',
    'contacto_techo_seg',
    'segunda_trepada',
    'segundo_toque_techo',
    'tiempo_segundo_toque_seg',
    'segundo_contacto_techo_seg',
    'contacto_techo_total_seg',
    'tiempo_hasta_techo_pct',
    'contacto_techo_pct',
    'vp_paso_max_mm',
    'vp_paso_min_mm',
    'vp_dureza_resorte',
    'tipo_helice',
    'rpm_visual',
    'rpm_inicial',
    'rpm_media',
    'rpm_final',
    'rpm_tendencia',
    'rpm_muestras',
    'vp_transicion_observada',
    'vp_mecanismo',
    'vp_tiempo_transicion_seg',
    'rpm_antes_transicion_vp',
    'rpm_despues_transicion_vp',
    'torque_lanzamiento',
    'inicio_caida_seg',
    'torque_inicio_caida',
    'vueltas_inicio_caida',
    'vueltas_remanentes',
    'remanente_pct',
    'uso_techo_pct',
    'eficiencia_por_vuelta',
    'eficiencia_por_gramo_goma',
    'giro',
    'ascenso',
    'estabilidad',
    'aterrizaje',
    'notas',
  ];

  const rows = flights.map((flight) => {
    const metrics = metricsByFlight(flight);
    return [
      flight.date,
      findVenue(flight.venueId)?.name,
      findModel(flight.modelId)?.name,
      findMotor(flight.motorId)?.name,
      flight.turnsLoaded,
      flight.backOff,
      metrics.netTurns,
      flight.durationSec,
      flight.maxAltitudeM,
      flight.touchedCeiling,
      flight.timeToCeilingSec,
      flight.ceilingContactDurationSec,
      flight.secondClimb,
      flight.secondCeilingTouch,
      flight.secondCeilingTimeSec,
      flight.secondCeilingContactDurationSec,
      metrics.totalCeilingContactSec,
      metrics.timeToCeilingPercent,
      metrics.ceilingContactPercent,
      flight.vpPropeller?.maxPitchMm,
      flight.vpPropeller?.minPitchMm,
      flight.vpPropeller?.springHardness,
      flight.propType,
      flight.rpmVisual,
      flight.rpmInitial,
      flight.rpmMid,
      flight.rpmFinal,
      flight.rpmTrend,
      flight.rpmSamples?.map((sample) => `${sample.timeSec}:${sample.rpm}:${sample.note ?? ''}`).join('|'),
      flight.vpTransitionObserved,
      flight.vpMechanismMode,
      flight.vpTransitionTimeSec,
      flight.rpmBeforeVpTransition,
      flight.rpmAfterVpTransition,
      flight.launchTorque,
      flight.descentStartSec,
      flight.descentStartTorque,
      flight.turnsAtDescentStart,
      flight.remainingTurns,
      metrics.remainingPercent,
      metrics.ceilingUsePercent,
      metrics.efficiencyPerTurn,
      metrics.efficiencyPerRubberGram,
      flight.turnPattern,
      flight.climb,
      flight.stability,
      flight.landing,
      flight.notes,
    ].map(csvEscape);
  });

  return [header.map(csvEscape), ...rows].map((row) => row.join(',')).join('\n');
}
