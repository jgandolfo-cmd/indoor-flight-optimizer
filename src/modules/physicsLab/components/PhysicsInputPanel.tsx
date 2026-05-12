import type * as React from 'react';
import { useState } from 'react';
import type { PhysicsLabInput } from '../core/types';

type Props = {
  value: PhysicsLabInput;
  onChange: (v: PhysicsLabInput) => void;
};

function num(s: string): number | undefined {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

export function PhysicsInputPanel({ value, onChange }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    model: true,
    motor: true,
    propeller: true,
    flight: true,
  });

  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const set = <K extends keyof PhysicsLabInput>(
    key: K,
    subKey: string,
    raw: string,
  ) => {
    const n = num(raw);
    onChange({
      ...value,
      [key]: { ...(value[key] as object), [subKey]: n },
    });
  };

  const setStr = <K extends keyof PhysicsLabInput>(
    key: K,
    subKey: string,
    v: string,
  ) => {
    onChange({
      ...value,
      [key]: { ...(value[key] as object), [subKey]: v || undefined },
    });
  };

  return (
    <div className="pl-input-panel">

      <div className="pl-input-row">
        <label>Categoría</label>
        <select
          value={value.category ?? ''}
          onChange={(e) => onChange({ ...value, category: (e.target.value || undefined) as PhysicsLabInput['category'] })}
        >
          <option value="">Sin especificar</option>
          <option value="F1M">F1M</option>
          <option value="F1L">F1L</option>
          <option value="EZB">EZB</option>
          <option value="P25">P25</option>
        </select>
      </div>

      <section className="pl-section-group">
        <button type="button" className="pl-section-toggle" onClick={() => toggle('venue')}>
          Salón {open['venue'] ? '▲' : '▼'}
        </button>
        {open['venue'] && (
          <div className="pl-input-grid">
            <div className="pl-input-row">
              <label>Nombre del salón</label>
              <input type="text" value={value.venue?.name ?? ''} onChange={(e) => setStr('venue', 'name', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Altura útil (m)</label>
              <input type="number" step="0.1" value={value.venue?.ceilingHeightM ?? ''} onChange={(e) => set('venue', 'ceilingHeightM', e.target.value)} />
            </div>
          </div>
        )}
      </section>

      <section className="pl-section-group">
        <button type="button" className="pl-section-toggle" onClick={() => toggle('model')}>
          Modelo {open['model'] ? '▲' : '▼'}
        </button>
        {open['model'] && (
          <div className="pl-input-grid">
            <div className="pl-input-row">
              <label>Nombre</label>
              <input type="text" value={value.model?.name ?? ''} onChange={(e) => setStr('model', 'name', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Peso (g)</label>
              <input type="number" value={value.model?.weightG ?? ''} onChange={(e) => set('model', 'weightG', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Envergadura (mm)</label>
              <input type="number" value={value.model?.wingspanMm ?? ''} onChange={(e) => set('model', 'wingspanMm', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Área alar (dm²)</label>
              <input type="number" value={value.model?.wingAreaDm2 ?? ''} onChange={(e) => set('model', 'wingAreaDm2', e.target.value)} />
            </div>
          </div>
        )}
      </section>

      <section className="pl-section-group">
        <button type="button" className="pl-section-toggle" onClick={() => toggle('motor')}>
          Motor / Goma {open['motor'] ? '▲' : '▼'}
        </button>
        {open['motor'] && (
          <div className="pl-input-grid">
            <div className="pl-input-row">
              <label>Nombre</label>
              <input type="text" value={value.motor?.name ?? ''} onChange={(e) => setStr('motor', 'name', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Masa goma (g)</label>
              <input type="number" step="0.0001" value={value.motor?.rubberMassG ?? ''} onChange={(e) => set('motor', 'rubberMassG', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Densidad lineal (g/m)</label>
              <input type="number" step="0.01" value={value.motor?.linearDensityGPerM ?? ''} onChange={(e) => set('motor', 'linearDensityGPerM', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Loop (mm)</label>
              <input type="number" value={value.motor?.loopLengthMm ?? ''} onChange={(e) => set('motor', 'loopLengthMm', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Hebras</label>
              <input type="number" value={value.motor?.strandCount ?? ''} onChange={(e) => set('motor', 'strandCount', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Vueltas cargadas</label>
              <input type="number" value={value.motor?.turnsLoaded ?? ''} onChange={(e) => set('motor', 'turnsLoaded', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Back-off</label>
              <input type="number" value={value.motor?.backoffTurns ?? ''} onChange={(e) => set('motor', 'backoffTurns', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Vueltas remanentes</label>
              <input type="number" value={value.motor?.remainingTurns ?? ''} onChange={(e) => set('motor', 'remainingTurns', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Torque lanzamiento</label>
              <input type="number" step="0.001" value={value.motor?.launchTorque ?? ''} onChange={(e) => set('motor', 'launchTorque', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Unidad torque</label>
              <select
                value={value.motor?.launchTorqueUnit ?? 'lbIn'}
                onChange={(e) => setStr('motor', 'launchTorqueUnit', e.target.value)}
              >
                <option value="lbIn">lb·in (libra-pulgada)</option>
                <option value="inLb">in·lb (ídem lb·in)</option>
                <option value="lbfIn">lbf·in (ídem lb·in)</option>
                <option value="mNm">mN·m</option>
                <option value="Nmm">N·mm</option>
                <option value="gcm">g·cm</option>
                <option value="ozin">oz·in</option>
                <option value="unknown">Desconocida (bloquea cálculo)</option>
              </select>
            </div>
            <div className="pl-input-row pl-input-row--full">
              <p className="pl-unit-note">
                Usar <strong>lb·in</strong> o <strong>in·lb</strong> para torque en libra-pulgada.
                <strong> lb/in no es torque</strong> (es rigidez lineal) — no se acepta esa notación.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="pl-section-group">
        <button type="button" className="pl-section-toggle" onClick={() => toggle('propeller')}>
          Hélice {open['propeller'] ? '▲' : '▼'}
        </button>
        {open['propeller'] && (
          <div className="pl-input-grid">
            <div className="pl-input-row">
              <label>Nombre</label>
              <input type="text" value={value.propeller?.name ?? ''} onChange={(e) => setStr('propeller', 'name', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Diámetro (mm)</label>
              <input type="number" value={value.propeller?.diameterMm ?? ''} onChange={(e) => set('propeller', 'diameterMm', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Tipo</label>
              <select
                value={value.propeller?.propType ?? ''}
                onChange={(e) => setStr('propeller', 'propType', e.target.value)}
              >
                <option value="">Sin especificar</option>
                <option value="fixed">Paso fijo</option>
                <option value="variable_pitch">Paso variable (VP)</option>
              </select>
            </div>
            {value.propeller?.propType === 'variable_pitch' && (
              <>
                <div className="pl-input-row">
                  <label>Paso mín. (mm)</label>
                  <input type="number" value={value.propeller?.minPitchMm ?? ''} onChange={(e) => set('propeller', 'minPitchMm', e.target.value)} />
                </div>
                <div className="pl-input-row">
                  <label>Paso máx. (mm)</label>
                  <input type="number" value={value.propeller?.maxPitchMm ?? ''} onChange={(e) => set('propeller', 'maxPitchMm', e.target.value)} />
                </div>
                <div className="pl-input-row">
                  <label>Dureza resorte</label>
                  <input type="number" value={value.propeller?.springHardness ?? ''} onChange={(e) => set('propeller', 'springHardness', e.target.value)} />
                </div>
                <div className="pl-input-row">
                  <label>Mecanismo VP</label>
                  <select
                    value={value.propeller?.vpMechanismMode ?? ''}
                    onChange={(e) => setStr('propeller', 'vpMechanismMode', e.target.value)}
                  >
                    <option value="">Sin especificar</option>
                    <option value="torque_opens_to_high_pitch">Torque abre a paso alto</option>
                    <option value="torque_closes_to_low_pitch">Torque cierra a paso bajo</option>
                    <option value="unknown">Desconocido</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="pl-section-group">
        <button type="button" className="pl-section-toggle" onClick={() => toggle('flight')}>
          Vuelo {open['flight'] ? '▲' : '▼'}
        </button>
        {open['flight'] && (
          <div className="pl-input-grid">
            <div className="pl-input-row">
              <label>Duración (s)</label>
              <input type="number" value={value.flight?.durationSec ?? ''} onChange={(e) => set('flight', 'durationSec', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Alt. máxima (m)</label>
              <input type="number" step="0.1" value={value.flight?.maxAltitudeM ?? ''} onChange={(e) => set('flight', 'maxAltitudeM', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Tiempo hasta alt. máx. (s)</label>
              <input type="number" value={value.flight?.timeToMaxAltitudeSec ?? ''} onChange={(e) => set('flight', 'timeToMaxAltitudeSec', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Toca techo</label>
              <select
                value={String(value.flight?.touchedCeiling ?? 'no')}
                onChange={(e) => setStr('flight', 'touchedCeiling', e.target.value)}
              >
                <option value="no">No</option>
                <option value="light">Leve</option>
                <option value="hard">Fuerte</option>
              </select>
            </div>
            <div className="pl-input-row">
              <label>RPM inicial</label>
              <input type="number" value={value.flight?.rpmInitial ?? ''} onChange={(e) => set('flight', 'rpmInitial', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>RPM media</label>
              <input type="number" value={value.flight?.rpmMid ?? ''} onChange={(e) => set('flight', 'rpmMid', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>RPM final</label>
              <input type="number" value={value.flight?.rpmFinal ?? ''} onChange={(e) => set('flight', 'rpmFinal', e.target.value)} />
            </div>
            <div className="pl-input-row">
              <label>Estabilidad</label>
              <select
                value={value.flight?.stability ?? ''}
                onChange={(e) => setStr('flight', 'stability', e.target.value)}
              >
                <option value="">Sin especificar</option>
                <option value="stable">Estable</option>
                <option value="oscillating">Oscilante</option>
                <option value="stalling">Pérdida</option>
                <option value="diving">Cabeceo</option>
              </select>
            </div>
            <div className="pl-input-row pl-input-row--full">
              <label>Notas</label>
              <textarea
                rows={2}
                value={value.flight?.notes ?? ''}
                onChange={(e) => setStr('flight', 'notes', e.target.value)}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
