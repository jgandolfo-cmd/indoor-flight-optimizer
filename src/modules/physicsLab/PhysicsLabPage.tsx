import type * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import type { AppData } from '../../domain/types';
import type { PhysicsLabInput, PhysicsLabRecommendation, PhysicsLabResult } from './core/types';
import { analyzePhysicsLab } from './index';
import { adaptFlightToPhysicsInput, listFlightOptions } from './adapters/fromExistingData';
import { loadPhysicsLabInput, savePhysicsLabInput, clearPhysicsLabInput, saveToHistory } from './data/physicsLabStorage';
import type { CaseMetadata } from './data/importNormalizer';
import { parsePhysicsLabFile } from './data/importNormalizer';
import { sampleF1MFlight, sampleDanjoF1M } from './data/samplePhysicsData';
import { PhysicsInputPanel } from './components/PhysicsInputPanel';
import { PhysicsResultsPanel } from './components/PhysicsResultsPanel';
import { PhysicalEvidencePanel } from './components/PhysicalEvidencePanel';
import { PhysicsChartsPanel } from './components/PhysicsChartsPanel';
import { RecommendationCard } from './components/RecommendationCard';
import './physicsLab.css';

const EMPTY_INPUT: PhysicsLabInput = {
  motor: { launchTorqueUnit: 'lbIn' },
};

type PendingCase = { input: PhysicsLabInput; metadata: CaseMetadata };

export function PhysicsLabPage({ appData }: { appData?: AppData }) {
  const [input, setInput] = useState<PhysicsLabInput>(
    () => loadPhysicsLabInput() ?? EMPTY_INPUT,
  );
  const [result, setResult] = useState<PhysicsLabResult | null>(null);
  const [recommendations, setRecommendations] = useState<PhysicsLabRecommendation[]>([]);
  const [selectedFlightId, setSelectedFlightId] = useState<string>('');
  const [importedMetadata, setImportedMetadata] = useState<CaseMetadata | undefined>(undefined);
  const [importError, setImportError] = useState<string>('');
  const [pendingCases, setPendingCases] = useState<PendingCase[]>([]);
  const [pendingCaseIdx, setPendingCaseIdx] = useState<number>(0);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((v: PhysicsLabInput) => {
    setInput(v);
    savePhysicsLabInput(v);
    setResult(null);
    setRecommendations([]);
  }, []);

  const loadCase = useCallback((v: PhysicsLabInput, meta?: CaseMetadata) => {
    handleChange(v);
    setImportedMetadata(meta);
    setImportError('');
    setPendingCases([]);
  }, [handleChange]);

  const handleAnalyze = () => {
    const { result: r, recommendations: recs } = analyzePhysicsLab(input);
    setResult(r);
    setRecommendations(recs);
  };

  const handleLoadFlight = () => {
    if (!selectedFlightId || !appData) return;
    const adapted = adaptFlightToPhysicsInput(selectedFlightId, appData);
    if (adapted) {
      loadCase(adapted, undefined);
      setImportedMetadata(undefined);
    }
  };

  const handleClear = () => {
    clearPhysicsLabInput();
    setInput(EMPTY_INPUT);
    setResult(null);
    setRecommendations([]);
    setSelectedFlightId('');
    setImportedMetadata(undefined);
    setImportError('');
    setPendingCases([]);
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!jsonImportRef.current) return;
    jsonImportRef.current.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const normalized = parsePhysicsLabFile(text);

      if (!normalized.ok) {
        setImportError(normalized.error);
        return;
      }

      setImportError('');

      if (normalized.ok === 'multi') {
        // Store cases and let user pick
        setPendingCases(normalized.cases);
        setPendingCaseIdx(0);
        return;
      }

      // Single case
      saveToHistory(normalized.input, normalized.metadata);
      loadCase(normalized.input, normalized.metadata);
    };
    reader.readAsText(file);
  };

  const handleLoadPendingCase = () => {
    const chosen = pendingCases[pendingCaseIdx];
    if (!chosen) return;
    saveToHistory(chosen.input, chosen.metadata);
    loadCase(chosen.input, chosen.metadata);
  };

  const flightOptions = appData ? listFlightOptions(appData) : [];
  const torqueUnitBlocked = !input.motor?.launchTorqueUnit
    || input.motor.launchTorqueUnit === 'unknown';

  return (
    <div className="physics-lab pl-page">
      <h2>Laboratorio Físico</h2>
      <p className="pl-subtitle">
        Módulo experimental · Solo lectura · No modifica vuelos, sesiones ni configuraciones existentes
      </p>

      <div className="pl-toolbar">
        <button type="button" className="primary" onClick={handleAnalyze}>
          Analizar
        </button>
        <button type="button" onClick={() => loadCase(sampleF1MFlight, undefined)}>
          Ejemplo F1M
        </button>
        <button type="button" onClick={() => loadCase(sampleDanjoF1M, { label: 'Caso Danjo', sourceType: 'published_partial' })}>
          Caso Danjo
        </button>
        <button type="button" onClick={() => jsonImportRef.current?.click()}>
          Importar caso JSON
        </button>
        <input
          ref={jsonImportRef}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={handleJsonFileChange}
        />
        <button type="button" onClick={handleClear}>
          Limpiar
        </button>
      </div>

      {importError && (
        <div className="pl-import-error">{importError}</div>
      )}

      {pendingCases.length > 0 && (
        <div className="pl-pending-cases">
          <strong>El archivo contiene {pendingCases.length} casos.</strong>
          <select
            value={pendingCaseIdx}
            onChange={(e) => setPendingCaseIdx(Number(e.target.value))}
          >
            {pendingCases.map((c, i) => (
              <option key={i} value={i}>
                {c.metadata.label ?? c.metadata.id ?? `Caso ${i + 1}`}
                {c.metadata.sourceType ? ` [${c.metadata.sourceType}]` : ''}
              </option>
            ))}
          </select>
          <button type="button" className="primary" onClick={handleLoadPendingCase}>
            Cargar caso seleccionado
          </button>
          <button type="button" onClick={() => setPendingCases([])}>
            Cancelar
          </button>
        </div>
      )}

      {importedMetadata && (
        <div className="pl-import-badge">
          <span className="pl-import-badge__tag">Caso importado</span>
          {importedMetadata.label && <span>{importedMetadata.label}</span>}
          {importedMetadata.sourceType && (
            <span className="pl-import-badge__source">{importedMetadata.sourceType}</span>
          )}
          {importedMetadata.id && (
            <span className="pl-import-badge__id">#{importedMetadata.id}</span>
          )}
        </div>
      )}

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
              <PhysicsChartsPanel input={input} result={result} torqueUnitBlocked={torqueUnitBlocked} />
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
            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              Completá los campos y presioná <strong>Analizar</strong> para ver resultados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
