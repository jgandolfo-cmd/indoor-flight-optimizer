import type * as React from 'react';
import type { PhysicsLabResult } from '../core/types';
import { AssumptionsList } from './AssumptionsList';
import { MissingDataList } from './MissingDataList';

export function PhysicalEvidencePanel({ result }: { result: PhysicsLabResult }) {
  return (
    <div className="pl-evidence">
      <h3>Transparencia del análisis</h3>
      <MissingDataList items={result.missingData} />
      <AssumptionsList items={result.assumptions} />
    </div>
  );
}
