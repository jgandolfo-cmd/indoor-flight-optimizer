import type { Flight, RpmProfileAnalysis, RpmSample, RpmTrend } from './types';

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function cleanSamples(samples: RpmSample[] | undefined): RpmSample[] {
  return (samples ?? [])
    .filter((sample) => Number.isFinite(sample.timeSec) && Number.isFinite(sample.rpm) && sample.rpm > 0)
    .sort((a, b) => a.timeSec - b.timeSec);
}

function trendFromDecay(rpmInitial?: number, rpmFinal?: number, samples: RpmSample[] = []): RpmTrend {
  if (!rpmInitial || !rpmFinal) return 'unknown';

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1].rpm;
    const current = samples[index].rpm;
    if (previous > 0 && (previous - current) / previous > 0.25) return 'sudden_drop';
  }

  if (rpmFinal > rpmInitial) return 'rising';

  const rpmDecayPct = (rpmInitial - rpmFinal) / rpmInitial;
  if (rpmDecayPct < 0.05) return 'stable';
  if (rpmDecayPct < 0.15) return 'slow_decay';
  if (rpmDecayPct <= 0.4) return 'slow_decay';
  return 'fast_decay';
}

function interpretationFor(trend: RpmTrend): string {
  if (trend === 'rising') return 'La RPM final supera la inicial; puede haber error de medicion o descarga anomala.';
  if (trend === 'stable') return 'La RPM se mantiene casi constante; si el modelo cae, puede faltar empuje util o carga de helice.';
  if (trend === 'slow_decay') return 'La RPM decae de forma gradual; la energia se esta distribuyendo sin caidas bruscas.';
  if (trend === 'fast_decay') return 'La RPM cae mucho durante el vuelo; puede haber exceso de carga, motor corto/grueso o friccion.';
  if (trend === 'sudden_drop') return 'Hay una caida brusca de RPM; revisar transicion VP, friccion o descarga abrupta del motor.';
  return 'No hay datos suficientes para interpretar la curva de RPM.';
}

export function analyzeRpmProfile(flight: Flight): RpmProfileAnalysis {
  const samples = cleanSamples(flight.rpmSamples);
  const evidence: string[] = [];

  let rpmInitial = flight.rpmInitial;
  let rpmMid = flight.rpmMid;
  let rpmFinal = flight.rpmFinal;

  if (samples.length >= 2) {
    rpmInitial = samples[0].rpm;
    rpmFinal = samples[samples.length - 1].rpm;
    rpmMid = samples[Math.floor(samples.length / 2)].rpm;
    evidence.push(`${samples.length} muestras RPM registradas`);
  } else if (rpmInitial !== undefined || rpmMid !== undefined || rpmFinal !== undefined) {
    evidence.push('RPM inicial/media/final cargadas manualmente');
  }

  if (!rpmInitial || !rpmFinal) {
    return {
      rpmInitial,
      rpmMid,
      rpmFinal,
      rpmTrend: 'unknown',
      interpretation: interpretationFor('unknown'),
      evidence: [...evidence, 'faltan RPM inicial y final'],
    };
  }

  const rpmDecayPct = round((rpmInitial - rpmFinal) / rpmInitial, 3);
  const rpmTrend = flight.rpmTrend && flight.rpmTrend !== 'unknown'
    ? flight.rpmTrend
    : trendFromDecay(rpmInitial, rpmFinal, samples);

  evidence.push(`RPM inicial ${rpmInitial}`);
  if (rpmMid !== undefined) evidence.push(`RPM media ${rpmMid}`);
  evidence.push(`RPM final ${rpmFinal}`);
  evidence.push(`decaimiento ${Math.round(rpmDecayPct * 100)}%`);

  if (rpmTrend === 'sudden_drop' && flight.vpTransitionTimeSec !== undefined) {
    evidence.push(`transicion VP registrada a ${flight.vpTransitionTimeSec}s`);
  }

  return {
    rpmInitial,
    rpmMid,
    rpmFinal,
    rpmDecayPct,
    rpmTrend,
    interpretation: interpretationFor(rpmTrend),
    evidence,
  };
}
