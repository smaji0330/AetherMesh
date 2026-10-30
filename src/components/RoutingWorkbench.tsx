import React, { useState, useMemo } from 'react';
import { Network, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import type { MeshSnapshot, NodeMode, PacketType } from '../types/mesh';

interface RoutingWorkbenchProps {
  snapshot: MeshSnapshot;
  onSpawnPeer: (params: {
    id?: string;
    mode: NodeMode;
    bearing_deg: number;
    distance_m: number;
    hardware: string;
  }) => void;
  onRemovePeer: (id: string) => void;
  onTriggerPeerSos: (id: string) => void;
  onClearPackets: () => void;
  onUpdateConfig: (params: {
    ttl_limit?: number;
    auto_ack?: boolean;
    auto_relay?: boolean;
  }) => void;
}

export const RoutingWorkbench: React.FC<RoutingWorkbenchProps> = ({
  snapshot,
  onSpawnPeer,
  onRemovePeer,
  onTriggerPeerSos,
  onClearPackets,
  onUpdateConfig,
}) => {
  const [newNodeId, setNewNodeId] = useState<string>('');
  const [newRole, setNewRole] = useState<NodeMode>('relay');
  const [newBearing, setNewBearing] = useState<number>(135);
  const [newDistance, setNewDistance] = useState<number>(280);
  const [newHardware, setNewHardware] = useState<string>('ESP32-WROOM Ad-Hoc Node');
  const [pktFilter, setPktFilter] = useState<'ALL' | PacketType>('ALL');

  const peers = useMemo(() => Object.values(snapshot.nodes_discovered), [snapshot.nodes_discovered]);
  const directPeers = useMemo(() => peers.filter((p) => p.hops === 1), [peers]);
  const multiHopPeers = useMemo(() => peers.filter((p) => p.hops > 1), [peers]);

  const filteredPackets = useMemo(() => {
    if (pktFilter === 'ALL') return snapshot.packets;
    return snapshot.packets.filter((p) => p.type === pktFilter);
  }, [snapshot.packets, pktFilter]);

  const handleDeployNode = (e: React.FormEvent) => {
    e.preventDefault();
    onSpawnPeer({
      id: newNodeId.trim() || undefined,
      mode: newRole,
      bearing_deg: newBearing,
      distance_m: newDistance,
      hardware: newHardware,
    });
    setNewNodeId('');
  };

  const formatTime = (epochSec: number) => {
    const d = new Date(epochSec * 1000);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Architecture & Store-and-Forward Topology Visualizer */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/90">
          <div className="flex items-center gap-2.5">
            <Network className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-100">
              Multi-Hop Store-and-Forward Topology &amp; Subnet Bridge
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono tabular-nums">
            <span>Interface: {snapshot.subnet.interface_name}</span>
            <span aria-hidden="true">·</span>
            <span>Broadcast: {snapshot.subnet.broadcast_ip}:{snapshot.config.port}</span>
            <span aria-hidden="true">·</span>
            <span>
              UDP Socket: {snapshot.subnet.udp_bound ? '✓ Bound' : '● Virtualized Bridge'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-800/80">
          {/* Interactive Topology Canvas */}
          <div className="xl:col-span-8 p-5 bg-[#090D14]">
            <svg
              viewBox="0 0 720 270"
              className="w-full h-auto select-none"
              role="img"
              aria-label="Multi-Hop Mesh Network Topology Graph"
            >
              {/* Column Headers */}
              <text x="95" y="24" fill="#94a3b8" fontSize="11" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600" textAnchor="middle">
                Local Transceiver (TTL {snapshot.config.ttl_limit})
              </text>
              <text x="355" y="24" fill="#94a3b8" fontSize="11" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600" textAnchor="middle">
                1-Hop Direct Air Layer ({directPeers.length})
              </text>
              <text x="615" y="24" fill="#94a3b8" fontSize="11" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600" textAnchor="middle">
                2-Hop Extended Reach ({multiHopPeers.length})
              </text>

              {/* Edges: Local -> Direct Peers */}
              {directPeers.map((dp, idx) => {
                const y = 72 + idx * Math.min(68, 175 / Math.max(1, directPeers.length));
                return (
                  <g key={`edge-d-${dp.id}`}>
                    <line
                      x1="160"
                      y1="140"
                      x2="285"
                      y2={y}
                      stroke="#06b6d4"
                      strokeOpacity="0.55"
                      strokeWidth="1.5"
                    />
                    <text
                      x="222"
                      y={(140 + y) / 2 - 5}
                      fill="#64748b"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      {dp.rssi} dBm
                    </text>
                  </g>
                );
              })}

              {/* Edges: Direct Relay -> Multi-Hop Peers */}
              {multiHopPeers.map((mp, idx) => {
                const targetY = 72 + idx * Math.min(68, 175 / Math.max(1, multiHopPeers.length));
                const viaIdx = directPeers.findIndex((d) => d.id === mp.via);
                const sourceY =
                  viaIdx >= 0
                    ? 72 + viaIdx * Math.min(68, 175 / Math.max(1, directPeers.length))
                    : 140;
                const sourceX = viaIdx >= 0 ? 425 : 160;

                return (
                  <g key={`edge-m-${mp.id}`}>
                    <line
                      x1={sourceX}
                      y1={sourceY}
                      x2="545"
                      y2={targetY}
                      stroke={mp.telemetry.mode === 'rescuer' ? '#10b981' : '#f59e0b'}
                      strokeOpacity="0.65"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={(sourceX + 545) / 2}
                      y={(sourceY + targetY) / 2 - 5}
                      fill="#94a3b8"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      TTL -1 ({mp.rssi} dBm)
                    </text>
                  </g>
                );
              })}

              {/* Local Node Box */}
              <g>
                <rect
                  x="30"
                  y="112"
                  width="130"
                  height="56"
                  rx="8"
                  fill="#0e131d"
                  stroke={snapshot.sos_active ? '#ef4444' : '#22d3ee'}
                  strokeWidth="1.5"
                />
                <text x="95" y="135" fill="#f8fafc" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="600" textAnchor="middle">
                  {snapshot.node_id}
                </text>
                <text x="95" y="153" fill="#94a3b8" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
                  {snapshot.subnet.local_ip}
                </text>
              </g>

              {/* 1-Hop Direct Nodes */}
              {directPeers.map((dp, idx) => {
                const y = 72 + idx * Math.min(68, 175 / Math.max(1, directPeers.length));
                return (
                  <g key={`node-d-${dp.id}`}>
                    <rect
                      x="285"
                      y={y - 22}
                      width="140"
                      height="44"
                      rx="7"
                      fill="#0e131d"
                      stroke={dp.telemetry.mode === 'relay' ? '#f59e0b' : '#38bdf8'}
                      strokeWidth="1.2"
                    />
                    <text x="355" y={y - 3} fill="#f1f5f9" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fontWeight="600" textAnchor="middle">
                      {dp.id}
                    </text>
                    <text x="355" y={y + 12} fill="#94a3b8" fontSize="9.5" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
                      {dp.telemetry.mode.toUpperCase()} · {dp.distance_m}m
                    </text>
                  </g>
                );
              })}

              {/* 2-Hop Relayed Nodes */}
              {multiHopPeers.map((mp, idx) => {
                const y = 72 + idx * Math.min(68, 175 / Math.max(1, multiHopPeers.length));
                const stroke = mp.telemetry.sos_active
                  ? '#ef4444'
                  : mp.telemetry.mode === 'rescuer'
                    ? '#10b981'
                    : '#64748b';
                return (
                  <g key={`node-m-${mp.id}`}>
                    <rect
                      x="545"
                      y={y - 22}
                      width="145"
                      height="44"
                      rx="7"
                      fill="#0e131d"
                      stroke={stroke}
                      strokeWidth="1.3"
                    />
                    <text x="617" y={y - 3} fill="#f1f5f9" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fontWeight="600" textAnchor="middle">
                      {mp.id}
                    </text>
                    <text x="617" y={y + 12} fill="#94a3b8" fontSize="9.5" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
                      {mp.telemetry.mode.toUpperCase()} · {mp.distance_m}m
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Routing Engine Parameters Bar */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={snapshot.config.auto_relay}
                    onChange={(e) => onUpdateConfig({ auto_relay: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                  <span>Store-and-Forward Relay</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={snapshot.config.auto_ack}
                    onChange={(e) => onUpdateConfig({ auto_ack: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                  <span>Automatic Rescuer ACK</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400">Hop TTL Limit:</span>
                <div className="flex items-center gap-1 p-0.5 bg-[#0E131D] border border-slate-800 rounded-md font-mono">
                  {[2, 4, 6].map((ttl) => (
                    <button
                      key={ttl}
                      type="button"
                      onClick={() => onUpdateConfig({ ttl_limit: ttl })}
                      className={`px-2 py-0.5 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                        snapshot.config.ttl_limit === ttl
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {ttl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Spawn Field Node Form */}
          <form onSubmit={handleDeployNode} className="xl:col-span-4 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3.5">
              <h3 className="text-sm font-semibold text-slate-100">Deploy Virtual Field Node</h3>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Node Identifier (Optional)</label>
                <input
                  type="text"
                  value={newNodeId}
                  onChange={(e) => setNewNodeId(e.target.value)}
                  placeholder="e.g. ESP32_Roof_08"
                  className="w-full px-3 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Mesh Role</label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-lg">
                  {(['relay', 'rescuer', 'victim'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      className={`py-1 text-xs font-medium capitalize rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        newRole === r
                          ? 'bg-slate-800 text-slate-100'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Azimuth</span>
                    <span className="font-mono tabular-nums text-slate-200">{newBearing}°</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    value={newBearing}
                    onChange={(e) => setNewBearing(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
                <div>
                  <label className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Distance</span>
                    <span className="font-mono tabular-nums text-slate-200">{newDistance} m</span>
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={850}
                    step={10}
                    value={newDistance}
                    onChange={(e) => setNewDistance(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Hardware Transceiver Profile</label>
                <select
                  value={newHardware}
                  onChange={(e) => setNewHardware(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#07090E] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ESP32-WROOM Ad-Hoc Node">ESP32-WROOM Ad-Hoc Node</option>
                  <option value="Arduino Nano + ESP8266 UDP">Arduino Nano + ESP8266 UDP</option>
                  <option value="Python CLI Hotspot Laptop">Python CLI Hotspot Laptop</option>
                  <option value="Android Wi-Fi Direct Handset">Android Wi-Fi Direct Handset</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Deploy Node to Subnet
            </button>
          </form>
        </div>

        {/* Active Peer Management Strip */}
        {peers.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">Field Node Fault &amp; SOS Injection:</span>
            <div className="flex flex-wrap items-center gap-2">
              {peers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 bg-[#07090E] border border-slate-800 rounded-lg px-2.5 py-1"
                >
                  <span className="font-mono text-slate-200">{p.id}</span>
                  <button
                    type="button"
                    onClick={() => onTriggerPeerSos(p.id)}
                    title="Simulate SOS packet from this node"
                    className="text-rose-400 hover:text-rose-300 px-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePeer(p.id)}
                    title="Remove node from mesh registry"
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Packet Handler & SEEN_PACKET_IDS Deduplication Wire Log */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/90">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              UDP Wire Packet Log &amp; Deduplication Cache ({snapshot.seen_cache_size} UUIDs cached)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-lg">
              {(['ALL', 'SOS', 'ACK', 'RELAY', 'BEACON', 'PING'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPktFilter(type)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    pktFilter === type
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClearPackets}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Clear Cache
            </button>
          </div>
        </div>

        {filteredPackets.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No packets captured in this filter category yet. Trigger an SOS broadcast or ping a peer to inspect wire frames.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0E131D] z-10">
                <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 px-5">Time</th>
                  <th className="py-2.5 px-4">Packet UUID</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Hop Trace</th>
                  <th className="py-2.5 px-4 text-right">TTL</th>
                  <th className="py-2.5 px-4 text-right">Dedup Drops</th>
                  <th className="py-2.5 px-5">Frame Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono tabular-nums">
                {filteredPackets.map((pkt) => {
                  const typeTone =
                    pkt.type === 'SOS'
                      ? 'text-rose-400 font-semibold'
                      : pkt.type === 'ACK'
                        ? 'text-emerald-400 font-semibold'
                        : pkt.type === 'RELAY'
                          ? 'text-amber-400'
                          : 'text-cyan-400';

                  return (
                    <tr key={pkt.packet_id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-5 text-slate-400 whitespace-nowrap">
                        {formatTime(pkt.timestamp)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                        {pkt.packet_id.slice(0, 12)}
                      </td>
                      <td className={`py-2.5 px-4 whitespace-nowrap ${typeTone}`}>{pkt.type}</td>
                      <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                        {pkt.hops.join(' → ')}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-300 whitespace-nowrap">
                        {pkt.ttl}/{pkt.max_ttl}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {pkt.dedup_count > 0 ? (
                          <span className="text-amber-400">{pkt.dedup_count} blocked</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-5 font-sans text-slate-300">
                        {pkt.payload_summary}
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
