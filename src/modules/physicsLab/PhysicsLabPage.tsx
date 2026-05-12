import type * as React from 'react';
import { useState, useCallback } from 'react';
import type { AppData } from '../../domain/types';
import type { PhysicsLabInput, PhysicsLabRecommendation, PhysicsLabResult } from './core/types';
import { analyzePhysicsLab } from './index';
import { adaptFlightToPhysicsInput, listFlightOptions } from './adapters/fromExistingData';
import { loadPhysicsLabInput, savePhysicsLabInput, clearPhysicsLabInput } from './data/physicsLabStorage';
import { sampleF1MFlight } from './data/samplePhysicsData';
import { PhysicsInputPanel } from './components/PhysicsInputPanel';
import { PhysicsResultsPanel } from './components/PhysicsResultsPanel';
import { PhysicalEvidencePanel } from './components/PhysicalEvidencePanel';
import { RecommendationCard } from './components/RecommendationCard';
import './physicsLab.css';

const EMPTY_INPUT: PhysicsLabInput = {};

export function PhysicsLabPage({ appData }: { appData?: AppData }) {
  const [input, setInput] = useState<PhysicsLabInput>(
    () => loadPhysicsLabInput() ?? EMPTY_INPUT,
  );
  const [result, setResult] = useState<PhysicsLabResult | null>(null);
  const [recommendations, setRecommendations] = useState<PhysicsLabRecommendation[]>([]);
  const [selectedFlightId, setSelectedFlightId] = useState<string>('');

  const handleChange = useCallback((v: PhysicsLabInput) => {
    setInput(v);
    savePhysicsLabInput(v);
    setResult(null);
    setRecommendations([]);
  }, []);

  const handleAnalyze = () => {
    const { result: r, recommendations: recs } = analyzePhysicsLab(input);
    setResult(r);
    setRecommendations(recs);
  };

  const handleLoadSample = () => {
    handleChange(sampleF1MFlight);
  };

  const handleLoadFlight = () => {
    if (!selectedFlightId || !appData) return;
    const adapted = adaptFlightToPhysicsInput(selectedFlightId, appData);
    if (adapted) handleChange(adapted);
  };

  const handleClear = () => {
    clearPhysicsLabInput();
    setInput(EMPTY_INPUT);
    setResult(null);
    setRecommendations([]);
    setSelectedFlightId('');
  };

  const flightOptions = appData ? listFlightOptions(appData) : [];
  const torqueUnitBlocked = !input.motor?.launchTorqueUnit
    || input.motor.launchTorqueUnit === 'unknown';

  return (
    <div className="pl-page">
      <h2>Laboratorio Físico</h2>
      <p className="pl-subtitle">
        Módulo experimental · Solo lectura · No modifica vuelos, sesiones ni configuraciones existentes
      </p>

      <div className="pl-toolbar">
        <button type="button" className="primary" onClick={handleAnalyze}>
          Analizar
        </button>
        <button type="button" onClick={handleLoadSample}>
          Cargar ejemplo F1M
        </button>
        <button type="button" onClick={handleClear}>
          Limpiar
        </button>
      </div>

      {flightOptions.length > 0 && (
        <div className="pl-flight-selector">
          <label>Cargar desde vuelo existente:</label>
          <select
            value={selectedFlightId}
            onChange={(e) => setSelectedFlightId(e.target.value)}
          >
            <option value="">— seleccionar —</option>
            {flightOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <button type="button" onClick={handleLoadFlight} disabled={!selectedFlightId}>
            Cargar
          </button>
        </div>
      )}

      <div className="pl-layout">
        <PhysicsInputPanel value={input} onChange={handleChange} />

        <div>
          {result ? (
            <>
              <PhysicsResultsPanel result={result} torqueUnitBlocked={torqueUnitBlocked} />
              <PhysicalEvidencePanel result={result} />
              {recommendations.length > 0 && (
                <div>
                  <h3 style={{ marginTop: '1rem', fontSize: '0.95rem', fontWeight: 600 }}>
                    Recomendaciones
                  </h3>
                  <div className="pl-recommendations">
                    {recommendations.map((rec, i) => (
                      <RecommendationCard key={`${rec.targetVariable}-${i}`} rec={rec} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--color-text-muted, #888)', fontSize: '0.85rem' }}>
              Completá los campos y presioná <strong>Analizar</strong> para ver resultados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
