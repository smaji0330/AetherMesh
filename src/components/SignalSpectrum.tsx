import React, { useState, useRef, useMemo } from 'react';
import { Activity, Radio } from 'lucide-react';
import type { MeshSnapshot } from '../types/mesh';

interface SignalSpectrumProps {
  snapshot: MeshSnapshot;
  onPingPeer: (id: string) => void;
}

export const SignalSpectrum: React.FC<SignalSpectrumProps> = ({ snapshot, onPingPeer }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const points = snapshot.spectrum;
  const peers = useMemo(
    () => Object.values(snapshot.nodes_discovered).sort((a, b) => b.rssi - a.rssi),
    [snapshot.nodes_discovered]
  );

  const width = 760;
  const height = 250;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const minDbm = -100;
  const maxDbm = -30;

  const yForDbm = (dbm: number) => {
    const clamped = Math.max(minDbm, Math.min(maxDbm, dbm));
    const ratio = (clamped - minDbm) / (maxDbm - minDbm);
    return padTop + plotH * (1 - ratio);
  };

  const xForIndex = (idx: number) => {
    if (points.length <= 1) return padLeft;
    return padLeft + (idx / (points.length - 1)) * plotW;
  };

  const strongestPath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(1)} ${yForDbm(pt.strongest_rssi_dbm).toFixed(1)}`)
      .join(' ');
  }, [points]);

  const strongestArea = useMemo(() => {
    if (points.length < 2) return '';
    const firstX = xForIndex(0).toFixed(1);
    const lastX = xForIndex(points.length - 1).toFixed(1);
    const baseY = (padTop + plotH).toFixed(1);
    return `${strongestPath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [strongestPath, points.length]);

  const avgPath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(1)} ${yForDbm(pt.avg_rssi_dbm).toFixed(1)}`)
      .join(' ');
  }, [points]);

  const noisePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(1)} ${yForDbm(pt.noise_floor_dbm).toFixed(1)}`)
      .join(' ');
  }, [points]);

  const handleChartMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    if (svgX < padLeft || svgX > width - padRight) {
      setHoverIdx(null);
      return;
    }
    const ratio = (svgX - padLeft) / plotW;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
    setHoverIdx(idx);
  };

  const activePoint = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1] || null;

  return (
    <div className="flex flex-col gap-6">
      {/* Dual-Curve RF RSSI & Noise Floor Time-Series */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/90">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-100">
              2.4 GHz Ad-Hoc RSSI Attenuation &amp; SNR Waveform
            </h2>
          </div>

          {activePoint && (
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-300">
              <span>
                Peak: <strong className="text-cyan-400">{activePoint.strongest_rssi_dbm} dBm</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Mean: <strong className="text-amber-400">{activePoint.avg_rssi_dbm} dBm</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                SNR: <strong className="text-emerald-400">+{activePoint.snr_db} dB</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400">
                {new Date(activePoint.timestamp).toLocaleTimeString([], {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>

        <div className="p-5 bg-[#090D14]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={handleChartMove}
            onMouseLeave={() => setHoverIdx(null)}
            className="w-full h-auto cursor-crosshair select-none"
            role="img"
            aria-label="RF RSSI Signal Strength Waveform Chart"
          >
            <defs>
              <linearGradient id="rssiFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal dBm Grid Lines */}
            {[-40, -55, -70, -85, -96].map((dbm) => {
              const y = yForDbm(dbm);
              return (
                <g key={dbm}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray={dbm === -96 ? '2 3' : undefined}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {dbm} dBm
                  </text>
                </g>
              );
            })}

            {/* Area & Curves */}
            {strongestArea && <path d={strongestArea} fill="url(#rssiFill)" />}
            {noisePath && (
              <path
                d={noisePath}
                fill="none"
                stroke="#475569"
                strokeWidth="1.2"
                strokeDasharray="2 4"
              />
            )}
            {avgPath && (
              <path
                d={avgPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.6"
                strokeDasharray="5 3"
              />
            )}
            {strongestPath && (
              <path d={strongestPath} fill="none" stroke="#22d3ee" strokeWidth="2" />
            )}

            {/* Interactive Crosshair Probe */}
            {hoverIdx !== null && points[hoverIdx] && (
              <g>
                <line
                  x1={xForIndex(hoverIdx)}
                  y1={padTop}
                  x2={xForIndex(hoverIdx)}
                  y2={padTop + plotH}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={xForIndex(hoverIdx)}
                  cy={yForDbm(points[hoverIdx].strongest_rssi_dbm)}
                  r="4"
                  fill="#22d3ee"
                  stroke="#07090e"
                  strokeWidth="1.5"
                />
                <circle
                  cx={xForIndex(hoverIdx)}
                  cy={yForDbm(points[hoverIdx].avg_rssi_dbm)}
                  r="3.5"
                  fill="#f59e0b"
                  stroke="#07090e"
                  strokeWidth="1.5"
                />
              </g>
            )}
          </svg>

          <div className="mt-2 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-cyan-400">— Peak Peer Link (dBm)</span>
              <span className="text-amber-400">-- Mesh Mean RSSI (dBm)</span>
              <span className="text-slate-400">·· Thermal Noise Floor (-96 dBm)</span>
            </div>
            <span className="font-mono tabular-nums">
              TX Frames: {snapshot.tx_packets} · RX Frames: {snapshot.rx_packets}
            </span>
          </div>
        </div>
      </section>

      {/* Per-Peer Link Budget Calibration Table */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Per-Node Link Budget &amp; Attenuation Matrix
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            Receiver Sensitivity Threshold: -90 dBm
          </span>
        </div>

        {peers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No active radio links detected on subnet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 px-5">Peer Node</th>
                  <th className="py-2.5 px-4">Hardware Radio</th>
                  <th className="py-2.5 px-4 text-right">Distance</th>
                  <th className="py-2.5 px-4 text-right">RSSI</th>
                  <th className="py-2.5 px-4 text-right">SNR</th>
                  <th className="py-2.5 px-4 w-48">Link Margin (-90 dBm Floor)</th>
                  <th className="py-2.5 px-5 text-right">Test</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {peers.map((peer) => {
                  const marginDb = Math.max(0, peer.rssi - -90);
                  const pct = Math.max(6, Math.min(100, Math.round(((peer.rssi + 95) / 60) * 100)));
                  const barColor =
                    peer.rssi >= -60
                      ? 'bg-emerald-400'
                      : peer.rssi >= -76
                        ? 'bg-cyan-400'
                        : 'bg-amber-400';

                  return (
                    <tr key={peer.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-5 font-mono font-medium text-slate-100 whitespace-nowrap">
                        {peer.id}
                      </td>
                      <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                        {peer.telemetry.hardware || '2.4 GHz Wi-Fi Transceiver'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                        {peer.distance_m} m
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100 font-semibold whitespace-nowrap">
                        {peer.rssi} dBm
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400 whitespace-nowrap">
                        +{peer.snr} dB
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${barColor} rounded-full`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-slate-400 w-12 text-right">
                            +{marginDb} dB
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onPingPeer(peer.id)}
                          className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                        >
                          Probe
                        </button>
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
