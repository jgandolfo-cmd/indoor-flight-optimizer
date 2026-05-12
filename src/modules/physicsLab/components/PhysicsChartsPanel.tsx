import type * as React from 'react';
import type { PhysicsLabInput, PhysicsLabResult } from '../core/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function pct(n: number) { return `${Math.round(n * 100)}%`; }
function mw(w: number) { return `${Math.round(w * 1000)} mW`; }

// ── RPM chart (SVG line) ──────────────────────────────────────────────────────

function RpmChart({ flight }: { flight: PhysicsLabInput['flight'] }) {
  const r0 = flight?.rpmInitial;
  const rM = flight?.rpmMid;
  const rF = flight?.rpmFinal;

  if (!r0 || !rF) {
    return (
      <div className="physics-chart-card">
        <p className="physics-chart-title">RPM del vuelo</p>
        <p className="physics-chart-caption">No hay datos RPM suficientes para graficar.</p>
      </div>
    );
  }

  const points = rM !== undefined
    ? [{ label: 'Inicio', rpm: r0 }, { label: 'Medio', rpm: rM }, { label: 'Final', rpm: rF }]
    : [{ label: 'Inicio', rpm: r0 }, { label: 'Final', rpm: rF }];

  const maxRpm = Math.max(...points.map((p) => p.rpm));
  const W = 280;
  const H = 100;
  const PAD = 20;
  const chartW = W - PAD * 2;
  const chartH = H - PAD * 2;

  const coords = points.map((p, i) => {
    const x = PAD + (i / (points.length - 1)) * chartW;
    const y = PAD + (1 - p.rpm / maxRpm) * chartH;
    return { x, y, ...p };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  const dropRatio = (r0 - rF) / r0;
  let interpretation: string;
  if (dropRatio > 0.45) {
    interpretation = 'Caída de RPM alta: la hélice absorbe bastante carga.';
  } else if (dropRatio < 0.2) {
    interpretation = 'RPM final alta: posible hélice descargada si hay remanente alto.';
  } else {
    interpretation = 'RPM final baja: posible hélice cargada o fricción si hay remanente alto.';
  }

  return (
    <div className="physics-chart-card">
      <p className="physics-chart-title">RPM del vuelo</p>
      <svg className="physics-rpm-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" />
        {coords.map((c) => (
          <g key={c.label}>
            <circle cx={c.x} cy={c.y} r={4} fill="#6366f1" />
            <text x={c.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{c.label}</text>
            <text x={c.x} y={c.y - 7} textAnchor="middle" fontSize="9" fill="#374151">{Math.round(c.rpm)}</text>
          </g>
        ))}
      </svg>
      <p className="physics-chart-caption">{interpretation}</p>
    </div>
  );
}

// ── Power bar chart ───────────────────────────────────────────────────────────

function PowerChart({ result, torqueUnitBlocked }: {
  result: PhysicsLabResult;
  torqueUnitBlocked: boolean;
}) {
  if (torqueUnitBlocked) {
    return (
      <div className="physics-chart-card">
        <p className="physics-chart-title">Potencia</p>
        <p className="physics-chart-caption">
          No se grafica potencia porque la unidad de torque no está verificada.
        </p>
      </div>
    );
  }

  const bars = [
    { label: 'Inicial', value: result.initialPower?.value, color: '#6366f1' },
    { label: 'Media (est.)', value: result.averagePower?.value, color: '#a5b4fc' },
    { label: 'Requerida', value: result.requiredPower?.value, color: '#34d399' },
  ].filter((b): b is { label: string; value: number; color: string } => b.value !== undefined);

  if (bars.length === 0) {
    return (
      <div className="physics-chart-card">
        <p className="physics-chart-title">Potencia</p>
        <p className="physics-chart-caption">No hay datos de potencia calculados.</p>
      </div>
    );
  }

  const maxMw = Math.max(...bars.map((b) => b.value * 1000), 1);

  return (
    <div className="physics-chart-card">
      <p className="physics-chart-title">Potencia</p>
      <div className="physics-bar-chart">
        {bars.map((b) => {
          const widthPct = (b.value * 1000 / maxMw) * 100;
          return (
            <div key={b.label} className="physics-bar-row">
              <span className="physics-bar-label">{b.label}</span>
              <div className="physics-bar-track">
                <div
                  className="physics-bar-fill"
                  style={{ width: `${widthPct}%`, background: b.color }}
                />
              </div>
              <span className="physics-bar-value">{mw(b.value)}</span>
            </div>
          );
        })}
      </div>
      <p className="physics-chart-caption">
        La potencia requerida es una aproximación mínima porque no incluye resistencia aerodinámica.
      </p>
    </div>
  );
}

// ── Energy stacked bar ────────────────────────────────────────────────────────

function EnergyChart({ result }: { result: PhysicsLabResult }) {
  const ratio = result.energyUseRatio?.value;

  if (ratio === undefined) {
    return (
      <div className="physics-chart-card">
        <p className="physics-chart-title">Uso energético estimado</p>
        <p className="physics-chart-caption">
          Faltan vueltas cargadas, back-off o remanentes para estimar uso energético.
        </p>
      </div>
    );
  }

  const usedPct = Math.round(ratio * 100);
  const remainPct = 100 - usedPct;

  return (
    <div className="physics-chart-card">
      <p className="physics-chart-title">Uso energético estimado</p>
      <div className="physics-stacked-bar">
        <div
          className="physics-stacked-segment physics-stacked-used"
          style={{ width: `${usedPct}%` }}
          title={`Usado: ${usedPct}%`}
        >
          {usedPct > 15 ? `${usedPct}%` : ''}
        </div>
        <div
          className="physics-stacked-segment physics-stacked-remaining"
          style={{ width: `${remainPct}%` }}
          title={`Remanente: ${remainPct}%`}
        >
          {remainPct > 10 ? `${remainPct}%` : ''}
        </div>
      </div>
      <div className="physics-stacked-legend">
        <span className="physics-legend-used">Usado {usedPct}%</span>
        <span className="physics-legend-remaining">Remanente {remainPct}%</span>
      </div>
      {result.remainingTurnsRatio && (
        <p className="physics-chart-sub">
          Remanente de vueltas: {(result.remainingTurnsRatio.value * 100).toFixed(1)}%
        </p>
      )}
      <p className="physics-chart-caption">
        Este cálculo es estimado si no hay curva torque-vueltas medida.
      </p>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function PhysicsChartsPanel({ input, result, torqueUnitBlocked }: {
  input: PhysicsLabInput;
  result: PhysicsLabResult;
  torqueUnitBlocked: boolean;
}) {
  return (
    <div className="pl-charts-grid">
      <RpmChart flight={input.flight} />
      <PowerChart result={result} torqueUnitBlocked={torqueUnitBlocked} />
      <EnergyChart result={result} />
    </div>
  );
}
