import { calculateFlightMetrics } from './calculations';
import { analyzeRpmProfile } from './rpm';
import type { Diagnosis, Flight, RubberMotor, Venue } from './types';

export function diagnoseFlight(flight: Flight, venue?: Venue, motor?: RubberMotor): Diagnosis {
  const metrics = calculateFlightMetrics(flight, venue, motor);
  const rpm = analyzeRpmProfile(flight);
  const hold = ['modelo', 'salon', 'motor', 'ancho de goma'];
  const reachedCeilingEarly = flight.timeToCeilingSec !== undefined && metrics.timeToCeilingPercent < 25;
  const longCeilingContact = metrics.totalCeilingContactSec >= 8 || metrics.ceilingContactPercent >= 5;
  const hasSecondCeilingEvent = flight.secondClimb || flight.secondCeilingTouch;

  if ((flight.touchedCeiling || flight.secondCeilingTouch) && longCeilingContact) {
    return {
      flightId: flight.id,
      text: 'El modelo golpea o roza el techo durante demasiado tiempo. La configuracion parece pensada para un techo mas alto: sobra empuje inicial o el paso maximo de la VP deja cargar demasiada potencia arriba.',
      probableLimiter: 'Techo sostenido por configuracion VP',
      nextTestRecommendation: 'Reducir vueltas netas o bajar el paso maximo de la helice VP. Si el golpe ocurre con torque alto, probar tambien un resorte apenas mas blando.',
      suggestedVariableToChange: 'paso maximo VP o back-off',
      suggestedVariablesToHold: ['modelo', 'salon', 'motor', 'paso minimo VP', 'trimado lateral'],
    };
  }

  if (rpm.rpmTrend === 'sudden_drop') {
    return {
      flightId: flight.id,
      text: `La curva de RPM muestra una caida brusca. ${rpm.interpretation}`,
      probableLimiter: flight.propType === 'variable_pitch' ? 'Transicion VP o friccion' : 'Friccion o motor demasiado cargado',
      nextTestRecommendation:
        flight.propType === 'variable_pitch'
          ? 'Registrar si la caida coincide con la transicion VP antes de tocar resorte.'
          : 'Revisar friccion y comparar con otro motor baseline.',
      suggestedVariableToChange: flight.vpMechanismMode === 'known' ? 'transicion VP' : 'ninguna hasta registrar mecanismo VP',
      suggestedVariablesToHold: ['motor', 'trimado', 'vueltas cargadas', 'back-off'],
    };
  }

  if (hasSecondCeilingEvent) {
    return {
      flightId: flight.id,
      text: 'La secuencia muestra caida y segunda trepada. El conjunto recupera altura despues de descargarse, como si la transicion de paso/resorte estuviera ajustada para un techo mas bajo o liberara potencia demasiado tarde.',
      probableLimiter: 'Segunda trepada por transicion VP',
      nextTestRecommendation: 'Registrar torque y vueltas al inicio de la caida; luego probar mayor paso minimo o resorte algo mas duro para suavizar la recuperacion.',
      suggestedVariableToChange: 'paso minimo VP o dureza del resorte',
      suggestedVariablesToHold: ['modelo', 'salon', 'motor', 'vueltas cargadas', 'back-off'],
    };
  }

  if ((flight.touchedCeiling || metrics.ceilingUsePercent > 96) && reachedCeilingEarly) {
    return {
      flightId: flight.id,
      text: 'El modelo alcanza el techo demasiado temprano. La energia inicial esta concentrada al comienzo del vuelo.',
      probableLimiter: 'Ascenso inicial demasiado rapido',
      nextTestRecommendation: 'Aumentar back-off o bajar paso maximo VP en un cambio pequeno, manteniendo motor y modelo.',
      suggestedVariableToChange: 'back-off o paso maximo VP',
      suggestedVariablesToHold: hold,
    };
  }

  if (flight.touchedCeiling || metrics.ceilingUsePercent > 96) {
    return {
      flightId: flight.id,
      text: 'El vuelo esta limitado por uso de techo, pero no necesariamente por golpe inicial. Conviene mirar el tiempo hasta techo y el tiempo de contacto para decidir si ajustar vueltas o VP.',
      probableLimiter: 'Margen de techo bajo',
      nextTestRecommendation: 'Repetir con el mismo motor registrando tiempo hasta techo, contacto y torque para aislar la causa.',
      suggestedVariableToChange: 'una variable: back-off o paso maximo VP',
      suggestedVariablesToHold: ['modelo', 'salon', 'motor', 'trimado'],
    };
  }

  if (flight.stability === 'stalling' || flight.climb === 'too_aggressive') {
    return {
      flightId: flight.id,
      text: 'El patron indica exceso de torque inicial o trimado demasiado cabrador.',
      probableLimiter: 'Estabilidad en ascenso',
      nextTestRecommendation: 'Aumentar el back-off en pasos pequenos y observar si desaparecen las colgadas.',
      suggestedVariableToChange: 'back-off',
      suggestedVariablesToHold: hold,
    };
  }

  if (flight.stability === 'diving' || flight.climb === 'low') {
    return {
      flightId: flight.id,
      text: 'El modelo no convierte suficiente energia en altura y tiempo. Puede faltar torque util o sobrar incidencia negativa.',
      probableLimiter: 'Ascenso insuficiente',
      nextTestRecommendation: 'Probar mas vueltas netas manteniendo el mismo motor y revisar que no aumente demasiado la velocidad.',
      suggestedVariableToChange: 'vueltas cargadas',
      suggestedVariablesToHold: hold,
    };
  }

  if (flight.turnPattern === 'irregular' || flight.stability === 'oscillating') {
    return {
      flightId: flight.id,
      text: 'La trayectoria no es repetible. Antes de optimizar energia conviene estabilizar el circulo.',
      probableLimiter: 'Consistencia del patron de giro',
      nextTestRecommendation: 'Ajustar trimado lateral en cambios pequenos hasta lograr circulos regulares.',
      suggestedVariableToChange: 'trim lateral',
      suggestedVariablesToHold: ['vueltas cargadas', 'back-off', 'motor', 'salon'],
    };
  }

  if (metrics.remainingPercent > 20) {
    return {
      flightId: flight.id,
      text: 'El vuelo aterriza con mucha energia remanente. Hay margen para usar mas goma disponible.',
      probableLimiter: 'Energia no utilizada',
      nextTestRecommendation: 'Reducir back-off o aumentar vueltas cargadas en un incremento moderado.',
      suggestedVariableToChange: 'vueltas netas',
      suggestedVariablesToHold: ['modelo', 'salon', 'motor', 'patron de giro'],
    };
  }

  if ((flight.turnsAtDescentStart ?? 0) > 0 && flight.remainingTurns > 0) {
    const turnsLostAfterDescent = flight.turnsAtDescentStart! - flight.remainingTurns;
    if (turnsLostAfterDescent < metrics.netTurns * 0.08 && flight.landing !== 'soft') {
      return {
        flightId: flight.id,
        text: 'La caida empieza con vueltas todavia disponibles, pero no se convierten en sustentacion util. La VP o el trimado pueden estar dejando poca traccion efectiva al final.',
        probableLimiter: 'Energia final poco util',
        nextTestRecommendation: 'Probar un paso minimo apenas menor o revisar torque al inicio de caida antes de cambiar goma.',
        suggestedVariableToChange: 'paso minimo VP',
        suggestedVariablesToHold: ['modelo', 'salon', 'motor', 'vueltas cargadas', 'back-off'],
      };
    }
  }

  if (metrics.remainingPercent < 4 && flight.landing !== 'soft') {
    return {
      flightId: flight.id,
      text: 'El motor llega muy descargado y el aterrizaje no es limpio. El final del vuelo puede estar demasiado justo.',
      probableLimiter: 'Energia final baja',
      nextTestRecommendation: 'Agregar algo de margen con menos back-off solo si hay techo disponible, o usar un motor apenas mas largo.',
      suggestedVariableToChange: 'longitud o vueltas netas',
      suggestedVariablesToHold: ['modelo', 'salon', 'trimado'],
    };
  }

  return {
    flightId: flight.id,
    text: 'Vuelo balanceado para una primera lectura: margen de techo razonable, estabilidad aceptable y energia remanente controlada.',
    probableLimiter: 'Sin limitante dominante',
    nextTestRecommendation: 'Hacer una repeticion con las mismas variables para confirmar reproducibilidad antes de optimizar.',
    suggestedVariableToChange: 'ninguna en el proximo ensayo',
    suggestedVariablesToHold: ['modelo', 'salon', 'motor', 'vueltas cargadas', 'back-off', 'trimado'],
  };
}
