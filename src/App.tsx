import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Boxes,
  ClipboardList,
  Dumbbell,
  FileDown,
  FileUp,
  Gauge,
  HardDrive,
  Home,
  LineChart,
  Lock,
  MapPin,
  Plane,
  Fan,
  RotateCcw,
  Save,
} from 'lucide-react';
import { calculateFlightMetrics, calculateModelGeometry, validateFlightInputs, validateModelF1M, validateMotorF1M } from './domain/calculations';
import { diagnoseFlight } from './domain/diagnosis';
import { exportAppDataJson, flightsToCsv, downloadTextFile } from './domain/exporters';
import { evaluateFlightHypotheses } from './domain/recommendations';
import { analyzeRpmProfile } from './domain/rpm';
import {
  buildOptimalConfiguration,
  compareFlightToBest,
  compareFlightToPrevious,
  createSuggestedConfiguration,
  createConfigurationFromFlight,
  createSession,
  detectConfigurationChange,
  evaluateChangeImpact,
  evaluateAgainstCeilingRecord,
  scoreFlight,
} from './domain/sessions';
import type {
  AppData,
  ClimbQuality,
  Flight,
  IndoorModel,
  LandingQuality,
  PropellerType,
  Propeller,
  RpmVisual,
  RubberBatch,
  RubberMotor,
  StabilityQuality,
  TurnPattern,
  Venue,
  VpMechanismMode,
  VpTransitionObserved,
  RpmSample,
  SessionObjective,
} from './domain/types';
import { loadDataFromDrive, loadGoogleUserProfile, requestDriveAccessToken, saveDataToDrive, type GoogleUserProfile } from './storage/googleDriveStorage';
import { loadAppData, resetAppData, saveAppData } from './storage/localStorage';
import logoUrl from '../img/logo.claro.png';

type View = 'dashboard' | 'session' | 'venues' | 'models' | 'propellers' | 'rubber' | 'motors' | 'flights' | 'diagnosis' | 'charts' | 'optimals';

const navItems: Array<{ id: View; label: string; Icon: typeof Home }> = [
  { id: 'dashboard', label: 'Dashboard', Icon: Home },
  { id: 'session', label: 'Sesion', Icon: ClipboardList },
  { id: 'venues', label: 'Salones', Icon: MapPin },
  { id: 'models', label: 'Modelos', Icon: Plane },
  { id: 'propellers', label: 'Helices', Icon: Fan },
  { id: 'rubber', label: 'Gomas', Icon: Boxes },
  { id: 'motors', label: 'Motores', Icon: Dumbbell },
  { id: 'flights', label: 'Vuelos', Icon: Activity },
  { id: 'diagnosis', label: 'Diagnostico', Icon: Gauge },
  { id: 'charts', label: 'Graficas', Icon: LineChart },
  { id: 'optimals', label: 'Optimos', Icon: Save },
];

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const numberValue = (value: FormDataEntryValue | null) => Number(value ?? 0);
const optionalNumberValue = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim();
  return text === '' ? undefined : Number(text);
};
const textValue = (value: FormDataEntryValue | null) => String(value ?? '').trim();
const parseRpmSamples = (raw: string): RpmSample[] => {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [timeRaw, rpmRaw, ...noteParts] = line.split(',').map((part) => part.trim());
      return {
        timeSec: Number(timeRaw),
        rpm: Number(rpmRaw),
        note: noteParts.join(', ') || undefined,
      };
    })
    .filter((sample) => Number.isFinite(sample.timeSec) && Number.isFinite(sample.rpm) && sample.rpm > 0);
};

const turnLabels: Record<TurnPattern, string> = {
  left: 'Izquierda',
  right: 'Derecha',
  irregular: 'Irregular',
};

const climbLabels: Record<ClimbQuality, string> = {
  low: 'Bajo',
  good: 'Bueno',
  too_aggressive: 'Muy agresivo',
};

const stabilityLabels: Record<StabilityQuality, string> = {
  stable: 'Estable',
  oscillating: 'Oscilante',
  stalling: 'Colgadas',
  diving: 'Picado',
};

const landingLabels: Record<LandingQuality, string> = {
  soft: 'Suave',
  hard: 'Duro',
  hung: 'Colgado',
  collision: 'Choque',
};

const propellerTypeLabels: Record<PropellerType, string> = {
  variable_pitch: 'Paso variable',
  fixed_pitch: 'Paso fijo',
  unknown: 'No registrado',
};

const rpmVisualLabels: Record<RpmVisual, string> = {
  slow: 'Lenta',
  normal: 'Normal',
  fast: 'Rapida',
  unknown: 'No registrada',
};

const vpTransitionLabels: Record<VpTransitionObserved, string> = {
  early: 'Temprana',
  normal: 'Normal',
  late: 'Tardia',
  unknown: 'No registrada',
};

const vpMechanismModeLabels: Record<VpMechanismMode, string> = {
  known: 'Conocido',
  unknown: 'Desconocido',
};

const sessionObjectiveLabels: Record<SessionObjective, string> = {
  buscar_optimo: 'Buscar optimo',
  comparar_motores: 'Comparar motores',
  ajustar_vp: 'Ajustar VP',
  validar_baseline: 'Validar baseline',
  trimado: 'Trimado',
  competencia: 'Competencia',
};

