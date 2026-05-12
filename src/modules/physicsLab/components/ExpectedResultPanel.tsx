import type * as React from 'react';
import type { ExpectedRecommendation, PhysicsLabRecommendation } from '../core/types';

type ValidationStatus = 'coincide' | 'coincide parcialmente' | 'no coincide';

function validate(
  expected: ExpectedRecommendation,
  actual: PhysicsLabRecommendation[],
): {
  status: ValidationStatus;
  matches: string[];
  mismatches: string[];
  unexpected: string[];
  targetVariableMatch: boolean | null;
} {
  const actualTargets = actual.map((r) => r.targetVariable);

  const shouldRec = expected.shouldRecommend ?? [];
  const shouldNot = expected.shouldNotRecommend ?? [];

  const matches = shouldRec.filter((t) => actualTargets.includes(t as never));
  const mismatches = shouldRec.filter((t) => !actualTargets.includes(t as never));
  const unexpected = shouldNot.filter((t) => actualTargets.includes(t as never));

  const targetVariableMatch = expected.expectedTargetVariable
    ? actualTargets[0] === expected.expectedTargetVariable
    : null;

  let status: ValidationStatus;
  if (
    matches.length === shouldRec.length
    && unexpected.length === 0
    && (targetVariableMatch === null || targetVariableMatch)
  ) {
    status = 'coincide';
  } else if (matches.length > 0 || unexpected.length < shouldNot.length) {
    status = 'coincide parcialmente';
  } else {
    status = 'no coincide';
  }

  return { status, matches, mismatches, unexpected, targetVariableMatch };
}

const STATUS_CLASS: Record<ValidationStatus, string> = {
  'coincide': 'pl-validation--ok',
  'coincide parcialmente': 'pl-validation--partial',
  'no coincide': 'pl-validation--fail',
};

export function ExpectedResultPanel({
  expected,
  actual,
}: {
  expected: ExpectedRecommendation;
  actual: PhysicsLabRecommendation[];
}) {
  const { status, matches, mismatches, unexpected, targetVariableMatch } = validate(expected, actual);

  return (
    <div className={`pl-validation ${STATUS_CLASS[status]}`}>
      <div className="pl-validation__header">
        <strong>Validación del caso</strong>
        <span className="pl-validation__status">{status}</span>
      </div>

      {expected.expectedTargetVariable && (
        <div className="pl-validation__row">
          <span>Variable objetivo esperada:</span>
          <code>{expected.expectedTargetVariable}</code>
          <span>{targetVariableMatch === true ? '✓' : targetVariableMatch === false ? '✗' : '—'}</span>
        </div>
      )}

      {matches.length > 0 && (
        <div className="pl-validation__section">
          <span className="pl-validation__label">Presentes (esperados):</span>
          <ul>{matches.map((m) => <li key={m} className="pl-validation__match">✓ {m}</li>)}</ul>
        </div>
      )}

      {mismatches.length > 0 && (
        <div className="pl-validation__section">
          <span className="pl-validation__label">Ausentes (esperados):</span>
          <ul>{mismatches.map((m) => <li key={m} className="pl-validation__mismatch">✗ {m}</li>)}</ul>
        </div>
      )}

      {unexpected.length > 0 && (
        <div className="pl-validation__section">
          <span className="pl-validation__label">Inesperados (no deberían aparecer):</span>
          <ul>{unexpected.map((m) => <li key={m} className="pl-validation__unexpected">⚠ {m}</li>)}</ul>
        </div>
      )}

      <div className="pl-validation__actual">
        <span className="pl-validation__label">Variables en recomendación actual:</span>
        {actual.length > 0
          ? actual.map((r) => <code key={r.targetVariable + r.title}>{r.targetVariable}</code>)
          : <span className="pl-value--missing">ninguna</span>}
      </div>
    </div>
  );
}
