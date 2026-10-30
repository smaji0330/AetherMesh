import React, { useState, useMemo, useRef } from 'react';
import { Compass, Radio, Send, CheckCircle2, AlertTriangle, Navigation } from 'lucide-react';
import type { DiscoveredNode, MeshSnapshot } from '../types/mesh';

interface RadarCompassProps {
  snapshot: MeshSnapshot;
  selectedPeerId: string | null;
  onSelectPeer: (id: string | null) => void;
  onPingPeer: (id: string) => void;
  onDispatchAck: (id: string) => void;
  onTriggerPeerSos: (id: string) => void;
}

export const RadarCompass: React.FC<RadarCompassProps> = ({
  snapshot,
  selectedPeerId,
  onSelectPeer,
  onPingPeer,
  onDispatchAck,
  onTriggerPeerSos,
}) => {
  const [maxRangeM, setMaxRangeM] = useState<250 | 500 | 1000>(500);
  const [orientationMode, setOrientationMode] = useState<'north' | 'heading'>('north');
  const [probeCoords, setProbeCoords] = useState<{ bearing: number; rangeM: number } | null>(null);
  const [peerSearch, setPeerSearch] = useState<string>('');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const peers = useMemo(() => {
    const all = Object.values(snapshot.nodes_discovered);
    all.sort((a, b) => a.distance_m - b.distance_m);
    return all;
  }, [snapshot.nodes_discovered]);

  const filteredPeers = useMemo(() => {
    const q = peerSearch.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.ip.includes(q) ||
        p.telemetry.mode.toLowerCase().includes(q)
    );
  }, [peers, peerSearch]);

  const center = 210;
  const maxRadius = 166;
  const rotationOffset = orientationMode === 'heading' ? -snapshot.heading : 0;

  const projectNode = (peer: DiscoveredNode) => {
    const clampedRatio = Math.min(0.96, peer.distance_m / maxRangeM);
    const r = Math.max(18, clampedRatio * maxRadius);
    const angleDeg = peer.bearing_deg + rotationOffset - 90;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
      clamped: peer.distance_m > maxRangeM,
    };
  };

  const nodeCoordsMap = useMemo(() => {
    const map: Record<string, { x: number; y: number; clamped: boolean }> = {};
    for (const p of peers) {
      map[p.id] = projectNode(p);
    }
    return map;
  }, [peers, maxRangeM, rotationOffset]);

  const handleRadarMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 420 / rect.width;
    const scaleY = 420 / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;
    const dx = svgX - center;
    const dy = svgY - center;
    const pixelDist = Math.sqrt(dx * dx + dy * dy);
    if (pixelDist > maxRadius + 14) {
      setProbeCoords(null);
      return;
    }
    const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90 - rotationOffset;
    const bearing = Math.round(((rawAngle % 360) + 360) % 360);
    const rangeM = Math.round((Math.min(pixelDist, maxRadius) / maxRadius) * maxRangeM);
    setProbeCoords({ bearing, rangeM });
  };

  const selectedPeer = selectedPeerId ? snapshot.nodes_discovered[selectedPeerId] : peers[0] || null;

  const formatCardinal = (deg: number) => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  };

  const getSignalLabel = (rssi: number) => {
    if (rssi >= -60) return { glyph: '●', text: 'Strong', color: 'text-emerald-400' };
    if (rssi >= -76) return { glyph: '▲', text: 'Moderate', color: 'text-cyan-400' };
    return { glyph: '▼', text: 'Weak Edge', color: 'text-amber-400' };
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Main Polar Radar & Selected Peer Telemetry Panel (Single-Elevation Surface) */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        {/* Toolbar Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/90">
          <div className="flex items-center gap-3">
            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-base font-semibold tracking-tight text-slate-100">
              Azimuth Polar Radar &amp; Multi-Hop Vector Scope
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Orientation Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setOrientationMode('north')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  orientationMode === 'north'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                North-Up
              </button>
              <button
                type="button"
                onClick={() => setOrientationMode('heading')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  orientationMode === 'heading'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Heading-Up ({snapshot.heading}°)
              </button>
            </div>

            {/* Range Scale Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-lg font-mono">
              {([250, 500, 1000] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMaxRangeM(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    maxRangeM === r
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r} m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Split Stage: Left Polar SVG Scope | Right Selected Target & Route Readout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-800/80">
          {/* Polar Radar Scope */}
          <div className="xl:col-span-7 p-6 flex flex-col items-center justify-center relative bg-[#090D14]">
            {/* Corner Coordinate HUD */}
            <div className="w-full flex items-center justify-between text-xs font-mono tabular-nums text-slate-400 mb-2">
              <span>
                Origin: {snapshot.latitude.toFixed(4)}° N · {snapshot.longitude.toFixed(4)}° E
              </span>
              <span>
                {probeCoords
                  ? `Probe: ${String(probeCoords.bearing).padStart(3, '0')}° ${formatCardinal(probeCoords.bearing)} · ${probeCoords.rangeM} m`
                  : `Channel: UDP :${snapshot.config.port}`}
              </span>
            </div>

            <div className="relative w-full max-w-[390px] aspect-square flex items-center justify-center">
              <svg
                ref={svgRef}
                viewBox="0 0 420 420"
                onMouseMove={handleRadarMouseMove}
                onMouseLeave={() => setProbeCoords(null)}
                className="w-full h-full cursor-crosshair select-none"
                role="img"
                aria-label="Offline Mesh Peer Azimuth Radar"
              >
                <defs>
                  <radialGradient id="radarFieldGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.09" />
                    <stop offset="65%" stopColor="#06b6d4" stopOpacity="0.03" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Outer Instrument Dial */}
                <circle
                  cx={center}
                  cy={center}
                  r={maxRadius}
                  fill="url(#radarFieldGrad)"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />

                {/* Range Rings (33%, 66%) */}
                {[0.333, 0.666].map((frac, idx) => (
                  <g key={idx}>
                    <circle
                      cx={center}
                      cy={center}
                      r={maxRadius * frac}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="1"
                      strokeDasharray="3 4"
                    />
                    <text
                      x={center + 5}
                      y={center - maxRadius * frac + 12}
                      fill="#64748b"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {Math.round(maxRangeM * frac)}m
                    </text>
                  </g>
                ))}

                {/* Crosshair Axes */}
                <line
                  x1={center}
                  y1={center - maxRadius}
                  x2={center}
                  y2={center + maxRadius}
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <line
                  x1={center - maxRadius}
                  y1={center}
                  x2={center + maxRadius}
                  y2={center}
                  stroke="#1e293b"
                  strokeWidth="1"
                />

                {/* Degree Tick Ring & Cardinal Azimuth Labels */}
                <g transform={`rotate(${rotationOffset} ${center} ${center})`}>
                  {Array.from({ length: 36 }).map((_, idx) => {
                    const deg = idx * 10;
                    const isMajor = deg % 90 === 0;
                    const isMid = deg % 30 === 0;
                    const rad = ((deg - 90) * Math.PI) / 180;
                    const innerR = maxRadius + (isMajor ? 2 : 4);
                    const outerR = maxRadius + (isMajor ? 10 : isMid ? 8 : 6);
                    return (
                      <line
                        key={deg}
                        x1={center + innerR * Math.cos(rad)}
                        y1={center + innerR * Math.sin(rad)}
                        x2={center + outerR * Math.cos(rad)}
                        y2={center + outerR * Math.sin(rad)}
                        stroke={isMajor ? '#94a3b8' : '#334155'}
                        strokeWidth={isMajor ? '1.5' : '1'}
                      />
                    );
                  })}

                  {[
                    { label: 'N 000°', deg: 0 },
                    { label: 'E 090°', deg: 90 },
                    { label: 'S 180°', deg: 180 },
                    { label: 'W 270°', deg: 270 },
                  ].map((c) => {
                    const rad = ((c.deg - 90) * Math.PI) / 180;
                    const labelR = maxRadius + 22;
                    return (
                      <text
                        key={c.label}
                        x={center + labelR * Math.cos(rad)}
                        y={center + labelR * Math.sin(rad) + 3.5}
                        textAnchor="middle"
                        fill={c.deg === 0 ? '#22d3ee' : '#94a3b8'}
                        fontSize="10.5"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {c.label}
                      </text>
                    );
                  })}
                </g>

                {/* Rotating Radar Sweep Sector */}
                <g style={{ transformOrigin: `${center}px ${center}px` }} className="animate-radar-sweep">
                  <path
                    d={`M ${center} ${center} L ${center} ${center - maxRadius} A ${maxRadius} ${maxRadius} 0 0 1 ${
                      center + maxRadius * Math.sin((52 * Math.PI) / 180)
                    } ${center - maxRadius * Math.cos((52 * Math.PI) / 180)} Z`}
                    fill="url(#sweepGrad)"
                  />
                  <line
                    x1={center}
                    y1={center}
                    x2={center}
                    y2={center - maxRadius}
                    stroke="#22d3ee"
                    strokeOpacity="0.65"
                    strokeWidth="1.25"
                  />
                </g>

                {/* Multi-Hop & Direct Mesh Link Vectors */}
                {peers.map((peer) => {
                  const pt = nodeCoordsMap[peer.id];
                  if (!pt) return null;
                  const viaPt = peer.via ? nodeCoordsMap[peer.via] : null;
                  const isHighlighted =
                    selectedPeer?.id === peer.id ||
                    snapshot.sos_active ||
                    Boolean(peer.telemetry.sos_active);

                  const strokeColor =
                    peer.telemetry.sos_active || (snapshot.sos_active && peer.telemetry.mode === 'rescuer')
                      ? '#ef4444'
                      : snapshot.ack_received && snapshot.ack_by === peer.id
                        ? '#10b981'
                        : '#06b6d4';

                  if (viaPt) {
                    return (
                      <g key={`vec-${peer.id}`}>
                        <line
                          x1={center}
                          y1={center}
                          x2={viaPt.x}
                          y2={viaPt.y}
                          stroke={strokeColor}
                          strokeOpacity={isHighlighted ? 0.55 : 0.22}
                          strokeWidth={isHighlighted ? 1.5 : 1}
                          strokeDasharray="4 4"
                        />
                        <line
                          x1={viaPt.x}
                          y1={viaPt.y}
                          x2={pt.x}
                          y2={pt.y}
                          stroke={strokeColor}
                          strokeOpacity={isHighlighted ? 0.7 : 0.3}
                          strokeWidth={isHighlighted ? 1.6 : 1}
                          strokeDasharray="3 3"
                        />
                      </g>
                    );
                  }

                  return (
                    <line
                      key={`vec-${peer.id}`}
                      x1={center}
                      y1={center}
                      x2={pt.x}
                      y2={pt.y}
                      stroke={strokeColor}
                      strokeOpacity={isHighlighted ? 0.55 : 0.2}
                      strokeWidth={isHighlighted ? 1.4 : 1}
                    />
                  );
                })}

                {/* Local Origin Transceiver */}
                <g>
                  {snapshot.sos_active && (
                    <circle
                      cx={center}
                      cy={center}
                      r="16"
                      fill="#dc2626"
                      fillOpacity="0.22"
                      stroke="#ef4444"
                      strokeWidth="1.2"
                    />
                  )}
                  <circle
                    cx={center}
                    cy={center}
                    r="6"
                    fill={snapshot.sos_active ? '#ef4444' : '#22d3ee'}
                    stroke="#07090e"
                    strokeWidth="2"
                  />
                </g>

                {/* Discovered Peer Blips */}
                {peers.map((peer) => {
                  const pt = nodeCoordsMap[peer.id];
                  if (!pt) return null;
                  const isSelected = selectedPeer?.id === peer.id;
                  const isDistress = Boolean(peer.telemetry.sos_active);
                  const isRescuer = peer.telemetry.mode === 'rescuer';
                  const isRelay = peer.telemetry.mode === 'relay';

                  const nodeColor = isDistress
                    ? '#ef4444'
                    : isRescuer
                      ? '#10b981'
                      : isRelay
                        ? '#f59e0b'
                        : '#38bdf8';

                  return (
                    <g
                      key={peer.id}
                      onClick={() => onSelectPeer(peer.id)}
                      className="cursor-pointer"
                    >
                      {isSelected && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="13"
                          fill="none"
                          stroke="#f8fafc"
                          strokeWidth="1.2"
                          strokeDasharray="3 2"
                        />
                      )}
                      {isDistress && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="15"
                          fill="#ef4444"
                          fillOpacity="0.2"
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="5.5"
                        fill={nodeColor}
                        stroke="#07090e"
                        strokeWidth="1.5"
                      />
                      <text
                        x={pt.x + 9}
                        y={pt.y + 3}
                        fill="#e2e8f0"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {peer.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Clean Unboxed Legend */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/70 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-emerald-400">● Rescuer</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400">▲ Relay Hop</span>
                <span aria-hidden="true">·</span>
                <span className="text-sky-400">◆ Field Node</span>
                <span aria-hidden="true">·</span>
                <span className="text-rose-400">✖ SOS Distress</span>
              </div>
              <span className="font-mono tabular-nums text-slate-500">
                Max TTL: {snapshot.config.ttl_limit} hops
              </span>
            </div>
          </div>

          {/* Right Selected Target & Live Telemetry Readout */}
          <div className="xl:col-span-5 flex flex-col justify-between divide-y divide-slate-800/80">
            {/* Local Transceiver KPIs */}
            <div className="p-5 grid grid-cols-2 gap-y-5 gap-x-4">
              <div>
                <div className="text-xs text-slate-400 mb-1">Rescuer Feedback</div>
                {snapshot.ack_received ? (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>ACK Confirmed ({snapshot.ack_by})</span>
                  </div>
                ) : snapshot.sos_active ? (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-400">
                    <Radio className="w-4 h-4 shrink-0" />
                    <span>Awaiting Rescuer ACK...</span>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-slate-300">Standby Monitoring</div>
                )}
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Multi-Hop Relayed</div>
                <div className="font-mono tabular-nums">
                  <span className="text-xl font-semibold text-slate-100">
                    {snapshot.messages_relayed}
                  </span>
                  <span className="text-xs text-slate-400 ml-1.5">packets</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Dedup Cache Drops</div>
                <div className="font-mono tabular-nums">
                  <span className="text-xl font-semibold text-slate-100">
                    {snapshot.packets_deduped}
                  </span>
                  <span className="text-xs text-slate-400 ml-1.5">loops blocked</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Discovered Mesh Peers</div>
                <div className="font-mono tabular-nums">
                  <span className="text-xl font-semibold text-cyan-400">{peers.length}</span>
                  <span className="text-xs text-slate-400 ml-1.5">in range</span>
                </div>
              </div>
            </div>

            {/* Selected Target Detail Inspector */}
            <div className="p-5 flex-1 flex flex-col justify-between gap-4">
              {selectedPeer ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-100 font-mono truncate">
                        {selectedPeer.id}
                      </h3>
                      <span className="text-xs font-mono text-slate-400 shrink-0">
                        {selectedPeer.ip}
                      </span>
                    </div>

                    {/* Clean Unboxed Metadata */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="capitalize text-slate-200 font-medium">
                        Role: {selectedPeer.telemetry.mode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Blood: <strong className="font-mono text-rose-300">{selectedPeer.telemetry.blood_type || 'O+'}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Battery {selectedPeer.telemetry.battery}%
                      </span>
                    </div>

                    {selectedPeer.telemetry.sos_active && (
                      <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-xs space-y-1">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-rose-300 font-semibold">
                            ✖ STATUS: {selectedPeer.telemetry.medical_status || 'CRITICAL'}
                          </span>
                          <span className="text-slate-300">
                            Blood Type: {selectedPeer.telemetry.blood_type || 'O+'}
                          </span>
                        </div>
                        <p className="text-slate-200">
                          "{selectedPeer.telemetry.sos_note || 'Trapped under debris, need medical assistance.'}"
                        </p>
                      </div>
                    )}

                    {/* Azimuth / Distance / RSSI Grid */}
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/70 font-mono tabular-nums">
                      <div>
                        <div className="text-[11px] font-sans text-slate-400">Bearing</div>
                        <div className="text-sm font-semibold text-slate-100">
                          {String(selectedPeer.bearing_deg).padStart(3, '0')}°{' '}
                          <span className="text-xs text-cyan-400">
                            {formatCardinal(selectedPeer.bearing_deg)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-sans text-slate-400">Range</div>
                        <div className="text-sm font-semibold text-slate-100">
                          {selectedPeer.distance_m}{' '}
                          <span className="text-xs text-slate-400">m</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-sans text-slate-400">Signal RSSI</div>
                        <div className="text-sm font-semibold text-slate-100">
                          {selectedPeer.rssi}{' '}
                          <span className="text-xs text-slate-400">dBm</span>
                        </div>
                      </div>
                    </div>

                    {/* Route Path */}
                    <div className="pt-2 border-t border-slate-800/70 text-xs">
                      <span className="text-slate-400">Active Hop Vector: </span>
                      <span className="font-mono text-cyan-300">
                        {snapshot.node_id}
                        {selectedPeer.via ? ` → ${selectedPeer.via}` : ''} → {selectedPeer.id}
                      </span>
                    </div>
                  </div>

                  {/* Target Interactive Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => onPingPeer(selectedPeer.id)}
                      className="px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                      Ping Link
                    </button>

                    {(snapshot.mode === 'rescuer' || selectedPeer.telemetry.sos_active) && (
                      <button
                        type="button"
                        onClick={() => onDispatchAck(selectedPeer.id)}
                        className="px-3.5 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Dispatch ACK
                      </button>
                    )}

                    {selectedPeer.telemetry.mode !== 'rescuer' &&
                      !selectedPeer.telemetry.sos_active && (
                        <button
                          type="button"
                          onClick={() => onTriggerPeerSos(selectedPeer.id)}
                          className="px-3.5 py-2 text-xs font-medium bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 border border-rose-800/60 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          Test Peer SOS
                        </button>
                      )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400 py-8 text-center">
                  No peer selected. Broadcast a beacon or deploy a field node to inspect link paths.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Discovered Mesh Peers High-Density Table */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/90">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Discovered Ad-Hoc Mesh Peers ({filteredPeers.length})
            </h3>
          </div>
          <input
            type="search"
            value={peerSearch}
            onChange={(e) => setPeerSearch(e.target.value)}
            placeholder="Filter by node ID, IP, or role..."
            className="px-3 py-1.5 text-xs bg-[#07090E] border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-60"
          />
        </div>

        {filteredPeers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No mesh peers match your current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 px-5">Node Identifier</th>
                  <th className="py-2.5 px-4">Role &amp; Subnet IP</th>
                  <th className="py-2.5 px-4 text-right">Azimuth &amp; Range</th>
                  <th className="py-2.5 px-4 text-right">Signal RSSI</th>
                  <th className="py-2.5 px-4">Hop Route</th>
                  <th className="py-2.5 px-4">Link Status</th>
                  <th className="py-2.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredPeers.map((peer) => {
                  const sig = getSignalLabel(peer.rssi);
                  const isSelected = selectedPeer?.id === peer.id;
                  return (
                    <tr
                      key={peer.id}
                      onClick={() => onSelectPeer(peer.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-950/20' : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-3 px-5 font-mono font-medium text-slate-100 whitespace-nowrap">
                        {peer.id}
                      </td>
                      <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                        <span className="capitalize">{peer.telemetry.mode}</span>
                        <span className="mx-1.5 text-slate-600">·</span>
                        <span className="font-mono text-slate-400">{peer.ip}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        {String(peer.bearing_deg).padStart(3, '0')}° {formatCardinal(peer.bearing_deg)} ·{' '}
                        {peer.distance_m} m
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className={sig.color}>{sig.glyph}</span>{' '}
                        <span className="text-slate-100">{peer.rssi} dBm</span>{' '}
                        <span className="text-slate-500">({sig.text})</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {peer.hops === 1 ? 'Direct (1 hop)' : `2 hops via ${peer.via}`}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {peer.telemetry.sos_active ? (
                          <span className="text-rose-400 font-medium">✖ SOS Distress</span>
                        ) : peer.ack_ready ? (
                          <span className="text-emerald-400 font-medium">✓ ACK Ready</span>
                        ) : (
                          <span className="text-slate-300">● Standby Relay</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {peer.telemetry.sos_active ? (
                          <button
                            type="button"
                            onClick={() => onDispatchAck(peer.id)}
                            className="px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            Send ACK
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onPingPeer(peer.id)}
                            className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            Ping
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
