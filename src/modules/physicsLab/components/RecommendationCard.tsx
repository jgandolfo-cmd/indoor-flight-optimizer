import type * as React from 'react';
import type { PhysicsLabRecommendation } from '../core/types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { DoNotTouchList } from './DoNotTouchList';
import { MissingDataList } from './MissingDataList';

const RISK_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: 'Riesgo bajo',
  medium: 'Riesgo medio',
  high: 'Riesgo alto',
};

export function RecommendationCard({ rec }: { rec: PhysicsLabRecommendation }) {
  return (
    <div className={`pl-rec-card ${rec.blocked ? 'pl-rec-card--blocked' : ''}`}>
      <div className="pl-rec-card__header">
        <strong>{rec.title}</strong>
        <span className="pl-rec-conf-label">Confianza operativa:</span>
        <ConfidenceBadge level={rec.confidence} />
        <span className={`pl-risk pl-risk--${rec.riskLevel}`}>{RISK_LABELS[rec.riskLevel]}</span>
      </div>

      {rec.blocked && rec.blockReason && (
        <div className="pl-rec-blocked">
          <strong>Bloqueada:</strong> {rec.blockReason}
        </div>
      )}

      {!rec.blocked && (
        <p className="pl-rec-card__text">{rec.recommendation}</p>
      )}

      {rec.operationalNote && (
        <p className="pl-rec-operational-note">{rec.operationalNote}</p>
      )}

      {rec.magnitude && (
        <div className="pl-rec-magnitude">
          <span>Magnitud sugerida:</span> <code>{rec.magnitude}</code>
        </div>
      )}

      {rec.rationale.length > 0 && (
        <div className="pl-section">
          <h4>Fundamento</h4>
          <ul>{rec.rationale.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      {rec.evidenceUsed.length > 0 && (
        <div className="pl-section">
          <h4>Evidencia usada</h4>
          <ul>{rec.evidenceUsed.map((e) => <li key={e}><code>{e}</code></li>)}</ul>
        </div>
      )}

      {rec.assumptionsUsed.length > 0 && (
        <div className="pl-section pl-section--assumptions">
          <h4>Supuestos aplicados</h4>
          <ul>{rec.assumptionsUsed.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      <MissingDataList items={rec.missingData} />
      <DoNotTouchList items={rec.doNotTouch} />
    </div>
  );
}