const ALLOWED_USERS = ['jgandolfo@gmail.com'];

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [message, setMessage] = useState('');
  const [driveAccessToken, setDriveAccessToken] = useState<string>();
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile>();
  const [authError, setAuthError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  const latestFlight = data.flights.at(-1);
  const findVenue = (id: string) => data.venues.find((venue) => venue.id === id);
  const findModel = (id: string) => data.models.find((model) => model.id === id);
  const findMotor = (id: string) => data.motors.find((motor) => motor.id === id);
  const findPropeller = (id: string) => data.propellers.find((propeller) => propeller.id === id);
  const findBatch = (id: string) => data.rubberBatches.find((batch) => batch.id === id);

  const latestDiagnosis = useMemo(() => {
    if (!latestFlight) return undefined;
    return diagnoseFlight(latestFlight, findVenue(latestFlight.venueId), findMotor(latestFlight.motorId));
  }, [data, latestFlight]);

  const complianceIssues = [
    ...data.models.flatMap((model) => validateModelF1M(model).map((issue) => `${model.name}: ${issue}`)),
    ...data.motors.flatMap((motor) => validateMotorF1M(motor).map((issue) => `${motor.name}: ${issue}`)),
  ];

  const setDataWithMessage = (next: AppData, nextMessage: string) => {
    setData(next);
    setMessage(nextMessage);
  };

  const connectGoogleDrive = async () => {
    setDriveBusy(true);
    setAuthError('');
    try {
      const token = await requestDriveAccessToken('consent');
      const profile = await loadGoogleUserProfile(token);
      if (!ALLOWED_USERS.includes(profile.email.toLowerCase())) {
        setDriveAccessToken(undefined);
        setDriveConnected(false);
        setGoogleUser(undefined);
        const text = `Usuario no autorizado: ${profile.email}`;
        setAuthError(text);
        setMessage(text);
        return;
      }
      setDriveAccessToken(token);
      setDriveConnected(true);
      setGoogleUser(profile);
      setMessage(`Google Drive conectado: ${profile.email}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'No se pudo conectar Google Drive.';
      setAuthError(text);
      setMessage(text);
    } finally {
      setDriveBusy(false);
    }
  };

  const ensureDriveToken = async () => {
    if (driveAccessToken) return driveAccessToken;
    const token = await requestDriveAccessToken('');
    const profile = await loadGoogleUserProfile(token);
    if (!ALLOWED_USERS.includes(profile.email.toLowerCase())) {
      throw new Error(`Usuario no autorizado: ${profile.email}`);
    }
    setDriveAccessToken(token);
    setDriveConnected(true);
    setGoogleUser(profile);
    return token;
  };

  const saveDrive = async () => {
    setDriveBusy(true);
    try {
      const token = await ensureDriveToken();
      await saveDataToDrive(token, data);
      setMessage('Datos guardados en Google Drive.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar en Google Drive.');
    } finally {
      setDriveBusy(false);
    }
  };

  const loadDrive = async () => {
    setDriveBusy(true);
    try {
      const token = await ensureDriveToken();
      const loaded = await loadDataFromDrive(token);
      if (!loaded) {
        setMessage('No hay datos guardados en Google Drive para esta app.');
        return;
      }
      setDataWithMessage(loaded, 'Datos cargados desde Google Drive.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar desde Google Drive.');
    } finally {
      setDriveBusy(false);
    }
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      setDataWithMessage(
        {
          venues: parsed.venues ?? [],
          models: parsed.models ?? [],
          propellers: parsed.propellers ?? [],
          rubberBatches: parsed.rubberBatches ?? [],
          motors: parsed.motors ?? [],
          flights: parsed.flights ?? [],
          sessions: parsed.sessions ?? [],
          flightConfigurations: parsed.flightConfigurations ?? [],
          configurationChanges: parsed.configurationChanges ?? [],
          optimalConfigurations: parsed.optimalConfigurations ?? [],
          activeSessionId: parsed.activeSessionId,
        },
        'Datos importados correctamente.',
      );
    } catch {
      setMessage('No se pudo importar el JSON.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const exportFlightsCsv = () => {
    const csv = flightsToCsv(
      data.flights,
      (flight) => calculateFlightMetrics(flight, findVenue(flight.venueId), findMotor(flight.motorId)),
      findVenue,
      findModel,
      findMotor,
    );
    downloadTextFile(`vuelos-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  };

  if (!driveConnected || !googleUser || !ALLOWED_USERS.includes(googleUser.email.toLowerCase())) {
    return (
      <AuthGate
        busy={driveBusy}
        error={authError}
        onConnect={() => void connectGoogleDrive()}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={logoUrl} alt="" className="brand-logo" />
          <div>
            <strong>Indoor Flight Optimizer</strong>
            <span>F1M offline-first</span>
          </div>
        </div>
        <nav>
          {navItems.map(({ id, label, Icon }) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)} type="button">
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
            <p>Registro local para ensayos indoor F1M con reglas iniciales explicables.</p>
          </div>
          <div className="actions">
            <button type="button" onClick={() => exportAppDataJson(data)}>
              <FileDown size={17} /> JSON
            </button>
            <button type="button" onClick={exportFlightsCsv}>
              <ClipboardList size={17} /> CSV vuelos
            </button>
            <button type="button" onClick={() => importRef.current?.click()}>
              <FileUp size={17} /> Importar
            </button>
            <button type="button" onClick={() => void connectGoogleDrive()} disabled={driveBusy}>
              <HardDrive size={17} /> {driveConnected ? 'Drive conectado' : 'Conectar Drive'}
            </button>
            <button type="button" onClick={() => void loadDrive()} disabled={driveBusy}>
              <FileDown size={17} /> Cargar Drive
            </button>
            <button type="button" onClick={() => void saveDrive()} disabled={driveBusy}>
              <FileUp size={17} /> Guardar Drive
            </button>
            <button type="button" onClick={() => setDataWithMessage(resetAppData(), 'Datos mock restaurados.')}>
              <RotateCcw size={17} /> Reset
            </button>
            <input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => void importJson(event.target.files?.[0])} />
          </div>
        </header>

        {message && <div className="notice">{message}</div>}

        {view === 'dashboard' && (
          <Dashboard data={data} latestFlight={latestFlight} latestDiagnosisText={latestDiagnosis?.text} complianceIssues={complianceIssues} />
        )}
        {view === 'session' && <SessionView data={data} onChange={setDataWithMessage} findVenue={findVenue} findModel={findModel} findMotor={findMotor} findPropeller={findPropeller} />}
        {view === 'venues' && <VenuesView data={data} onChange={setDataWithMessage} />}
        {view === 'models' && <ModelsView data={data} onChange={setDataWithMessage} />}
        {view === 'propellers' && <PropellersView data={data} onChange={setDataWithMessage} />}
        {view === 'rubber' && <RubberView data={data} onChange={setDataWithMessage} />}
        {view === 'motors' && <MotorsView data={data} onChange={setDataWithMessage} findBatch={findBatch} />}
        {view === 'flights' && <FlightsView data={data} onChange={setDataWithMessage} findVenue={findVenue} findModel={findModel} findMotor={findMotor} />}
        {view === 'diagnosis' && <DiagnosisView data={data} findVenue={findVenue} findModel={findModel} findMotor={findMotor} />}
        {view === 'charts' && <ChartsView data={data} findVenue={findVenue} findModel={findModel} findMotor={findMotor} />}
        {view === 'optimals' && <OptimalsView data={data} onChange={setDataWithMessage} findVenue={findVenue} findModel={findModel} findMotor={findMotor} />}
      </main>
    </div>
  );
}

type ChartPoint = {
  x: number;
  y: number;
  label?: string;
};

function AuthGate({ busy, error, onConnect }: { busy: boolean; error: string; onConnect: () => void }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <img src={logoUrl} alt="" className="auth-logo" />
        <div>
          <h1>Indoor Flight Optimizer</h1>
          <p>Acceso restringido. Conectá tu cuenta Google autorizada para usar la app y sincronizar datos con Drive.</p>
        </div>
        <button className="primary auth-button" type="button" onClick={onConnect} disabled={busy}>
          <Lock size={18} />
          {busy ? 'Conectando...' : 'Ingresar con Google'}
        </button>
        {error && <div className="warning">{error}</div>}
        <p className="auth-note">
          Los datos se guardan en tu Google Drive dentro de la carpeta privada de la app. Si no estas en la lista de usuarios autorizados, la app no se habilita.
        </p>
      </section>
    </main>
  );
}

function Dashboard({
  data,
  latestFlight,
  latestDiagnosisText,
  complianceIssues,
}: {
  data: AppData;
  latestFlight?: Flight;
  latestDiagnosisText?: string;
  complianceIssues: string[];
}) {
  return (
    <section className="grid">
      <Stat title="Salones" value={data.venues.length} />
      <Stat title="Modelos" value={data.models.length} />
      <Stat title="Motores" value={data.motors.length} />
      <Stat title="Vuelos" value={data.flights.length} />
      <article className="panel wide">
        <h2>Ultimo vuelo</h2>
        {latestFlight ? (
          <p>
            {latestFlight.durationSec}s, {latestFlight.turnsLoaded - latestFlight.backOff} vueltas netas,
            altura maxima {latestFlight.maxAltitudeM}m
            {latestFlight.touchedCeiling ? `, techo a los ${latestFlight.timeToCeilingSec ?? '?'}s` : ''}.
          </p>
        ) : (
          <p>No hay vuelos cargados.</p>
        )}
      </article>
      <article className="panel wide">
        <h2>Diagnostico inicial</h2>
        <p>{latestDiagnosisText ?? 'Cargar un vuelo para generar diagnostico.'}</p>
      </article>
      <article className="panel wide">
        <h2>Validaciones F1M</h2>
        {complianceIssues.length ? (
          <ul>{complianceIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        ) : (
          <p>Modelos y motores cumplen los limites configurados.</p>
        )}
      </article>
    </section>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <article className="stat">
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SessionView({
  data,
  onChange,
  findVenue,
  findModel,
  findMotor,
  findPropeller,
}: {
  data: AppData;
  onChange: (data: AppData, message: string) => void;
  findVenue: (id: string) => Venue | undefined;
  findModel: (id: string) => IndoorModel | undefined;
  findMotor: (id: string) => RubberMotor | undefined;
  findPropeller: (id: string) => Propeller | undefined;
}) {
  const activeSession = data.sessions.find((session) => session.id === data.activeSessionId && session.status === 'open');
  const sessionFlights = activeSession ? activeSession.flightIds.map((id) => data.flights.find((flight) => flight.id === id)).filter((flight): flight is Flight => Boolean(flight)) : [];
  const lastFlight = sessionFlights.at(-1);
  const previousFlight = sessionFlights.length > 1 ? sessionFlights[sessionFlights.length - 2] : undefined;
  const previousComparison = activeSession && lastFlight ? compareFlightToPrevious(activeSession, lastFlight, data.flights, data.venues, data.motors) : undefined;
  const bestComparison = activeSession && lastFlight ? compareFlightToBest(activeSession, lastFlight, data.flights, data.venues, data.motors) : undefined;
  const bestFlight = activeSession?.bestFlightId ? data.flights.find((flight) => flight.id === activeSession.bestFlightId) : undefined;
  const lastConfig = lastFlight ? data.flightConfigurations.find((config) => config.createdFromFlightId === lastFlight.id) : undefined;
  const previousConfig = previousFlight ? data.flightConfigurations.find((config) => config.createdFromFlightId === previousFlight.id) : undefined;
  const latestChange = activeSession && previousConfig && lastConfig ? detectConfigurationChange(previousConfig, lastConfig, activeSession.id) : undefined;
  const latestImpact = previousFlight && lastFlight && latestChange
    ? evaluateChangeImpact(
        previousFlight,
        lastFlight,
        latestChange,
        findVenue(previousFlight.venueId),
        findVenue(lastFlight.venueId),
        findMotor(previousFlight.motorId),
        findMotor(lastFlight.motorId),
      )
    : undefined;
  const suggestedConfig = activeSession
    ? [...data.flightConfigurations].reverse().find((config) => config.suggestedForSessionId === activeSession.id && !config.createdFromFlightId)
    : undefined;
  const ceilingReference = lastFlight
    ? evaluateAgainstCeilingRecord({
        flight: lastFlight,
        venue: findVenue(lastFlight.venueId),
        motor: findMotor(lastFlight.motorId),
        optimals: data.optimalConfigurations,
      })
    : undefined;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const session = createSession({
      id: makeId('session'),
      name: textValue(form.get('name')) || `Sesion ${new Date().toLocaleDateString()}`,
      venueId: textValue(form.get('venueId')),
      modelId: textValue(form.get('modelId')),
      motorId: textValue(form.get('motorId')) || undefined,
      propellerId: textValue(form.get('propellerId')) || undefined,
      objective: textValue(form.get('objective')) as SessionObjective,
      notes: textValue(form.get('notes')),
    });
    onChange({ ...data, sessions: [...data.sessions, session], activeSessionId: session.id }, 'Sesion creada y activada.');
    event.currentTarget.reset();
  };

  const closeSession = () => {
    if (!activeSession) return;
    onChange({
      ...data,
      sessions: data.sessions.map((session) => session.id === activeSession.id ? { ...session, status: 'closed' } : session),
      activeSessionId: undefined,
    }, 'Sesion cerrada.');
  };

  const saveOptimal = () => {
    if (!activeSession || !bestFlight) return;
    const configuration = data.flightConfigurations.find((config) => config.createdFromFlightId === bestFlight.id) ?? createConfigurationFromFlight(bestFlight, activeSession.propellerId);
    const nextConfigurations = data.flightConfigurations.some((config) => config.id === configuration.id)
      ? data.flightConfigurations
      : [...data.flightConfigurations, configuration];
    const optimal = buildOptimalConfiguration({
      id: makeId('optimal'),
      name: `${findModel(bestFlight.modelId)?.name ?? 'Modelo'} / ${findVenue(bestFlight.venueId)?.name ?? 'Salon'} / ${bestFlight.durationSec}s`,
      session: activeSession,
      flight: bestFlight,
      configuration,
      venue: findVenue(bestFlight.venueId),
      motor: findMotor(bestFlight.motorId),
      sessionFlights,
    });
    onChange({ ...data, flightConfigurations: nextConfigurations, optimalConfigurations: [...data.optimalConfigurations, optimal] }, 'Configuracion guardada como optima.');
  };

  const applyRecommendation = () => {
    if (!activeSession || !lastFlight || !lastConfig) return;
    const evaluation = evaluateFlightHypotheses(lastFlight, findModel(lastFlight.modelId), findMotor(lastFlight.motorId), findVenue(lastFlight.venueId));
    const action = evaluation.hypotheses[0]?.recommendedAction;
    const variable = action?.variable ?? 'baseline';
    const exactAdjustment = action?.exactAdjustment ?? ceilingReference?.exactAdjustment ?? 'sin cambios';
    const reason = action?.action ?? ceilingReference?.recommendation ?? 'Repetir baseline';
    const config = createSuggestedConfiguration({
      id: makeId('config-suggested'),
      base: lastConfig,
      variable,
      exactAdjustment,
      reason,
      sessionId: activeSession.id,
      compatibleMotors: data.motors,
    });
    onChange({ ...data, flightConfigurations: [...data.flightConfigurations, config] }, 'Próximo vuelo sugerido creado.');
  };

  const repeatSameConfiguration = () => {
    if (!activeSession || !lastConfig) return;
    const config = createSuggestedConfiguration({
      id: makeId('config-repeat'),
      base: lastConfig,
      variable: 'misma configuracion',
      exactAdjustment: 'sin cambios',
      reason: 'Repetir misma configuracion para verificar reproducibilidad.',
      sessionId: activeSession.id,
    });
    onChange({ ...data, flightConfigurations: [...data.flightConfigurations, config] }, 'Configuracion repetida creada para el próximo vuelo.');
  };

  const revertToBaseline = () => {
    if (!activeSession) return;
    const baseline =
      data.flightConfigurations.find((config) => config.id === activeSession.bestConfigurationId)
      ?? data.flightConfigurations.find((config) => config.id === activeSession.baselineConfigId)
      ?? (previousConfig ?? undefined);
    if (!baseline) {
      onChange(data, 'No hay baseline disponible para revertir.');
      return;
    }
    const config = createSuggestedConfiguration({
      id: makeId('config-revert'),
      base: baseline,
      variable: 'revertir baseline',
      exactAdjustment: 'volver a configuracion anterior',
      reason: 'Revertir al mejor baseline disponible.',
      sessionId: activeSession.id,
    });
    onChange({ ...data, flightConfigurations: [...data.flightConfigurations, config] }, 'Configuracion de reversión creada.');
  };

  return (
    <section className="two-column">
      <form className="panel form-grid" onSubmit={submit}>
        <h2>Nueva sesion</h2>
        <Input name="name" label="Nombre" />
        <Select name="venueId" label="Salon" options={data.venues.map((venue) => [venue.id, venue.name])} required />
        <Select name="modelId" label="Modelo" options={data.models.map((model) => [model.id, model.name])} required />
        <Select name="propellerId" label="Helice" options={data.propellers.map((propeller) => [propeller.id, propeller.name])} />
        <Select name="motorId" label="Motor inicial" options={data.motors.map((motor) => [motor.id, motor.name])} />
        <Select name="objective" label="Objetivo" options={Object.entries(sessionObjectiveLabels)} required defaultValue="buscar_optimo" />
        <Input name="notes" label="Notas" />
        <button className="primary" type="submit">Crear sesion</button>
      </form>
      <div className="panel">
        <h2>Sesion activa</h2>
        {activeSession ? (
          <div className="stack">
            <p>
              <strong>{activeSession.name}</strong> · {findModel(activeSession.modelId)?.name} · {findPropeller(activeSession.propellerId ?? '')?.name ?? 'sin helice'} · {findVenue(activeSession.venueId)?.name} · {sessionObjectiveLabels[activeSession.objective]}
            </p>
            <dl>
              <dt>Config actual</dt>
              <dd>{lastFlight ? `${lastFlight.turnsLoaded} vueltas, back-off ${lastFlight.backOff}, motor ${findMotor(lastFlight.motorId)?.name}` : 'Esperando primer vuelo.'}</dd>
              <dt>Mejor vuelo</dt>
              <dd>{bestFlight ? `${bestFlight.durationSec}s, score ${scoreFlight(bestFlight, findVenue(bestFlight.venueId), findMotor(bestFlight.motorId))}` : 'Sin mejor vuelo aun.'}</dd>
              <dt>Comparacion anterior</dt>
              <dd>{previousComparison ? `${previousComparison.decision}: ${previousComparison.explanation}` : 'Sin comparacion.'}</dd>
              <dt>Cambio aplicado</dt>
              <dd>{latestChange ? latestChange.summary : 'Primer vuelo o sin configuracion anterior.'}</dd>
              <dt>Resultado cambio</dt>
              <dd>{latestImpact ? `${latestImpact.decision} (${latestImpact.confidence}): ${latestImpact.explanation}` : 'Sin impacto calculado.'}</dd>
              <dt>Referencia techo</dt>
              <dd>
                {ceilingReference
                  ? `${ceilingReference.ceilingBand}: ${lastFlight?.durationSec}s vs ${ceilingReference.referenceDurationSec}s (${ceilingReference.referenceSource}), brecha ${ceilingReference.durationGapPct}%`
                  : 'Cargar primer vuelo para comparar contra record por altura.'}
              </dd>
              <dt>Energia</dt>
              <dd>{ceilingReference?.energyUseSummary ?? 'Sin lectura.'}</dd>
              <dt>Recomendacion</dt>
              <dd>{latestImpact ? latestImpact.recommendation : ceilingReference ? `${ceilingReference.recommendation} Ajuste: ${ceilingReference.exactAdjustment}` : previousComparison?.recommendation ?? 'cargar vuelo baseline'}</dd>
              <dt>Contra mejor</dt>
              <dd>{bestComparison ? `score delta ${bestComparison.scoreDelta}, duracion ${bestComparison.durationDeltaPct}%` : 'Sin comparacion.'}</dd>
              <dt>Mantener</dt>
              <dd>{ceilingReference?.keepConstant.join(', ') ?? 'una sola variable por ensayo; mantener modelo, salon y trimado salvo que la recomendacion diga trimado'}</dd>
            </dl>
            {latestChange && latestChange.changedVariables.length > 1 && (
              <div className="warning">Se modificaron varias variables; la causa de la mejora/empeoramiento es menos confiable.</div>
            )}
            {suggestedConfig && (
              <div className="recommendation-box">
                <strong>Próximo vuelo sugerido</strong>
                <span>{suggestedConfig.suggestedReason}</span>
                <strong>Variable</strong>
                <span>{suggestedConfig.changedVariable}</span>
                <strong>Vueltas</strong>
                <span>{suggestedConfig.turnsLoaded} cargadas, back-off {suggestedConfig.backOff}, netas {suggestedConfig.launchTurnsNet}</span>
                <strong>VP</strong>
                <span>max {suggestedConfig.maxPitchMm ?? '-'} mm, min {suggestedConfig.minPitchMm ?? '-'} mm, resorte {suggestedConfig.springHardness ?? '-'}</span>
                <strong>Mantener</strong>
                <span>{ceilingReference?.keepConstant.join(', ') ?? 'modelo, salon, helice, motor y trimado'}</span>
              </div>
            )}
            <div className="actions">
              <button type="button" onClick={repeatSameConfiguration}>Repetir misma configuracion</button>
              <button type="button" onClick={applyRecommendation}>Aplicar recomendacion</button>
              <button type="button" onClick={revertToBaseline}>Revertir al baseline</button>
              <button type="button" onClick={saveOptimal}>Guardar como optima</button>
              <button type="button" onClick={closeSession}>Cerrar sesion</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Vuelo</th><th>Duracion</th><th>Score</th><th>Techo</th><th>Rem.</th></tr></thead>
                <tbody>
                  {sessionFlights.map((flight) => {
                    const metrics = calculateFlightMetrics(flight, findVenue(flight.venueId), findMotor(flight.motorId));
                    return <tr key={flight.id}><td>{flight.id}</td><td>{flight.durationSec}s</td><td>{scoreFlight(flight, findVenue(flight.venueId), findMotor(flight.motorId))}</td><td>{metrics.ceilingUsePercent}%</td><td>{metrics.remainingPercent}%</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p>No hay sesion abierta.</p>
        )}
      </div>
    </section>
  );
}

function VenuesView({ data, onChange }: { data: AppData; onChange: (data: AppData, message: string) => void }) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const venue: Venue = {
      id: makeId('venue'),
      name: textValue(form.get('name')),
      city: textValue(form.get('city')),
      ceilingHeightM: numberValue(form.get('ceilingHeightM')),
      usableLengthM: numberValue(form.get('usableLengthM')),
      usableWidthM: numberValue(form.get('usableWidthM')),
      notes: textValue(form.get('notes')),
    };
    onChange({ ...data, venues: [...data.venues, venue] }, 'Salon agregado.');
    event.currentTarget.reset();
  };

  return (
    <EntitySection title="Nuevo salon" onSubmit={submit}>
      <Input name="name" label="Nombre" required />
      <Input name="city" label="Ciudad" required />
      <Input name="ceilingHeightM" label="Altura techo (m)" type="number" step="0.1" required />
      <Input name="usableLengthM" label="Largo util (m)" type="number" step="0.1" required />
      <Input name="usableWidthM" label="Ancho util (m)" type="number" step="0.1" required />
      <Input name="notes" label="Notas" />
      <List items={data.venues.map((venue) => `${venue.name} - ${venue.ceilingHeightM} m techo - ${venue.usableLengthM} x ${venue.usableWidthM} m`)} />
    </EntitySection>
  );
}

function ModelsView({ data, onChange }: { data: AppData; onChange: (data: AppData, message: string) => void }) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const model: IndoorModel = {
      id: makeId('model'),
      name: textValue(form.get('name')),
      wingspanMm: numberValue(form.get('wingspanMm')),
      weightG: numberValue(form.get('weightG')),
      wingAreaDm2: numberValue(form.get('wingAreaDm2')) || undefined,
      wingLeadingEdgeHeightMm: optionalNumberValue(form.get('wingLeadingEdgeHeightMm')),
      wingTrailingEdgeHeightMm: optionalNumberValue(form.get('wingTrailingEdgeHeightMm')),
      stabilizerLeadingEdgeHeightMm: optionalNumberValue(form.get('stabilizerLeadingEdgeHeightMm')),
      stabilizerTrailingEdgeHeightMm: optionalNumberValue(form.get('stabilizerTrailingEdgeHeightMm')),
      cgFromWingLeadingEdgeMm: optionalNumberValue(form.get('cgFromWingLeadingEdgeMm')),
      notes: textValue(form.get('notes')),
    };
    const issues = validateModelF1M(model);
    onChange({ ...data, models: [...data.models, model] }, issues.length ? `Modelo agregado con advertencia: ${issues[0]}` : 'Modelo agregado.');
    event.currentTarget.reset();
  };

  return (
    <EntitySection title="Nuevo modelo" onSubmit={submit}>
      <Input name="name" label="Nombre" required />
      <Input name="wingspanMm" label="Envergadura (mm)" type="number" step="1" required />
      <Input name="weightG" label="Peso (g)" type="number" step="0.01" required />
      <Input name="wingAreaDm2" label="Superficie alar (dm2)" type="number" step="0.1" />
      <Input name="wingLeadingEdgeHeightMm" label="Ala BA altura (mm)" type="number" step="0.1" />
      <Input name="wingTrailingEdgeHeightMm" label="Ala BF altura (mm)" type="number" step="0.1" />
      <Input name="stabilizerLeadingEdgeHeightMm" label="Estab. BA altura (mm)" type="number" step="0.1" />
      <Input name="stabilizerTrailingEdgeHeightMm" label="Estab. BF altura (mm)" type="number" step="0.1" />
      <Input name="cgFromWingLeadingEdgeMm" label="CG desde BA ala (mm)" type="number" step="0.1" />
      <Input name="notes" label="Notas" />
      <List items={data.models.map((model) => {
        const geometry = calculateModelGeometry(model);
        return `${model.name} - ${model.wingspanMm} mm - ${model.weightG} g - decalage ${geometry.decalageProxyMm} mm - CG ${model.cgFromWingLeadingEdgeMm ?? '-'} mm`;
      })} />
    </EntitySection>
  );
}

function PropellersView({ data, onChange }: { data: AppData; onChange: (data: AppData, message: string) => void }) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const propeller: Propeller = {
      id: makeId('prop'),
      name: textValue(form.get('name')),
      type: textValue(form.get('type')) as PropellerType,
      diameterMm: numberValue(form.get('diameterMm')),
      maxPitchMm: optionalNumberValue(form.get('maxPitchMm')),
      minPitchMm: optionalNumberValue(form.get('minPitchMm')),
      springHardness: optionalNumberValue(form.get('springHardness')),
      vpMechanismMode: textValue(form.get('vpMechanismMode')) as VpMechanismMode,
      bladeMaterial: textValue(form.get('bladeMaterial')),
      notes: textValue(form.get('notes')),
    };
    onChange({ ...data, propellers: [...data.propellers, propeller] }, 'Helice agregada.');
    event.currentTarget.reset();
  };

  return (
    <EntitySection title="Nueva helice" onSubmit={submit}>
      <Input name="name" label="Nombre" required />
      <Select name="type" label="Tipo" options={Object.entries(propellerTypeLabels)} required defaultValue="variable_pitch" />
      <Input name="diameterMm" label="Diametro (mm)" type="number" step="1" required />
      <Input name="maxPitchMm" label="Paso maximo (mm)" type="number" step="1" />
      <Input name="minPitchMm" label="Paso minimo (mm)" type="number" step="1" />
      <Input name="springHardness" label="Dureza resorte" type="number" step="0.1" />
      <Select name="vpMechanismMode" label="Mecanismo VP" options={Object.entries(vpMechanismModeLabels)} required defaultValue="unknown" />
      <Input name="bladeMaterial" label="Material" />
      <Input name="notes" label="Notas" />
      <List items={data.propellers.map((propeller) => `${propeller.name} - ${propeller.diameterMm} mm - ${propeller.maxPitchMm ?? '-'} / ${propeller.minPitchMm ?? '-'} - resorte ${propeller.springHardness ?? '-'}`)} />
    </EntitySection>
  );
}

