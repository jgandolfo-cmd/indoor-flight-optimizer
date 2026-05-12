import type * as React from 'react';

export function DoNotTouchList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="pl-section pl-section--donottouch">
      <h4>No modificar en el próximo ensayo</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
