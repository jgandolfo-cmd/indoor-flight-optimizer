import type * as React from 'react';
import type { PhysicsLabResult, PhysicalValue, PropellerLoadClass, RpmCoherenceStatus } from '../core/types';
import { ConfidenceBadge } from './ConfidenceBadge';

const RPM_COHERENCE_LABELS: Record<RpmCoherenceStatus, string> = {
  buena: 'coherencia buena',
  advertencia_leve: 'desvío leve',
  advertencia_alta: 'desvío alto — confianza degradada',
  no_usar: 'no usar RPM media para recomendación fina',
};

const RPM_COHERENCE_CLASS: Record<RpmCoherenceStatus, string> = {
  buena: 'pl-coherence--ok',
  advertencia_leve: 'pl-coherence--warn',
  advertencia_alta: 'pl-coherence--alert',
  no_usar: 'pl-coherence--alert',
};

const LOAD_CLASS_LABELS: Record<Exclude<PropellerLoadClass, 'unknown'>, string> = {
  high_absorption: 'absorción alta',
  normal: 'normal',
  unloaded: 'baja absorción',
};

function ValueRow({ label, pv, blocked, decimals = 4 }: {
  label: string;
  pv?: PhysicalValue<number>;
  blocked?: string;
  decimals?: number;
}) {
  if (blocked) {
    return (
      <tr>
        <td>{label}</td>
        <td className="pl-value--blocked" colSpan={3}>{blocked}</td>
      </tr>
    );
  }
  if (!pv) {
    return (
      <tr>
        <td>{label}</td>
        <td colSpan={3} className="pl-value--missing">—</td>
      </tr>
    );
  }
  return (
    <tr>
      <td>{label}</td>
      <td><strong>{pv.value.toFixed(decimals)}</strong> {pv.unit}</td>
      <td><ConfidenceBadge level={pv.confidence} /></td>
      <td className="pl-value--source">{pv.source ?? pv.notes ?? ''}</td>
    </tr>
  );
}

export function PhysicsResultsPanel({
  result,
  torqueUnitBlocked,
}: {
  result: PhysicsLabResult;
  torqueUnitBlocked?: boolean;
}) {
  return (
    <div className="pl-results">
      <h3>Resultados físicos</h3>

      <div className="pl-confidence-overall">
        Confianza física global: <ConfidenceBadge level={result.confidence} />
        <span className="pl-confidence-note">
          (calidad del modelo físico, supuestos y datos disponibles)
        </span>
      </div>

      <table className="pl-table">
        <thead>
          <tr>
            <th>Magnitud</th>
            <th>Valor</th>
            <th>Confianza</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          <ValueRow label="Densidad lineal" pv={result.linearDensity} />
          <ValueRow
            label="Potencia inicial"
            pv={result.initialPower}
            blocked={torqueUnitBlocked ? 'Unidad de torque no verificada — no se calcula potencia' : undefined}
          />
          <ValueRow
            label="Potencia media (estimada)"
            pv={result.averagePower}
            blocked={torqueUnitBlocked ? 'Depende de potencia inicial bloqueada' : undefined}
          />
          <ValueRow label="Velocidad vertical media" pv={result.verticalSpeed} />
          <ValueRow label="Potencia requerida aprox." pv={result.requiredPower} />
          <ValueRow label="Remanente de vueltas" pv={result.remainingTurnsRatio} decimals={1} />
          <ValueRow label="Uso energético estimado*" pv={result.energyUseRatio} />
          <ValueRow label="Uso de techo" pv={result.ceilingUse} decimals={1} />
          <ValueRow label="Absorción de hélice (ratio RPM)" pv={result.propellerLoadRatio} />
          <tr><td colSpan={4} className="pl-table-separator">Coherencia de datos</td></tr>
          <ValueRow label="RPM equivalente (vueltas usadas)" pv={result.rpmEquivalent} decimals={1} />
          {result.rpmCoherenceDevioPct !== undefined && (
            <tr>
              <td>Desvío RPM media</td>
              <td>
                <strong>{result.rpmCoherenceDevioPct.toFixed(1)} %</strong>
              </td>
              <td colSpan={2}>
                {result.rpmCoherenceStatus && (
                  <span className={`pl-coherence ${RPM_COHERENCE_CLASS[result.rpmCoherenceStatus]}`}>
                    {RPM_COHERENCE_LABELS[result.rpmCoherenceStatus]}
                  </span>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {result.propellerLoadClass && result.propellerLoadClass !== 'unknown' && (
        <div className={`pl-propload pl-propload--${result.propellerLoadClass}`}>
          Absorción de hélice: <strong>{LOAD_CLASS_LABELS[result.propellerLoadClass]}</strong>
        </div>
      )}

      {result.energyUseRatio && (
        <p className="pl-energy-note">* Uso energético estimado sin curva torque-vueltas real.</p>
      )}

      {result.warnings.length > 0 && (
        <div className="pl-section pl-section--warnings">
          <h4>Advertencias</h4>
          <ul>
            {result.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