function RubberView({ data, onChange }: { data: AppData; onChange: (data: AppData, message: string) => void }) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const batch: RubberBatch = {
      id: makeId('batch'),
      name: textValue(form.get('name')),
      manufacturer: textValue(form.get('manufacturer')),
      widthMm: numberValue(form.get('widthMm')),
      thicknessMm: numberValue(form.get('thicknessMm')),
      purchaseDate: textValue(form.get('purchaseDate')),
      densityNotes: textValue(form.get('densityNotes')),
      notes: textValue(form.get('notes')),
    };
    onChange({ ...data, rubberBatches: [...data.rubberBatches, batch] }, 'Batch de goma agregado.');
    event.currentTarget.reset();
  };

  return (
    <EntitySection title="Nuevo batch de goma" onSubmit={submit}>
      <Input name="name" label="Nombre" required />
      <Input name="manufacturer" label="Fabricante" required />
      <Input name="widthMm" label="Ancho (mm)" type="number" step="0.01" required />
      <Input name="thicknessMm" label="Espesor (mm)" type="number" step="0.01" required />
      <Input name="purchaseDate" label="Fecha compra" type="date" />
      <Input name="densityNotes" label="Notas densidad" />
      <Input name="notes" label="Notas" />
      <List items={data.rubberBatches.map((batch) => `${batch.name} - ${batch.manufacturer} - ${batch.widthMm} mm`)} />
    </EntitySection>
  );
}

