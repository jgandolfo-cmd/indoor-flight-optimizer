import type * as React from 'react';
import type { ConfidenceLevel } from '../core/types';

const LABELS: Record<ConfidenceLevel, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span className={`pl-confidence pl-confidence--${level}`}>
      {LABELS[level]}
    </span>
  );
}
