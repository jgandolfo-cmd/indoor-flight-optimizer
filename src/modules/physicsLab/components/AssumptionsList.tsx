import type * as React from 'react';

export function AssumptionsList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="pl-section pl-section--assumptions">
      <h4>Supuestos</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