function MotorsView({
  data,
  onChange,
  findBatch,
}: {
  data: AppData;
  onChange: (data: AppData, message: string) => void;
  findBatch: (id: string) => RubberBatch | undefined;
}) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const motor: RubberMotor = {
      id: makeId('motor'),
      name: textValue(form.get('name')),
      batchId: textValue(form.get('batchId')),
      loopLengthMm: numberValue(form.get('loopLengthMm')),
      weightG: numberValue(form.get('weightG')),
      strands: numberValue(form.get('strands')),
      lubricant: textValue(form.get('lubricant')),
      notes: textValue(form.get('notes')),
    };
    const issues = validateMotorF1M(motor);
    onChange({ ...data, motors: [...data.motors, motor] }, issues.length ? `Motor agregado con advertencia: ${issues[0]}` : 'Motor agregado.');
    event.currentTarget.reset();
  };

  return (
    <EntitySection title="Nuevo motor" onSubmit={submit}>
      <Input name="name" label="Nombre" required />
      <Select name="batchId" label="Batch" options={data.rubberBatches.map((batch) => [batch.id, batch.name])} required />
      <Input name="loopLengthMm" label="Longitud loop (mm)" type="number" step="1" required />
      <Input name="weightG" label="Peso (g)" type="number" step="0.01" required />
      <Input name="strands" label="Hebras" type="number" step="1" required defaultValue="1" />
      <Input name="lubricant" label="Lubricante" />
      <Input name="notes" label="Notas" />
      <List items={data.motors.map((motor) => `${motor.name} - ${motor.weightG} g - ${findBatch(motor.batchId)?.name ?? 'sin batch'}`)} />
    </EntitySection>
  );
}

