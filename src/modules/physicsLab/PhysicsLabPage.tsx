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
import { generateReport } from './core/reportGenerator';
import { PhysicsInputPanel } from './components/PhysicsInputPanel';
import { PhysicsResultsPanel } from './components/PhysicsResultsPanel';
import { PhysicalEvidencePanel } from './components/PhysicalEvidencePanel';
import { PhysicsChartsPanel } from './components/PhysicsChartsPanel';
import { RecommendationCard } from './components/RecommendationCard';
import { ExpectedResultPanel } from './components/ExpectedResultPanel';
import './physicsLab.css';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  measured: 'medido',
  published_partial: 'publicado parcial',
  synthetic: 'sintético',
  hybrid: 'híbrido',
};

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
  const [copyMsg, setCopyMsg] = useState<string>('');
  const [showGuide, setShowGuide] = useState<boolean>(false);
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
    saveToHistory(input, importedMetadata, r, recs);
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
    setCopyMsg('');
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
        setPendingCases(normalized.cases);
        setPendingCaseIdx(0);
        return;
      }
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

  const handleCopyReport = () => {
    if (!result) return;
    const text = generateReport(input, result, recommendations, importedMetadata?.label);
    navigator.clipboard.writeText(text).then(
      () => { setCopyMsg('Informe copiado al portapapeles.'); setTimeout(() => setCopyMsg(''), 3000); },
      () => { setCopyMsg('No se pudo copiar. Usá Ctrl+C desde el texto.'); },
    );
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
        {result && (
          <button type="button" onClick={handleCopyReport}>
            Copiar informe
          </button>
        )}
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
        <button type="button" onClick={() => setShowGuide((v) => !v)}>
          {showGuide ? 'Ocultar guía' : 'Guía de referencia'}
        </button>
        <button type="button" onClick={handleClear}>
          Limpiar
        </button>
      </div>

      {copyMsg && <div className="pl-copy-msg">{copyMsg}</div>}
      {importError && <div className="pl-import-error">{importError}</div>}

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
            <span className="pl-import-badge__source">
              {SOURCE_TYPE_LABELS[importedMetadata.sourceType] ?? importedMetadata.sourceType}
            </span>
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

      <div className={`pl-layout ${showGuide ? 'pl-layout--with-guide' : ''}`}>
        <PhysicsInputPanel value={input} onChange={handleChange} />

        <div>
          {result ? (
            <>
              <PhysicsResultsPanel result={result} torqueUnitBlocked={torqueUnitBlocked} />
              <PhysicsChartsPanel input={input} result={result} torqueUnitBlocked={torqueUnitBlocked} />
              <PhysicalEvidencePanel result={result} />
              {importedMetadata?.expected && (
                <ExpectedResultPanel
                  expected={importedMetadata.expected}
                  actual={recommendations}
                />
              )}
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

        {showGuide && <ReferenceGuide />}
      </div>
    </div>
  );
}

// ── Guía de referencia ────────────────────────────────────────────────────────

function ReferenceGuide() {
  return (
    <aside className="pl-guide">
      <h3>Guía de referencia</h3>

      <section className="pl-guide-section">
        <h4>Unidades de torque</h4>
        <dl>
          <dt>lb·in</dt><dd>libra-pulgada (uso habitual en F1M, <strong>recomendado</strong>)</dd>
          <dt>mN·m</dt><dd>milinewton-metro (SI; 1 lb·in ≈ 113 mN·m)</dd>
          <dt>N·mm</dt><dd>newton-milímetro (igual que mN·m numericamente)</dd>
          <dt>g·cm</dt><dd>gramo-centímetro (unidad clásica)</dd>
          <dt>oz·in</dt><dd>onza-pulgada (1 lb·in = 16 oz·in)</dd>
          <dt>desconocida</dt><dd>bloquea el cálculo de potencia (correcto si no sabés la unidad)</dd>
        </dl>
      </section>

      <section className="pl-guide-section">
        <h4>Parámetros del motor</h4>
        <dl>
          <dt>Masa goma</dt><dd>peso total de la goma en gramos (sin ganchos)</dd>
          <dt>Loop (mm)</dt><dd>longitud del loop cerrado, de gancho a gancho</dd>
          <dt>Hebras</dt><dd>número de tiras: un loop simple = 1; loop doblado = 2</dd>
          <dt>Densidad lineal</dt><dd>masa por metro de hebra (g/m); si la sabés, cargala directamente</dd>
          <dt>Vueltas cargadas</dt><dd>vueltas dadas al motor antes del vuelo</dd>
          <dt>Back-off</dt><dd>vueltas de descarga liberadas antes del lanzamiento</dd>
          <dt>Vueltas remanentes</dt><dd>vueltas medidas al aterrizar</dd>
          <dt>Torque lanzamiento</dt><dd>torque medido en el gancho al soltar el modelo</dd>
        </dl>
      </section>

      <section className="pl-guide-section">
        <h4>Parámetros de hélice VP</h4>
        <dl>
          <dt>Paso mínimo</dt><dd>paso al final del vuelo, con pocas vueltas (mm)</dd>
          <dt>Paso máximo</dt><dd>paso al lanzamiento, con torque alto (mm)</dd>
          <dt>Dureza resorte</dt><dd>número relativo; mayor = transición más tardía</dd>
          <dt>Mecanismo VP</dt><dd>
            <em>torque abre a paso alto</em>: el torque empuja al paso alto;<br/>
            <em>torque cierra a paso bajo</em>: opuesto.<br/>
            Si no sabés cuál es, elegí "desconocido" para bloquear ajustes de resorte.
          </dd>
        </dl>
      </section>

      <section className="pl-guide-section">
        <h4>Resultados y confianza</h4>
        <dl>
          <dt>Confianza física alta</dt><dd>todos los datos críticos presentes y consistentes</dd>
          <dt>Confianza física media</dt><dd>algunos datos estimados o faltantes</dd>
          <dt>Confianza física baja</dt><dd>muchos datos faltantes; resultado orientativo</dd>
          <dt>Confianza operativa</dt><dd>riesgo de la acción sugerida (puede ser media aunque la física sea baja)</dd>
          <dt>Absorción alta</dt><dd>RPM caen mucho; la hélice carga bastante el motor</dd>
          <dt>Absorción baja</dt><dd>RPM se mantienen altas; hélice poco cargada al final</dd>
        </dl>
      </section>

      <section className="pl-guide-section">
        <h4>Categorías</h4>
        <dl>
          <dt>F1M</dt><dd>libre indoor, VP permitida, envergadura máx. 460 mm</dd>
          <dt>F1L</dt><dd>libre indoor, sin VP, envergadura máx. 650 mm</dd>
          <dt>EZB</dt><dd>ídem F1L, sin VP</dd>
          <dt>P25</dt><dd>envergadura máx. 250 mm, sin VP (parámetros provisionales)</dd>
        </dl>
      </section>

      <section className="pl-guide-section">
        <h4>Formato JSON de importación</h4>
        <pre className="pl-guide-pre">{`// Formato 1: datos directos
{ "category": "F1M", "motor": { ... } }

// Formato 2: caso envuelto
{ "label": "mi caso",
  "sourceType": "measured",
  "input": { "category": "F1M", ... },
  "expected": {
    "shouldRecommend": ["backoff"],
    "expectedTargetVariable": "backoff"
  }
}

// Formato 3: múltiples casos
{ "cases": [
    { "label": "caso A", "input": {...} },
    { "label": "caso B", "input": {...} }
  ]
}`}</pre>
      </section>
    </aside>
  );
}
