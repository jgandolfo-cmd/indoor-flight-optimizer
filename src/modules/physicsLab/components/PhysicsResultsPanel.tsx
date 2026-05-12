import type * as React from 'react';
import type { PhysicsLabResult, PhysicalValue, PropellerLoadClass } from '../core/types';
import { ConfidenceBadge } from './ConfidenceBadge';

const LOAD_CLASS_LABELS: Record<Exclude<PropellerLoadClass, 'unknown'>, string> = {
  overloaded: 'alta absorción',
  normal: 'normal',
  unloaded: 'baja absorción',
};

function ValueRow({ label, pv, blocked }: {
  label: string;
  pv?: PhysicalValue<number>;
  blocked?: string;
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
      <td><strong>{pv.value.toFixed(4)}</strong> {pv.unit}</td>
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
          <ValueRow label="Remanente de vueltas" pv={result.remainingTurnsRatio} />
          <ValueRow label="Uso energético estimado*" pv={result.energyUseRatio} />
          <ValueRow label="Ratio carga de hélice" pv={result.propellerLoadRatio} />
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
