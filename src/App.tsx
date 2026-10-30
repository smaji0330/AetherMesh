import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  LocateFixed,
  Download,
  Sliders,
  BatteryCharging,
  ShieldAlert,
  HeartPulse,
  Copy,
  Check,
} from 'lucide-react';
import { useMeshEngine } from './hooks/useMeshEngine';
import { RadarCompass } from './components/RadarCompass';
import { RoutingWorkbench } from './components/RoutingWorkbench';
import { SignalSpectrum } from './components/SignalSpectrum';
import { HardwareCompanion } from './components/HardwareCompanion';
import { DisasterProtocols } from './components/DisasterProtocols';
import type { BloodType, MedicalStatus, NodeMode } from './types/mesh';

type ActiveSection = 'radar' | 'protocols' | 'routing' | 'spectrum' | 'hardware';

export function App() {
  const {
    snapshot,
    wsConnected,
    gpsSyncing,
    gpsStatusMsg,
    toggleSos,
    updateTelemetry,
    updateConfig,
    dispatchAck,
    pingPeer,
    spawnPeer,
    triggerPeerSos,
    removePeer,
    clearPackets,
    syncBrowserGps,
  } = useMeshEngine();

  const [activeSection, setActiveSection] = useState<ActiveSection>('radar');
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>('Rescuer_Alpha_09');
  const [nodeIdDraft, setNodeIdDraft] = useState<string>('Subhajit_Device_01');
  const [sosCategory, setSosCategory] = useState<string>('Medical / Structural Collapse');
  const [sosNote, setSosNote] = useState<string>(
    'Trapped under debris, need medical assistance.'
  );
  const [medicalStatus, setMedicalStatus] = useState<MedicalStatus>('CRITICAL');
  const [bloodType, setBloodType] = useState<BloodType>('O+');
  const [copiedMedicalJson, setCopiedMedicalJson] = useState<boolean>(false);

  useEffect(() => {
    if (snapshot?.node_id) {
      setNodeIdDraft(snapshot.node_id);
    }
    if (snapshot?.medical_status) {
      setMedicalStatus(snapshot.medical_status);
    }
    if (snapshot?.blood_type) {
      setBloodType(snapshot.blood_type);
    }
  }, [snapshot?.node_id, snapshot?.medical_status, snapshot?.blood_type]);

  const handleNodeIdCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nodeIdDraft.trim() && nodeIdDraft.trim() !== snapshot?.node_id) {
      updateConfig({ node_id: nodeIdDraft.trim() });
    }
  };

  const handleExportSnapshot = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aethermesh_telemetry_${snapshot.node_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-[#07090E] text-slate-200 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#0E131D] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="h-5 w-48 bg-slate-800 rounded animate-pulse" />
          <div className="h-3.5 w-72 bg-slate-800/70 rounded animate-pulse" />
          <div className="h-40 w-full bg-slate-900 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const peerDistressNodes = Object.values(snapshot.nodes_discovered).filter(
    (p) => p.telemetry.sos_active
  );

  const liveMedicalPayload = {
    node_id: nodeIdDraft.trim() || snapshot.node_id,
    status: medicalStatus,
    blood_type: bloodType,
    gps_last_known: [snapshot.latitude, snapshot.longitude] as [number, number],
    message: sosNote,
  };

  const handleCopyMedicalJson = () => {
    navigator.clipboard?.writeText(JSON.stringify(liveMedicalPayload, null, 2));
    setCopiedMedicalJson(true);
    setTimeout(() => setCopiedMedicalJson(false), 1800);
  };

  const handleRequestMedicalAssistance = () => {
    const targetNodeId = nodeIdDraft.trim() || 'Subhajit_Device_01';
    setMedicalStatus('CRITICAL');
    setSosCategory('Medical / Structural Collapse');
    toggleSos(true, 'Medical / Structural Collapse', sosNote, {
      node_id: targetNodeId,
      status: 'CRITICAL',
      blood_type: bloodType,
      gps_last_known: [snapshot.latitude, snapshot.longitude],
      message: sosNote,
    });
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Strictly 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-[#0B0F17] border-b border-slate-800/90 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#radar"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('radar');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 font-display whitespace-nowrap shrink-0"
        >
          AetherMesh
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {(
            [
              { id: 'radar', label: 'Radar & SOS' },
              { id: 'protocols', label: 'Disaster Protocols' },
              { id: 'routing', label: 'Mesh Routing' },
              { id: 'spectrum', label: 'Signal Spectrum' },
              { id: 'hardware', label: 'Hardware & CLI' },
            ] as const
          ).map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-slate-400 border-transparent hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() =>
              toggleSos(!snapshot.sos_active, sosCategory, sosNote, {
                node_id: nodeIdDraft.trim() || snapshot.node_id,
                status: medicalStatus,
                blood_type: bloodType,
                gps_last_known: [snapshot.latitude, snapshot.longitude],
                message: sosNote,
              })
            }
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              snapshot.sos_active
                ? 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-700/60'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {snapshot.sos_active ? 'Cancel SOS' : 'Broadcast SOS'}
          </button>
        </div>
      </header>

      {/* Mobile View Switcher (Visible below md) */}
      <div className="md:hidden flex items-center gap-1 p-2 bg-[#0B0F17] border-b border-slate-800 overflow-x-auto">
        {(
          [
            { id: 'radar', label: 'Radar & SOS' },
            { id: 'protocols', label: 'Disaster Protocols' },
            { id: 'routing', label: 'Mesh Routing' },
            { id: 'spectrum', label: 'Signal Spectrum' },
            { id: 'hardware', label: 'Hardware & CLI' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveSection(item.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeSection === item.id
                ? 'bg-slate-800 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Top Instrument Telemetry Ribbon (Clean Unboxed Metadata) */}
      <div className="bg-[#090D14] border-b border-slate-800/80 px-6 py-2 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 text-slate-400 font-mono tabular-nums">
          <span className="text-slate-200 font-medium">Node: {snapshot.node_id}</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              snapshot.medical_status === 'CRITICAL'
                ? 'text-rose-400 font-semibold'
                : 'text-amber-400'
            }
          >
            Status: {snapshot.medical_status}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-200">Blood: {snapshot.blood_type}</span>
          <span aria-hidden="true">·</span>
          <span>
            GPS: [{snapshot.latitude.toFixed(4)}, {snapshot.longitude.toFixed(4)}]
          </span>
          <span aria-hidden="true">·</span>
          <span className={wsConnected ? 'text-emerald-400' : 'text-amber-400'}>
            {wsConnected ? '● Live Sync' : '▲ Reconnecting'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleExportSnapshot}
          className="text-xs text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export Telemetry JSON
        </button>
      </div>

      {/* Inbound Peer Distress Banner when operating as Rescuer/Relay */}
      {peerDistressNodes.length > 0 && (
        <div className="bg-rose-950/50 border-b border-rose-800/70 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Inbound Medical Emergency SOS from{' '}
              <strong className="font-mono text-white">
                {peerDistressNodes.map((n) => n.id).join(', ')}
              </strong>{' '}
              [{peerDistressNodes[0].telemetry.medical_status || 'CRITICAL'} · Blood{' '}
              {peerDistressNodes[0].telemetry.blood_type || 'O+'}] (
              {peerDistressNodes[0].distance_m} m · {peerDistressNodes[0].rssi} dBm)
            </span>
          </div>
          <button
            type="button"
            onClick={() => dispatchAck(peerDistressNodes[0].id)}
            className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Dispatch Rescuer ACK
          </button>
        </div>
      )}

      {/* Main Asymmetric Split Console */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control & Transceiver Calibration Column */}
        <aside className="lg:col-span-4 xl:col-span-4 bg-[#0E131D] border border-slate-800 rounded-xl divide-y divide-slate-800/80">
          {/* Section 1: Medical Emergency & SOS Beacon Dispatch */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-400 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-100">
                  Medical Emergency &amp; SOS Dispatch
                </h2>
              </div>
              <span
                className={`text-xs font-mono font-medium ${
                  snapshot.sos_active ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {snapshot.sos_active ? '✖ BROADCASTING' : '● STANDBY'}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Medical Status</label>
                  <select
                    value={medicalStatus}
                    onChange={(e) => setMedicalStatus(e.target.value as MedicalStatus)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 rounded-lg text-rose-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="URGENT">URGENT</option>
                    <option value="STABLE">STABLE</option>
                    <option value="STANDBY">STANDBY</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Blood Type</label>
                  <select
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value as BloodType)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    {(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as BloodType[]).map(
                      (bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Incident Classification</label>
                <select
                  value={sosCategory}
                  onChange={(e) => setSosCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#07090E] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="Medical / Structural Collapse">
                    Medical / Structural Collapse
                  </option>
                  <option value="Medical / Flood Extraction">Medical / Flood Extraction</option>
                  <option value="Medical / Landslide Burial">Medical / Landslide Burial</option>
                  <option value="Grid Blackout / Shelter Needed">
                    Grid Blackout / Shelter Needed
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Emergency Medical Message
                </label>
                <input
                  type="text"
                  value={sosNote}
                  onChange={(e) => setSosNote(e.target.value)}
                  maxLength={110}
                  className="w-full px-3 py-1.5 text-xs bg-[#07090E] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Live Medical JSON Packet Inspector */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono text-slate-400">
                    Medical Telemetry Payload
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyMedicalJson}
                    className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    {copiedMedicalJson ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy JSON
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800/90 text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                  {JSON.stringify(liveMedicalPayload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Primary Medical Assistance Button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  toggleSos(!snapshot.sos_active, sosCategory, sosNote, {
                    node_id: nodeIdDraft.trim() || snapshot.node_id,
                    status: medicalStatus,
                    blood_type: bloodType,
                    gps_last_known: [snapshot.latitude, snapshot.longitude],
                    message: sosNote,
                  })
                }
                className={`w-full py-3.5 px-5 rounded-xl font-display font-bold text-sm tracking-wider transition-transform active:scale-[0.99] flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 ${
                  snapshot.sos_active
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {snapshot.sos_active ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    CANCEL SOS BROADCAST
                  </>
                ) : (
                  <>
                    <AlertOctagon className="w-4 h-4 shrink-0" />
                    REQUEST MEDICAL ASSISTANCE
                  </>
                )}
              </button>

              {!snapshot.sos_active && (
                <button
                  type="button"
                  onClick={handleRequestMedicalAssistance}
                  className="w-full py-2 px-3 rounded-lg text-xs font-mono font-medium bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/70 transition-colors whitespace-nowrap shrink-0"
                >
                  Dispatch Subhajit_Device_01 CRITICAL Preset
                </button>
              )}
            </div>

            {snapshot.ack_received && (
              <div className="pt-1 text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Medical SOS confirmed by <strong className="font-mono">{snapshot.ack_by}</strong>.
                  Keep beacon active for directional homing.
                </span>
              </div>
            )}
          </div>

          {/* Section 2: Transceiver Identity & Role Switcher */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-100">
                Node Identity &amp; Operating Mode
              </h2>
            </div>

            <form onSubmit={handleNodeIdCommit} className="flex items-center gap-2">
              <input
                type="text"
                value={nodeIdDraft}
                onChange={(e) => setNodeIdDraft(e.target.value)}
                aria-label="Local Mesh Node ID"
                className="flex-1 min-w-0 px-3 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Save ID
              </button>
            </form>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Device Mesh Role</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-lg">
                {(['victim', 'rescuer', 'relay'] as NodeMode[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => updateConfig({ mode: role })}
                    className={`py-1.5 text-xs font-medium capitalize rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      snapshot.mode === role
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {snapshot.mode === 'victim' &&
                  'Broadcasts UDP SOS beacons with blood type & GPS every 2.5s when triggered.'}
                {snapshot.mode === 'rescuer' &&
                  'Listens for multi-hop medical SOS frames and automatically dispatches targeted ACK packets.'}
                {snapshot.mode === 'relay' &&
                  'Acts as a dedicated store-and-forward repeater, decrementing TTL and blocking loops.'}
              </p>
            </div>
          </div>

          {/* Section 3: GNSS Telemetry, Compass Heading & Battery Calibration */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-100">
                GNSS Last Known &amp; Sensor Calibration
              </h2>
              <button
                type="button"
                onClick={syncBrowserGps}
                disabled={gpsSyncing}
                className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                {gpsSyncing ? 'Locking...' : 'Sync GPS'}
              </button>
            </div>

            {gpsStatusMsg && <p className="text-xs text-slate-400">{gpsStatusMsg}</p>}

            <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
              <div>
                <label className="block text-[11px] font-sans text-slate-400 mb-1">
                  Latitude (°N)
                </label>
                <input
                  type="number"
                  step="0.0002"
                  value={snapshot.latitude}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) updateTelemetry({ lat: val });
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-sans text-slate-400 mb-1">
                  Longitude (°E)
                </label>
                <input
                  type="number"
                  step="0.0002"
                  value={snapshot.longitude}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) updateTelemetry({ lon: val });
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Digital Compass Heading</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {String(snapshot.heading).padStart(3, '0')}°
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={359}
                value={snapshot.heading}
                onChange={(e) => updateTelemetry({ heading: Number(e.target.value) })}
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  Transceiver Battery Reserve
                </span>
                <span className="font-mono tabular-nums text-slate-200">{snapshot.battery}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={snapshot.battery}
                onChange={(e) => updateTelemetry({ battery: Number(e.target.value) })}
                className="w-full accent-emerald-400"
              />
            </div>
          </div>
        </aside>

        {/* Right Main Viewport Stage */}
        <div className="lg:col-span-8 xl:col-span-8 min-w-0">
          {activeSection === 'radar' && (
            <RadarCompass
              snapshot={snapshot}
              selectedPeerId={selectedPeerId}
              onSelectPeer={setSelectedPeerId}
              onPingPeer={pingPeer}
              onDispatchAck={dispatchAck}
              onTriggerPeerSos={triggerPeerSos}
            />
          )}

          {activeSection === 'protocols' && (
            <DisasterProtocols
              snapshot={snapshot}
              onDispatchDisasterSos={({ category, message, status, blood_type }) => {
                setSosCategory(category);
                setSosNote(message);
                setMedicalStatus(status);
                setBloodType(blood_type);
                toggleSos(true, category, message, {
                  node_id: nodeIdDraft.trim() || snapshot.node_id,
                  status,
                  blood_type,
                  gps_last_known: [snapshot.latitude, snapshot.longitude],
                  message,
                });
              }}
            />
          )}

          {activeSection === 'routing' && (
            <RoutingWorkbench
              snapshot={snapshot}
              onSpawnPeer={spawnPeer}
              onRemovePeer={removePeer}
              onTriggerPeerSos={triggerPeerSos}
              onClearPackets={clearPackets}
              onUpdateConfig={updateConfig}
            />
          )}

          {activeSection === 'spectrum' && (
            <SignalSpectrum snapshot={snapshot} onPingPeer={pingPeer} />
          )}

          {activeSection === 'hardware' && <HardwareCompanion snapshot={snapshot} />}
        </div>
      </main>
    </div>
  );
}

export default App;
