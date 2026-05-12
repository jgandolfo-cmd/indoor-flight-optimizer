import type { AppData } from '../../../domain/types';
import type { PhysicsLabInput } from '../core/types';

export function adaptFlightToPhysicsInput(
  flightId: string,
  data: AppData,
): PhysicsLabInput | undefined {
  const flight = data.flights.find((f) => f.id === flightId);
  if (!flight) return undefined;

  const model = data.models.find((m) => m.id === flight.modelId);
  const motor = data.motors.find((m) => m.id === flight.motorId);
  const propeller = data.propellers.find((p) => p.id === flight.propellerId);

  return {
    model: model
      ? {
          id: model.id,
          name: model.name,
          weightG: model.weightG,
          wingspanMm: model.wingspanMm,
          wingAreaDm2: model.wingAreaDm2,
        }
      : undefined,

    motor: motor
      ? {
          id: motor.id,
          name: motor.name,
          rubberMassG: motor.weightG,
          loopLengthMm: motor.loopLengthMm,
          strandCount: motor.strands,
          turnsLoaded: flight.turnsLoaded,
          backoffTurns: flight.backOff,
          remainingTurns: flight.remainingTurns,
          launchTorque: flight.launchTorque,
          launchTorqueUnit: 'unknown',
        }
      : {
          turnsLoaded: flight.turnsLoaded,
          backoffTurns: flight.backOff,
          remainingTurns: flight.remainingTurns,
          launchTorque: flight.launchTorque,
          launchTorqueUnit: 'unknown',
        },

    propeller: propeller
      ? {
          id: propeller.id,
          name: propeller.name,
          diameterMm: propeller.diameterMm,
          propType: propeller.type === 'variable_pitch' ? 'variable_pitch' : 'fixed',
          minPitchMm: flight.vpPropeller?.minPitchMm ?? propeller.minPitchMm,
          maxPitchMm: flight.vpPropeller?.maxPitchMm ?? propeller.maxPitchMm,
          springHardness: flight.vpPropeller?.springHardness ?? propeller.springHardness,
        }
      : undefined,

    flight: {
      durationSec: flight.durationSec,
      maxAltitudeM: flight.maxAltitudeM,
      timeToMaxAltitudeSec: flight.timeToCeilingSec,
      touchedCeiling: flight.touchedCeiling ? 'hard' : 'no',
      rpmInitial: flight.rpmInitial,
      rpmMid: flight.rpmMid,
      rpmFinal: flight.rpmFinal,
      stability: flight.stability,
      notes: flight.notes,
    },
  };
}

export function listFlightOptions(data: AppData): Array<{ id: string; label: string }> {
  return data.flights
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((f) => {
      const model = data.models.find((m) => m.id === f.modelId);
      const dateStr = f.date.slice(0, 10);
      return {
        id: f.id,
        label: `${dateStr} — ${model?.name ?? 'Modelo desconocido'} — ${f.durationSec}s`,
      };
    });
}