function FlightsView({
  data,
  onChange,
  findVenue,
  findModel,
  findMotor,
}: {
  data: AppData;
  onChange: (data: AppData, message: string) => void;
  findVenue: (id: string) => Venue | undefined;
  findModel: (id: string) => IndoorModel | undefined;
  findMotor: (id: string) => RubberMotor | undefined;
}) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const activeSession = data.sessions.find((session) => session.id === data.activeSessionId && session.status === 'open');
    const sessionPropeller = activeSession?.propellerId ? data.propellers.find((propeller) => propeller.id === activeSession.propellerId) : undefined;
    const flight: Flight = {
      id: makeId('flight'),
      date: new Date().toISOString(),
      venueId: textValue(form.get('venueId')),
      modelId: textValue(form.get('modelId')),
      propellerId: activeSession?.propellerId,
      motorId: textValue(form.get('motorId')),
      turnsLoaded: numberValue(form.get('turnsLoaded')),
      backOff: numberValue(form.get('backOff')),
      durationSec: numberValue(form.get('durationSec')),
      maxAltitudeM: numberValue(form.get('maxAltitudeM')),
      touchedCeiling: form.get('touchedCeiling') === 'on',
      timeToCeilingSec: optionalNumberValue(form.get('timeToCeilingSec')),
      ceilingContactDurationSec: optionalNumberValue(form.get('ceilingContactDurationSec')),
      secondClimb: form.get('secondClimb') === 'on',
      secondCeilingTouch: form.get('secondCeilingTouch') === 'on',
      secondCeilingTimeSec: optionalNumberValue(form.get('secondCeilingTimeSec')),
      secondCeilingContactDurationSec: optionalNumberValue(form.get('secondCeilingContactDurationSec')),
      turnPattern: textValue(form.get('turnPattern')) as TurnPattern,
      climb: textValue(form.get('climb')) as ClimbQuality,
      stability: textValue(form.get('stability')) as StabilityQuality,
      landing: textValue(form.get('landing')) as LandingQuality,
      propType: sessionPropeller?.type ?? (textValue(form.get('propType')) as PropellerType),
      rpmVisual: textValue(form.get('rpmVisual')) as RpmVisual,
      rpmSamples: parseRpmSamples(textValue(form.get('rpmSamples'))) || undefined,
      rpmInitial: optionalNumberValue(form.get('rpmInitial')),
      rpmMid: optionalNumberValue(form.get('rpmMid')),
      rpmFinal: optionalNumberValue(form.get('rpmFinal')),
      vpPropeller: {
        maxPitchMm: optionalNumberValue(form.get('maxPitchMm')) ?? sessionPropeller?.maxPitchMm,
        minPitchMm: optionalNumberValue(form.get('minPitchMm')) ?? sessionPropeller?.minPitchMm,
        springHardness: optionalNumberValue(form.get('springHardness')) ?? sessionPropeller?.springHardness,
        notes: textValue(form.get('vpNotes')),
      },
      vpTransitionObserved: textValue(form.get('vpTransitionObserved')) as VpTransitionObserved,
      vpMechanismMode: sessionPropeller?.vpMechanismMode ?? (textValue(form.get('vpMechanismMode')) as VpMechanismMode),
      vpTransitionTimeSec: optionalNumberValue(form.get('vpTransitionTimeSec')),
      rpmBeforeVpTransition: optionalNumberValue(form.get('rpmBeforeVpTransition')),
      rpmAfterVpTransition: optionalNumberValue(form.get('rpmAfterVpTransition')),
      launchTorque: optionalNumberValue(form.get('launchTorque')),
      descentStartSec: optionalNumberValue(form.get('descentStartSec')),
      descentStartTorque: optionalNumberValue(form.get('descentStartTorque')),
      turnsAtDescentStart: optionalNumberValue(form.get('turnsAtDescentStart')),
      remainingTurns: numberValue(form.get('remainingTurns')),
      notes: textValue(form.get('notes')),
    };
    const issues = validateFlightInputs(flight);
    if (issues.length) {
      onChange(data, issues[0]);
      return;
    }
    const configuration = createConfigurationFromFlight(flight, activeSession?.propellerId, findMotor(flight.motorId), activeSession?.id);
    const sessionFlights = activeSession
      ? [...activeSession.flightIds, flight.id]
      : [];
    const sessionFlightRecords = sessionFlights
      .map((id) => id === flight.id ? flight : data.flights.find((item) => item.id === id))
      .filter((item): item is Flight => Boolean(item));
    const bestFlight = sessionFlightRecords.reduce<Flight | undefined>((best, item) => {
      if (!best) return item;
      return scoreFlight(item, findVenue(item.venueId), findMotor(item.motorId)) > scoreFlight(best, findVenue(best.venueId), findMotor(best.motorId)) ? item : best;
    }, undefined);
    const nextSessions = activeSession
      ? data.sessions.map((session) => session.id === activeSession.id
        ? {
            ...session,
            flightIds: sessionFlights,
            bestFlightId: bestFlight?.id,
            bestConfigurationId: bestFlight?.id === flight.id ? configuration.id : session.bestConfigurationId,
            baselineConfigId: session.baselineConfigId ?? configuration.id,
          }
        : session)
      : data.sessions;
    const previousSessionFlightId = activeSession?.flightIds.at(-1);
    const previousSessionConfig = previousSessionFlightId
      ? data.flightConfigurations.find((config) => config.createdFromFlightId === previousSessionFlightId)
      : undefined;
    const configurationChange = activeSession && previousSessionConfig
      ? detectConfigurationChange(previousSessionConfig, configuration, activeSession.id)
      : undefined;
    onChange({
      ...data,
      flights: [...data.flights, flight],
      flightConfigurations: [...data.flightConfigurations, configuration],
      configurationChanges: configurationChange ? [...data.configurationChanges, configurationChange] : data.configurationChanges,
      sessions: nextSessions,
    }, activeSession ? 'Vuelo agregado a la sesion activa.' : 'Vuelo agregado.');
    event.currentTarget.reset();
  };

  return (
    <section className="two-column">
      <form className="panel form-grid" onSubmit={submit}>
        <h2>Nuevo vuelo</h2>
        <Select name="venueId" label="Salon" options={data.venues.map((venue) => [venue.id, venue.name])} required />
        <Select name="modelId" label="Modelo" options={data.models.map((model) => [model.id, model.name])} required />
        <Select name="motorId" label="Motor" options={data.motors.map((motor) => [motor.id, motor.name])} required />
        <Input name="turnsLoaded" label="Vueltas cargadas" type="number" step="1" required />
        <Input name="backOff" label="Back-off" type="number" step="1" required defaultValue="0" />
        <Input name="durationSec" label="Duracion (s)" type="number" step="1" required />
        <Input name="maxAltitudeM" label="Altura maxima (m)" type="number" step="0.1" required />
        <label className="check">
          <input name="touchedCeiling" type="checkbox" />
          Toco techo
        </label>
        <Input name="timeToCeilingSec" label="Tiempo hasta techo (s)" type="number" step="0.1" />
        <Input name="ceilingContactDurationSec" label="Contacto techo total 1 (s)" type="number" step="0.1" />
        <label className="check">
          <input name="secondClimb" type="checkbox" />
          Cayo y volvio a trepar
        </label>
        <label className="check">
          <input name="secondCeilingTouch" type="checkbox" />
          Segundo toque de techo
        </label>
        <Input name="secondCeilingTimeSec" label="Tiempo segundo toque (s)" type="number" step="0.1" />
        <Input name="secondCeilingContactDurationSec" label="Contacto techo 2 (s)" type="number" step="0.1" />
        <Select name="turnPattern" label="Patron de giro" options={Object.entries(turnLabels)} required />
        <Select name="climb" label="Ascenso" options={Object.entries(climbLabels)} required />
        <Select name="stability" label="Estabilidad" options={Object.entries(stabilityLabels)} required />
        <Select name="landing" label="Aterrizaje" options={Object.entries(landingLabels)} required />
        <Select name="propType" label="Tipo de helice" options={Object.entries(propellerTypeLabels)} required defaultValue="variable_pitch" />
        <Select name="rpmVisual" label="RPM visual fase final" options={Object.entries(rpmVisualLabels)} required defaultValue="unknown" />
        <Input name="rpmInitial" label="RPM inicial" type="number" step="1" />
        <Input name="rpmMid" label="RPM media" type="number" step="1" />
        <Input name="rpmFinal" label="RPM final" type="number" step="1" />
        <Input name="maxPitchMm" label="VP paso maximo (mm)" type="number" step="1" />
        <Input name="minPitchMm" label="VP paso minimo (mm)" type="number" step="1" />
        <Input name="springHardness" label="VP dureza resorte" type="number" step="0.1" />
        <Select name="vpTransitionObserved" label="Transicion VP observada" options={Object.entries(vpTransitionLabels)} required defaultValue="unknown" />
        <Select name="vpMechanismMode" label="Mecanismo VP" options={Object.entries(vpMechanismModeLabels)} required defaultValue="unknown" />
        <Input name="vpTransitionTimeSec" label="Tiempo transicion VP (s)" type="number" step="0.1" />
        <Input name="rpmBeforeVpTransition" label="RPM antes transicion VP" type="number" step="1" />
        <Input name="rpmAfterVpTransition" label="RPM despues transicion VP" type="number" step="1" />
        <Input name="launchTorque" label="Torque lanzamiento" type="number" step="0.01" />
        <Input name="descentStartSec" label="Inicio de caida (s)" type="number" step="0.1" />
        <Input name="descentStartTorque" label="Torque inicio caida" type="number" step="0.01" />
        <Input name="turnsAtDescentStart" label="Vueltas inicio caida" type="number" step="1" />
        <Input name="remainingTurns" label="Vueltas remanentes" type="number" step="1" required defaultValue="0" />
        <Input name="vpNotes" label="Notas VP" />
        <Input name="notes" label="Notas" />
        <label className="wide-field">
          <span>Muestras RPM avanzadas</span>
          <textarea name="rpmSamples" placeholder="tiempo,rpm,nota opcional&#10;0,4200,lanzamiento&#10;120,3100,media&#10;240,1800,final" />
        </label>
        <button className="primary" type="submit">Guardar vuelo</button>
      </form>
      <div className="panel">
        <h2>Vuelos registrados</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vuelo</th>
                <th>Neto</th>
                <th>Rem.</th>
                <th>Techo</th>
                <th>Contacto</th>
                <th>2da trepada</th>
                <th>VP</th>
                <th>RPM</th>
                <th>s/vuelta</th>
                <th>s/g goma</th>
              </tr>
            </thead>
            <tbody>
              {data.flights.map((flight) => {
                const metrics = calculateFlightMetrics(flight, findVenue(flight.venueId), findMotor(flight.motorId));
                return (
                  <tr key={flight.id}>
                    <td>{findModel(flight.modelId)?.name ?? 'Modelo'} / {flight.durationSec}s</td>
                    <td>{metrics.netTurns}</td>
                    <td>{metrics.remainingPercent}%</td>
                    <td>{metrics.ceilingUsePercent}%</td>
                    <td>{metrics.totalCeilingContactSec}s</td>
                    <td>{flight.secondClimb || flight.secondCeilingTouch ? 'Si' : 'No'}</td>
                    <td>{flight.vpPropeller?.maxPitchMm ?? '-'} / {flight.vpPropeller?.minPitchMm ?? '-'}</td>
                    <td>{rpmVisualLabels[flight.rpmVisual ?? 'unknown']}</td>
                    <td>{metrics.efficiencyPerTurn}</td>
                    <td>{metrics.efficiencyPerRubberGram}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DiagnosisView({
  data,
  findVenue,
  findModel,
  findMotor,
}: {
  data: AppData;
  findVenue: (id: string) => Venue | undefined;
  findModel: (id: string) => IndoorModel | undefined;
  findMotor: (id: string) => RubberMotor | undefined;
}) {
  return (
    <section className="stack">
      {data.flights.length === 0 && <article className="panel"><p>No hay vuelos para diagnosticar.</p></article>}
      {[...data.flights].reverse().map((flight) => {
        const diagnosis = diagnoseFlight(flight, findVenue(flight.venueId), findMotor(flight.motorId));
        const metrics = calculateFlightMetrics(flight, findVenue(flight.venueId), findMotor(flight.motorId));
        const evaluation = evaluateFlightHypotheses(flight, findModel(flight.modelId), findMotor(flight.motorId), findVenue(flight.venueId));
        const rpmAnalysis = analyzeRpmProfile(flight);
        return (
          <article className="panel diagnosis" key={flight.id}>
            <div>
              <h2>{findModel(flight.modelId)?.name ?? 'Modelo'} - {new Date(flight.date).toLocaleString()}</h2>
              <p>{evaluation.symptomSummary}</p>
              <div className="recommendation-box">
                <strong>Accion prioritaria</strong>
                <span>{evaluation.recommendedAction}</span>
                <strong>Ajuste exacto</strong>
                <span>{evaluation.exactAdjustment}</span>
              </div>
              {evaluation.warning && <div className="warning">{evaluation.warning}</div>}
            </div>
            <dl>
              <dt>Familia</dt>
              <dd>{evaluation.primaryProblemFamily}</dd>
              <dt>Techo</dt>
              <dd>
                {flight.touchedCeiling || flight.secondCeilingTouch ? 'Tocado' : 'Sin toque'}; contacto {metrics.totalCeilingContactSec}s;
                tiempo hasta techo {flight.timeToCeilingSec ?? '-'}s
              </dd>
              <dt>VP</dt>
              <dd>
                max {flight.vpPropeller?.maxPitchMm ?? '-'} mm, min {flight.vpPropeller?.minPitchMm ?? '-'} mm,
                resorte {flight.vpPropeller?.springHardness ?? '-'}
              </dd>
              <dt>Caida</dt>
              <dd>
                inicio {flight.descentStartSec ?? '-'}s, torque {flight.descentStartTorque ?? '-'}, vueltas {flight.turnsAtDescentStart ?? '-'}
              </dd>
              <dt>RPM</dt>
              <dd>
                inicial {rpmAnalysis.rpmInitial ?? '-'}, media {rpmAnalysis.rpmMid ?? '-'}, final {rpmAnalysis.rpmFinal ?? '-'}; tendencia {rpmAnalysis.rpmTrend}. {rpmAnalysis.interpretation}
              </dd>
              <dt>RPM evidencia</dt>
              <dd>{rpmAnalysis.evidence.join(', ')}</dd>
              <dt>Hipotesis</dt>
              <dd>
                <ol className="hypothesis-list">
                  {evaluation.hypotheses.map((item) => (
                    <li key={item.id}>
                      <strong>{item.label}</strong> ({item.confidence})
                      <span>{item.evidence.join(' · ')}</span>
                    </li>
                  ))}
                </ol>
              </dd>
              <dt>Mantener</dt>
              <dd>{evaluation.keepConstant.join(', ')}</dd>
              <dt>Datos faltantes</dt>
              <dd>{evaluation.missingData.length ? evaluation.missingData.join(', ') : 'ninguno'}</dd>
              <dt>Diagnostico previo</dt>
              <dd>{diagnosis.probableLimiter}: {diagnosis.nextTestRecommendation}</dd>
            </dl>
          </article>
        );
      })}
    </section>
  );
}

function ChartsView({
  data,
  findVenue,
  findModel,
  findMotor,
}: {
  data: AppData;
  findVenue: (id: string) => Venue | undefined;
  findModel: (id: string) => IndoorModel | undefined;
  findMotor: (id: string) => RubberMotor | undefined;
}) {
  const latestFlight = data.flights.at(-1);
  const latestVenue = latestFlight ? findVenue(latestFlight.venueId) : undefined;
  const rpmPoints = latestFlight ? rpmSeries(latestFlight) : [];
  const altitudePoints = latestFlight ? altitudeProfile(latestFlight, latestVenue) : [];
  const motorPoints: ChartPoint[] = data.flights
    .map((flight): ChartPoint | undefined => {
      const metrics = calculateFlightMetrics(flight, findVenue(flight.venueId), findMotor(flight.motorId));
      const motor = findMotor(flight.motorId);
      const proxy = flight.launchTorque ?? (motor ? (metrics.netTurns * motor.weightG) / 1000 : undefined);
      return proxy === undefined
        ? undefined
        : {
            x: metrics.netTurns,
            y: proxy,
            label: findMotor(flight.motorId)?.name ?? 'motor',
          };
    })
    .filter((point): point is ChartPoint => point !== undefined);
  const propMinPoints: ChartPoint[] = data.flights
    .filter((flight) => flight.vpPropeller?.springHardness !== undefined && flight.vpPropeller?.minPitchMm !== undefined)
    .map((flight) => ({
      x: flight.vpPropeller.springHardness!,
      y: flight.vpPropeller.minPitchMm!,
      label: findModel(flight.modelId)?.name ?? 'modelo',
    }));
  const propMaxPoints: ChartPoint[] = data.flights
    .filter((flight) => flight.vpPropeller?.springHardness !== undefined && flight.vpPropeller?.maxPitchMm !== undefined)
    .map((flight) => ({
      x: flight.vpPropeller.springHardness!,
      y: flight.vpPropeller.maxPitchMm!,
      label: findModel(flight.modelId)?.name ?? 'modelo',
    }));

  return (
    <section className="chart-grid">
      <article className="panel">
        <h2>Perfil del ultimo vuelo</h2>
        <p>{latestFlight ? `${findModel(latestFlight.modelId)?.name ?? 'Modelo'} / ${latestFlight.durationSec}s` : 'Sin vuelos cargados.'}</p>
        <SimpleLineChart title="RPM vs tiempo" xLabel="segundos" yLabel="RPM" points={rpmPoints} />
        <SimpleLineChart title="Altura estimada vs tiempo" xLabel="segundos" yLabel="metros" points={altitudePoints} />
      </article>
      <article className="panel">
        <h2>Motores</h2>
        <p>Vueltas netas contra torque medido. Si falta torque, usa un proxy simple: vueltas netas por masa de motor.</p>
        <SimpleScatterChart title="Vueltas vs potencia proxy" xLabel="vueltas netas" yLabel="torque/proxy" points={motorPoints} />
      </article>
      <article className="panel">
        <h2>Helices VP</h2>
        <p>Paso minimo y maximo contra dureza del resorte para comparar configuraciones que producen perfiles distintos.</p>
        <SimpleScatterChart title="Paso minimo vs resorte" xLabel="dureza" yLabel="paso min mm" points={propMinPoints} />
        <SimpleScatterChart title="Paso maximo vs resorte" xLabel="dureza" yLabel="paso max mm" points={propMaxPoints} />
      </article>
    </section>
  );
}

function OptimalsView({
  data,
  onChange,
  findVenue,
  findModel,
  findMotor,
}: {
  data: AppData;
  onChange: (data: AppData, message: string) => void;
  findVenue: (id: string) => Venue | undefined;
  findModel: (id: string) => IndoorModel | undefined;
  findMotor: (id: string) => RubberMotor | undefined;
}) {
  const useAsBaseline = (optimalId: string) => {
    const optimal = data.optimalConfigurations.find((item) => item.id === optimalId);
    const config = optimal ? data.flightConfigurations.find((item) => item.id === optimal.configurationId) : undefined;
    if (!optimal || !config) return;
    const session = createSession({
      id: makeId('session'),
      name: `Baseline ${optimal.name}`,
      venueId: optimal.venueId ?? config.venueId ?? '',
      modelId: optimal.modelId,
      motorId: config.motorId,
      propellerId: optimal.propellerId,
      objective: 'validar_baseline',
      baselineConfigId: config.id,
      notes: `Creada desde optimo ${optimal.name}`,
    });
    onChange({ ...data, sessions: [...data.sessions, session], activeSessionId: session.id }, 'Sesion creada desde configuracion optima.');
  };

  return (
    <section className="panel">
      <h2>Configuraciones optimas</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th><th>Modelo</th><th>Helice</th><th>Salon/tipo</th><th>Motor</th><th>Vueltas</th><th>Back-off</th><th>VP</th><th>Duracion</th><th>Score</th><th>Conf.</th><th></th>
            </tr>
          </thead>
          <tbody>
            {data.optimalConfigurations.map((optimal) => {
              const config = data.flightConfigurations.find((item) => item.id === optimal.configurationId);
              return (
                <tr key={optimal.id}>
                  <td>{optimal.name}</td>
                  <td>{findModel(optimal.modelId)?.name ?? optimal.modelId}</td>
                  <td>{optimal.propellerId ?? '-'}</td>
                  <td>{optimal.venueId ? findVenue(optimal.venueId)?.name : optimal.validFor}</td>
                  <td>{config ? findMotor(config.motorId)?.name : '-'}</td>
                  <td>{config?.turnsLoaded ?? '-'}</td>
                  <td>{config?.backOff ?? '-'}</td>
                  <td>{config?.maxPitchMm ?? '-'} / {config?.minPitchMm ?? '-'} / {config?.springHardness ?? '-'}</td>
                  <td>{optimal.durationSec}s</td>
                  <td>{optimal.score}</td>
                  <td>{optimal.confidence}</td>
                  <td><button type="button" onClick={() => useAsBaseline(optimal.id)}>Usar baseline</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!data.optimalConfigurations.length && <p>No hay configuraciones optimas guardadas.</p>}
    </section>
  );
}

function rpmSeries(flight: Flight): ChartPoint[] {
  if (flight.rpmSamples?.length) {
    return [...flight.rpmSamples]
      .sort((a, b) => a.timeSec - b.timeSec)
      .map((sample) => ({ x: sample.timeSec, y: sample.rpm, label: sample.note }));
  }

  const points: ChartPoint[] = [];
  if (flight.rpmInitial !== undefined) points.push({ x: 0, y: flight.rpmInitial, label: 'inicial' });
  if (flight.rpmMid !== undefined) points.push({ x: flight.durationSec / 2, y: flight.rpmMid, label: 'media' });
  if (flight.rpmFinal !== undefined) points.push({ x: flight.durationSec, y: flight.rpmFinal, label: 'final' });
  return points;
}

function altitudeProfile(flight: Flight, venue?: Venue): ChartPoint[] {
  const ceiling = venue?.ceilingHeightM ?? Math.max(flight.maxAltitudeM, 1);
  const peakTime = flight.timeToCeilingSec ?? flight.durationSec * 0.35;
  const descentTime = flight.descentStartSec ?? flight.durationSec * 0.75;
  const points: ChartPoint[] = [
    { x: 0, y: 0, label: 'lanzamiento' },
    { x: peakTime, y: Math.min(flight.maxAltitudeM, ceiling), label: flight.touchedCeiling ? 'techo' : 'max' },
  ];
  if (flight.secondClimb || flight.secondCeilingTouch) {
    points.push({ x: Math.min(descentTime, flight.durationSec), y: Math.max(flight.maxAltitudeM * 0.65, 0), label: 'caida' });
    points.push({
      x: flight.secondCeilingTimeSec ?? Math.min(descentTime + flight.durationSec * 0.12, flight.durationSec),
      y: Math.min(flight.maxAltitudeM, ceiling),
      label: '2da trepada',
    });
  } else {
    points.push({ x: Math.min(descentTime, flight.durationSec), y: Math.max(flight.maxAltitudeM * 0.75, 0), label: 'planeo' });
  }
  points.push({ x: flight.durationSec, y: 0, label: 'aterrizaje' });
  return points.sort((a, b) => a.x - b.x);
}

function scale(value: number, min: number, max: number, outMin: number, outMax: number) {
  if (max === min) return (outMin + outMax) / 2;
  return outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

function chartBounds(points: ChartPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(0, ...ys),
    maxY: Math.max(...ys),
  };
}

function SimpleLineChart({ title, xLabel, yLabel, points }: { title: string; xLabel: string; yLabel: string; points: ChartPoint[] }) {
  if (points.length < 2) return <div className="empty-chart">{title}: faltan datos.</div>;

  const width = 640;
  const height = 260;
  const pad = 42;
  const bounds = chartBounds(points);
  const coords = points.map((point) => ({
    ...point,
    sx: scale(point.x, bounds.minX, bounds.maxX, pad, width - pad),
    sy: scale(point.y, bounds.minY, bounds.maxY, height - pad, pad),
  }));
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.sx} ${point.sy}`).join(' ');

  return (
    <div className="chart-box">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} />
        <path d={path} />
        {coords.map((point) => (
          <g key={`${point.x}-${point.y}-${point.label}`}>
            <circle cx={point.sx} cy={point.sy} r="4" />
            {point.label && <text x={point.sx + 6} y={point.sy - 6}>{point.label}</text>}
          </g>
        ))}
        <text x={width / 2 - 30} y={height - 8}>{xLabel}</text>
        <text x="6" y={pad - 12}>{yLabel}</text>
      </svg>
    </div>
  );
}

function SimpleScatterChart({ title, xLabel, yLabel, points }: { title: string; xLabel: string; yLabel: string; points: ChartPoint[] }) {
  if (points.length < 1) return <div className="empty-chart">{title}: faltan datos.</div>;

  const width = 640;
  const height = 260;
  const pad = 42;
  const bounds = chartBounds(points);
  const coords = points.map((point) => ({
    ...point,
    sx: scale(point.x, bounds.minX, bounds.maxX, pad, width - pad),
    sy: scale(point.y, bounds.minY, bounds.maxY, height - pad, pad),
  }));

  return (
    <div className="chart-box">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} />
        {coords.map((point) => (
          <g key={`${point.x}-${point.y}-${point.label}`}>
            <circle cx={point.sx} cy={point.sy} r="5" />
            {point.label && <text x={point.sx + 7} y={point.sy - 7}>{point.label}</text>}
          </g>
        ))}
        <text x={width / 2 - 30} y={height - 8}>{xLabel}</text>
        <text x="6" y={pad - 12}>{yLabel}</text>
      </svg>
    </div>
  );
}

function EntitySection({ title, onSubmit, children }: { title: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) {
  return (
    <section className="two-column">
      <form className="panel form-grid" onSubmit={onSubmit}>
        <h2>{title}</h2>
        {children}
        <button className="primary" type="submit">Guardar</button>
      </form>
    </section>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function Select({
  label,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: Array<[string, string]> }) {
  return (
    <label>
      <span>{label}</span>
      <select {...props}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </select>
    </label>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <div className="list-panel">
      <h3>Registros</h3>
      {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Sin registros.</p>}
    </div>
  );
}

export default App;
