import type * as React from 'react';

export function MissingDataList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="pl-section pl-section--missing">
      <h4>Datos faltantes</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
