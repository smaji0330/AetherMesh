import express from 'express';
import http from 'http';
import dgram from 'dgram';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type NodeMode = 'victim' | 'rescuer' | 'relay';
type PacketType = 'SOS' | 'ACK' | 'BEACON' | 'RELAY' | 'PING';
type MedicalStatus = 'CRITICAL' | 'URGENT' | 'STABLE' | 'STANDBY';
type BloodType = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';

interface MedicalEmergencyPayload {
  node_id: string;
  status: MedicalStatus;
  blood_type: BloodType;
  gps_last_known: [number, number];
  message: string;
}

interface PeerTelemetry {
  lat: number;
  lon: number;
  battery: number;
  mode: NodeMode;
  hardware?: string;
  sos_active?: boolean;
  sos_category?: string;
  sos_note?: string;
  medical_status?: MedicalStatus;
  blood_type?: BloodType;
  medical_payload?: MedicalEmergencyPayload;
}

interface DiscoveredNode {
  id: string;
  ip: string;
  last_seen: number;
  telemetry: PeerTelemetry;
  type: PacketType;
  rssi: number;
  snr: number;
  distance_m: number;
  bearing_deg: number;
  hops: number;
  via: string | null;
  ack_ready: boolean;
  source: 'udp' | 'field';
}

interface PacketRecord {
  packet_id: string;
  origin: string;
  target?: string;
  type: PacketType;
  ttl: number;
  max_ttl: number;
  hops: string[];
  rssi: number;
  snr: number;
  timestamp: number;
  relayed: boolean;
  dedup_count: number;
  payload_summary: string;
}

interface SpectrumPoint {
  timestamp: number;
  noise_floor_dbm: number;
  avg_rssi_dbm: number;
  strongest_rssi_dbm: number;
  snr_db: number;
  packets_per_window: number;
  peer_rssi: Record<string, number>;
}

interface SubnetInfo {
  interface_name: string;
  local_ip: string;
  netmask: string;
  broadcast_ip: string;
  transport_layer: string;
  udp_bound: boolean;
  udp_port: number;
}

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => ((acc << 8) + parseInt(oct, 10)) >>> 0, 0);
}

function intToIp(intVal: number): string {
  return [
    (intVal >>> 24) & 255,
    (intVal >>> 16) & 255,
    (intVal >>> 8) & 255,
    intVal & 255,
  ].join('.');
}

function detectSubnet(udpPort: number, overrideBcast?: string): SubnetInfo {
  const nets = os.networkInterfaces();
  let chosen: { name: string; address: string; netmask: string } | null = null;

  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        if (addr.address.startsWith('192.168.43.') || addr.address.startsWith('192.168.49.')) {
          chosen = { name, address: addr.address, netmask: addr.netmask };
          break;
        }
        if (!chosen) {
          chosen = { name, address: addr.address, netmask: addr.netmask };
        }
      }
    }
  }

  if (!chosen) {
    return {
      interface_name: 'wlan0 (Ad-Hoc Fallback)',
      local_ip: '192.168.43.101',
      netmask: '255.255.255.0',
      broadcast_ip: overrideBcast || '255.255.255.255',
      transport_layer: 'Local Wi-Fi Hotspot / P2P Broadcast',
      udp_bound: false,
      udp_port: udpPort,
    };
  }

  const ipInt = ipToInt(chosen.address);
  const maskInt = ipToInt(chosen.netmask || '255.255.255.0');
  const bcastInt = (ipInt | (~maskInt >>> 0)) >>> 0;
  const computedBcast = overrideBcast || intToIp(bcastInt);

  let transport = 'LAN / Local Wi-Fi Subnet';
  if (chosen.address.startsWith('192.168.43.')) {
    transport = 'Android / Mobile Hotspot (192.168.43.x)';
  } else if (chosen.address.startsWith('192.168.49.')) {
    transport = 'Wi-Fi Direct (P2P Group Owner)';
  }

  return {
    interface_name: chosen.name,
    local_ip: chosen.address,
    netmask: chosen.netmask,
    broadcast_ip: computedBcast,
    transport_layer: transport,
    udp_bound: false,
    udp_port: udpPort,
  };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

function estimateLinkBudget(distanceM: number, hops: number): { rssi: number; snr: number } {
  const effectiveDist = Math.max(8, hops > 1 ? distanceM * 0.58 : distanceM);
  const pathLoss = 40.0 + 22.0 * Math.log10(effectiveDist);
  const jitter = (Math.random() - 0.5) * 2.4;
  const rssi = Math.max(-94, Math.min(-34, Math.round(18 - pathLoss + jitter)));
  const noiseFloor = -96;
  const snr = Math.max(2, rssi - noiseFloor);
  return { rssi, snr };
}

const UDP_PORT = parseInt(process.env.MESH_UDP_PORT || '5005', 10);
const SUBNET = detectSubnet(UDP_PORT, process.env.MESH_BROADCAST_IP || undefined);

const CONFIG = {
  port: UDP_PORT,
  broadcast_ip: SUBNET.broadcast_ip,
  beacon_interval_ms: 2500,
  ttl_limit: 4,
  auto_ack: true,
  auto_relay: true,
};

const STATE = {
  node_id: process.env.MESH_NODE_ID || 'Subhajit_Device_01',
  mode: ((process.env.MESH_DEFAULT_MODE as NodeMode) || 'victim') as NodeMode,
  sos_active: false,
  sos_category: 'Medical / Structural Collapse',
  sos_note: 'Trapped under debris, need medical assistance.',
  medical_status: 'CRITICAL' as MedicalStatus,
  blood_type: 'O+' as BloodType,
  battery: 87,
  latitude: 13.0827,
  longitude: 80.2707,
  heading: 0,
  nodes_discovered: {} as Record<string, DiscoveredNode>,
  ack_received: false,
  ack_by: null as string | null,
  ack_timestamp: null as number | null,
  messages_relayed: 0,
  packets_deduped: 0,
  tx_packets: 0,
  rx_packets: 0,
};

const SEEN_PACKET_IDS = new Map<string, PacketRecord>();
const PACKET_LOG: PacketRecord[] = [];
const SPECTRUM_HISTORY: SpectrumPoint[] = [];
let recentWindowPackets = 0;

function seedInitialFieldPeers() {
  const baseLat = STATE.latitude;
  const baseLon = STATE.longitude;
  const initialPeers: Array<{
    id: string;
    ip: string;
    dLat: number;
    dLon: number;
    battery: number;
    mode: NodeMode;
    hardware: string;
    hops: number;
    via: string | null;
    type: PacketType;
  }> = [
    {
      id: 'Relay_Howrah_02',
      ip: '192.168.43.102',
      dLat: 0.00125,
      dLon: 0.00068,
      battery: 94,
      mode: 'relay',
      hardware: 'ESP32-WROOM + Dipole',
      hops: 1,
      via: null,
      type: 'BEACON',
    },
    {
      id: 'ESP32_Beacon_04',
      ip: '192.168.43.104',
      dLat: -0.00115,
      dLon: 0.00155,
      battery: 79,
      mode: 'relay',
      hardware: 'ESP32 Solar Repeater',
      hops: 1,
      via: null,
      type: 'BEACON',
    },
    {
      id: 'Rescuer_Alpha_09',
      ip: '192.168.43.109',
      dLat: 0.00265,
      dLon: 0.00215,
      battery: 96,
      mode: 'rescuer',
      hardware: 'Python Tactical Laptop',
      hops: 2,
      via: 'Relay_Howrah_02',
      type: 'BEACON',
    },
    {
      id: 'Node_ParkSt_12',
      ip: '192.168.43.112',
      dLat: -0.00185,
      dLon: -0.00175,
      battery: 42,
      mode: 'victim',
      hardware: 'Android Wi-Fi Direct',
      hops: 2,
      via: 'ESP32_Beacon_04',
      type: 'BEACON',
    },
  ];

  const now = Date.now() / 1000;
  for (const p of initialPeers) {
    const lat = Number((baseLat + p.dLat).toFixed(6));
    const lon = Number((baseLon + p.dLon).toFixed(6));
    const dist = haversineMeters(baseLat, baseLon, lat, lon);
    const bearing = calculateBearing(baseLat, baseLon, lat, lon);
    const { rssi, snr } = estimateLinkBudget(dist, p.hops);

    const bloodTypes: BloodType[] = ['O+', 'A+', 'B+', 'O-'];
    const peerBlood = bloodTypes[initialPeers.indexOf(p) % bloodTypes.length];
    STATE.nodes_discovered[p.id] = {
      id: p.id,
      ip: p.ip,
      last_seen: now,
      telemetry: {
        lat,
        lon,
        battery: p.battery,
        mode: p.mode,
        hardware: p.hardware,
        sos_active: false,
        blood_type: peerBlood,
        medical_status: 'STANDBY',
      },
      type: p.type,
      rssi,
      snr,
      distance_m: dist,
      bearing_deg: bearing,
      hops: p.hops,
      via: p.via,
      ack_ready: p.mode === 'rescuer',
      source: 'field',
    };
  }
}

function recomputePeerGeometry() {
  for (const peer of Object.values(STATE.nodes_discovered)) {
    const dist = haversineMeters(
      STATE.latitude,
      STATE.longitude,
      peer.telemetry.lat,
      peer.telemetry.lon
    );
    const bearing = calculateBearing(
      STATE.latitude,
      STATE.longitude,
      peer.telemetry.lat,
      peer.telemetry.lon
    );
    const autoHops = dist > 260 ? 2 : 1;
    if (peer.source === 'field') {
      peer.hops = autoHops;
      if (autoHops > 1) {
        const relays = Object.values(STATE.nodes_discovered).filter(
          (n) => n.id !== peer.id && n.telemetry.mode === 'relay'
        );
        if (relays.length > 0) {
          relays.sort((a, b) => a.distance_m - b.distance_m);
          peer.via = relays[0].id;
        }
      } else {
        peer.via = null;
      }
    }
    const { rssi, snr } = estimateLinkBudget(dist, peer.hops);
    peer.distance_m = dist;
    peer.bearing_deg = bearing;
    peer.rssi = rssi;
    peer.snr = snr;
  }
}

seedInitialFieldPeers();

// Initialize 24 historical spectrum points so chart renders populated immediately
for (let i = 24; i >= 1; i--) {
  const ts = Date.now() - i * 2000;
  const peerRssi: Record<string, number> = {};
  let sum = 0;
  let count = 0;
  let strongest = -95;
  for (const peer of Object.values(STATE.nodes_discovered)) {
    const sample = Math.max(-94, Math.min(-35, peer.rssi + Math.round((Math.random() - 0.5) * 3)));
    peerRssi[peer.id] = sample;
    sum += sample;
    count++;
    if (sample > strongest) strongest = sample;
  }
  const avg = count > 0 ? Math.round(sum / count) : -85;
  SPECTRUM_HISTORY.push({
    timestamp: ts,
    noise_floor_dbm: -96 + Math.round((Math.random() - 0.5) * 2),
    avg_rssi_dbm: avg,
    strongest_rssi_dbm: strongest,
    snr_db: Math.max(0, avg - -96),
    packets_per_window: Math.floor(Math.random() * 3) + 1,
    peer_rssi: peerRssi,
  });
}

// --- WebSocket Broadcast Registry ---
const wsClients = new Set<WebSocket>();

function broadcastWs(event: string, data: unknown) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function buildMedicalPayload(): MedicalEmergencyPayload {
  return {
    node_id: STATE.node_id,
    status: STATE.medical_status,
    blood_type: STATE.blood_type,
    gps_last_known: [STATE.latitude, STATE.longitude],
    message: STATE.sos_note,
  };
}

function buildSnapshot() {
  return {
    ...STATE,
    medical_payload: buildMedicalPayload(),
    config: CONFIG,
    subnet: SUBNET,
    packets: PACKET_LOG.slice(0, 80),
    spectrum: SPECTRUM_HISTORY.slice(-36),
    seen_cache_size: SEEN_PACKET_IDS.size,
  };
}

function recordPacket(pkt: PacketRecord): boolean {
  recentWindowPackets += 1;
  const existing = SEEN_PACKET_IDS.get(pkt.packet_id);
  if (existing) {
    existing.dedup_count += 1;
    STATE.packets_deduped += 1;
    broadcastWs('packet:dedup', {
      packet_id: pkt.packet_id,
      dedup_count: existing.dedup_count,
      packets_deduped: STATE.packets_deduped,
    });
    return false;
  }

  SEEN_PACKET_IDS.set(pkt.packet_id, pkt);
  if (SEEN_PACKET_IDS.size > 300) {
    const oldestKey = SEEN_PACKET_IDS.keys().next().value;
    if (oldestKey) SEEN_PACKET_IDS.delete(oldestKey);
  }

  PACKET_LOG.unshift(pkt);
  if (PACKET_LOG.length > 100) {
    PACKET_LOG.pop();
  }
  broadcastWs('packet:logged', pkt);
  return true;
}

// --- Real UDP Socket Transceiver ---
const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

function transmitUdpPacket(rawPacket: Record<string, unknown>) {
  if (!SUBNET.udp_bound) return;
  try {
    const buf = Buffer.from(JSON.stringify(rawPacket), 'utf-8');
    udpSocket.send(buf, 0, buf.length, CONFIG.port, CONFIG.broadcast_ip);
  } catch {
    // Non-fatal in restricted container network
  }
}

udpSocket.on('error', () => {
  SUBNET.udp_bound = false;
});

udpSocket.on('message', (msg, rinfo) => {
  try {
    const parsed = JSON.parse(msg.toString('utf-8'));
    const pktId = String(parsed.packet_id || crypto.randomUUID());
    const origin = String(parsed.origin || `UDP_${rinfo.address}`);
    const msgType = (parsed.type || 'BEACON') as PacketType;

    // Ignore direct self-loopback unless already relayed by another hop
    const hops: string[] = Array.isArray(parsed.hops) ? parsed.hops : [origin];
    if (origin === STATE.node_id && hops.length <= 1) {
      return;
    }

    const telemetry = parsed.telemetry || {};
    const lat = Number(telemetry.lat ?? STATE.latitude + 0.0008);
    const lon = Number(telemetry.lon ?? STATE.longitude + 0.0008);
    const dist = haversineMeters(STATE.latitude, STATE.longitude, lat, lon);
    const bearing = calculateBearing(STATE.latitude, STATE.longitude, lat, lon);
    const { rssi, snr } = estimateLinkBudget(dist, hops.length);

    const record: PacketRecord = {
      packet_id: pktId,
      origin,
      target: parsed.target ? String(parsed.target) : undefined,
      type: msgType,
      ttl: Number(parsed.ttl ?? CONFIG.ttl_limit),
      max_ttl: CONFIG.ttl_limit,
      hops,
      rssi,
      snr,
      timestamp: Date.now() / 1000,
      relayed: hops.length > 1,
      dedup_count: 0,
      payload_summary:
        msgType === 'SOS'
          ? `UDP SOS from ${origin} (${lat.toFixed(4)}, ${lon.toFixed(4)})`
          : msgType === 'ACK'
            ? `UDP ACK from ${origin} → ${parsed.target || 'broadcast'}`
            : `UDP ${msgType} frame from ${rinfo.address}`,
    };

    const isNew = recordPacket(record);
    if (!isNew) return;

    STATE.rx_packets += 1;
    STATE.nodes_discovered[origin] = {
      id: origin,
      ip: rinfo.address,
      last_seen: Date.now() / 1000,
      telemetry: {
        lat,
        lon,
        battery: Number(telemetry.battery ?? 85),
        mode: (telemetry.mode as NodeMode) || 'victim',
        hardware: telemetry.hardware || 'External UDP Transceiver',
        sos_active: msgType === 'SOS',
      },
      type: msgType,
      rssi,
      snr,
      distance_m: dist,
      bearing_deg: bearing,
      hops: hops.length,
      via: hops.length > 1 ? hops[hops.length - 1] : null,
      ack_ready: telemetry.mode === 'rescuer',
      source: 'udp',
    };

    if (msgType === 'SOS') {
      if (STATE.mode === 'rescuer' && CONFIG.auto_ack) {
        dispatchAckToTarget(origin);
      } else if (CONFIG.auto_relay && record.ttl > 1) {
        relayInboundPacket(parsed, record);
      }
    } else if (msgType === 'ACK' && parsed.target === STATE.node_id) {
      STATE.ack_received = true;
      STATE.ack_by = origin;
      STATE.ack_timestamp = Date.now() / 1000;
    }

    broadcastWs('state:sync', buildSnapshot());
  } catch {
    // Malformed UDP payload ignored
  }
});

try {
  udpSocket.bind(CONFIG.port, () => {
    try {
      udpSocket.setBroadcast(true);
      SUBNET.udp_bound = true;
      console.log(`[Mesh UDP] Bound to 0.0.0.0:${CONFIG.port} -> Broadcast ${CONFIG.broadcast_ip}`);
    } catch {
      SUBNET.udp_bound = false;
    }
  });
} catch {
  SUBNET.udp_bound = false;
}

function relayInboundPacket(rawPacket: Record<string, unknown>, record: PacketRecord) {
  const nextTtl = record.ttl - 1;
  if (nextTtl < 1) return;
  const nextHops = [...record.hops, STATE.node_id];
  const forwarded = {
    ...rawPacket,
    ttl: nextTtl,
    hops: nextHops,
  };
  STATE.messages_relayed += 1;
  STATE.tx_packets += 1;
  transmitUdpPacket(forwarded);

  const relayRecord: PacketRecord = {
    packet_id: `${record.packet_id}:hop:${STATE.node_id}`,
    origin: record.origin,
    target: record.target,
    type: 'RELAY',
    ttl: nextTtl,
    max_ttl: CONFIG.ttl_limit,
    hops: nextHops,
    rssi: record.rssi,
    snr: record.snr,
    timestamp: Date.now() / 1000,
    relayed: true,
    dedup_count: 0,
    payload_summary: `Forwarded ${record.origin} packet (TTL ${nextTtl} left)`,
  };
  PACKET_LOG.unshift(relayRecord);
  if (PACKET_LOG.length > 100) PACKET_LOG.pop();
  broadcastWs('packet:logged', relayRecord);
}

function dispatchAckToTarget(targetNodeId: string) {
  const pktId = crypto.randomUUID();
  const peer = STATE.nodes_discovered[targetNodeId];
  const hops = [STATE.node_id];
  if (peer?.via) hops.push(peer.via);
  hops.push(targetNodeId);

  const rawAck = {
    packet_id: pktId,
    origin: STATE.node_id,
    target: targetNodeId,
    type: 'ACK' as PacketType,
    ttl: CONFIG.ttl_limit,
    hops,
    timestamp: Date.now() / 1000,
    telemetry: {
      lat: STATE.latitude,
      lon: STATE.longitude,
      battery: STATE.battery,
      mode: STATE.mode,
    },
  };

  STATE.tx_packets += 1;
  transmitUdpPacket(rawAck);

  if (peer) {
    peer.telemetry.sos_active = false;
    peer.type = 'ACK';
    peer.last_seen = Date.now() / 1000;
  }

  recordPacket({
    packet_id: pktId,
    origin: STATE.node_id,
    target: targetNodeId,
    type: 'ACK',
    ttl: CONFIG.ttl_limit,
    max_ttl: CONFIG.ttl_limit,
    hops,
    rssi: peer ? peer.rssi : -54,
    snr: peer ? peer.snr : 42,
    timestamp: Date.now() / 1000,
    relayed: hops.length > 2,
    dedup_count: 0,
    payload_summary: `Rescuer ACK dispatched to ${targetNodeId}${peer?.via ? ` via ${peer.via}` : ''}`,
  });

  broadcastWs('state:sync', buildSnapshot());
}

function executeSosBroadcastCycle() {
  if (!STATE.sos_active || STATE.ack_received) return;

  const pktId = crypto.randomUUID();
  const medicalPayload = buildMedicalPayload();
  const rawSos = {
    packet_id: pktId,
    origin: STATE.node_id,
    type: 'SOS' as PacketType,
    ttl: CONFIG.ttl_limit,
    hops: [STATE.node_id],
    timestamp: Date.now() / 1000,
    ...medicalPayload,
    telemetry: {
      lat: STATE.latitude,
      lon: STATE.longitude,
      battery: STATE.battery,
      mode: STATE.mode,
      sos_category: STATE.sos_category,
      sos_note: STATE.sos_note,
      medical_status: STATE.medical_status,
      blood_type: STATE.blood_type,
      medical_payload: medicalPayload,
    },
  };

  STATE.tx_packets += 1;
  transmitUdpPacket(rawSos);

  recordPacket({
    packet_id: pktId,
    origin: STATE.node_id,
    type: 'SOS',
    ttl: CONFIG.ttl_limit,
    max_ttl: CONFIG.ttl_limit,
    hops: [STATE.node_id],
    rssi: -38,
    snr: 58,
    timestamp: Date.now() / 1000,
    relayed: false,
    dedup_count: 0,
    payload_summary: `SOS [${STATE.medical_status} · Blood ${STATE.blood_type}] "${STATE.sos_note}" (${STATE.latitude.toFixed(4)}, ${STATE.longitude.toFixed(4)})`,
  });

  // Propagate across active field relays & rescuers
  const peers = Object.values(STATE.nodes_discovered);
  const relays = peers.filter((p) => p.telemetry.mode === 'relay');
  const rescuers = peers.filter((p) => p.telemetry.mode === 'rescuer');

  if (relays.length > 0 && CONFIG.ttl_limit > 1) {
    setTimeout(() => {
      if (!STATE.sos_active) return;
      const primaryRelay = relays[0];
      STATE.messages_relayed += 1;

      const relayRec: PacketRecord = {
        packet_id: `${pktId}:relay:${primaryRelay.id}`,
        origin: STATE.node_id,
        type: 'RELAY',
        ttl: CONFIG.ttl_limit - 1,
        max_ttl: CONFIG.ttl_limit,
        hops: [STATE.node_id, primaryRelay.id],
        rssi: primaryRelay.rssi,
        snr: primaryRelay.snr,
        timestamp: Date.now() / 1000,
        relayed: true,
        dedup_count: 0,
        payload_summary: `${primaryRelay.id} relayed SOS (${CONFIG.ttl_limit - 1} TTL remaining)`,
      };
      PACKET_LOG.unshift(relayRec);
      if (PACKET_LOG.length > 100) PACKET_LOG.pop();
      broadcastWs('packet:logged', relayRec);

      // Secondary relay hears duplicate packet_id -> triggers deduplication cache hit
      if (relays.length > 1) {
        recordPacket({
          ...relayRec,
          packet_id: pktId,
        });
      }

      // If a rescuer node is reachable, deliver multi-hop ACK after realistic RF round-trip
      if (rescuers.length > 0 && !STATE.ack_received) {
        setTimeout(() => {
          if (!STATE.sos_active || STATE.ack_received) return;
          const rescuer = rescuers[0];
          const ackPktId = crypto.randomUUID();
          const ackHops = rescuer.via
            ? [rescuer.id, rescuer.via, STATE.node_id]
            : [rescuer.id, STATE.node_id];

          STATE.ack_received = true;
          STATE.ack_by = rescuer.id;
          STATE.ack_timestamp = Date.now() / 1000;
          STATE.rx_packets += 1;
          rescuer.last_seen = Date.now() / 1000;
          rescuer.type = 'ACK';

          recordPacket({
            packet_id: ackPktId,
            origin: rescuer.id,
            target: STATE.node_id,
            type: 'ACK',
            ttl: CONFIG.ttl_limit - (ackHops.length - 2),
            max_ttl: CONFIG.ttl_limit,
            hops: ackHops,
            rssi: rescuer.rssi,
            snr: rescuer.snr,
            timestamp: Date.now() / 1000,
            relayed: ackHops.length > 2,
            dedup_count: 0,
            payload_summary: `ACK confirmed by ${rescuer.id} (${rescuer.distance_m} m · ${ackHops.length - 1} hop${ackHops.length - 1 > 1 ? 's' : ''})`,
          });

          broadcastWs('state:sync', buildSnapshot());
        }, 1100);
      } else {
        broadcastWs('state:sync', buildSnapshot());
      }
    }, 450);
  }
}

// Periodic Beacon & RF Spectrum Telemetry Engine
setInterval(() => {
  const nowSec = Date.now() / 1000;
  const peerRssi: Record<string, number> = {};
  let rssiSum = 0;
  let peerCount = 0;
  let strongest = -95;

  for (const peer of Object.values(STATE.nodes_discovered)) {
    // Subtle realistic micro-drift for field handsets
    if (peer.source === 'field') {
      peer.last_seen = nowSec;
      const dist = haversineMeters(
        STATE.latitude,
        STATE.longitude,
        peer.telemetry.lat,
        peer.telemetry.lon
      );
      const { rssi, snr } = estimateLinkBudget(dist, peer.hops);
      peer.distance_m = dist;
      peer.bearing_deg = calculateBearing(
        STATE.latitude,
        STATE.longitude,
        peer.telemetry.lat,
        peer.telemetry.lon
      );
      peer.rssi = rssi;
      peer.snr = snr;
    }

    peerRssi[peer.id] = peer.rssi;
    rssiSum += peer.rssi;
    peerCount += 1;
    if (peer.rssi > strongest) strongest = peer.rssi;
  }

  const avgRssi = peerCount > 0 ? Math.round(rssiSum / peerCount) : -90;
  const noiseFloor = -96 + Math.round((Math.random() - 0.5) * 2);
  const sample: SpectrumPoint = {
    timestamp: Date.now(),
    noise_floor_dbm: noiseFloor,
    avg_rssi_dbm: avgRssi,
    strongest_rssi_dbm: strongest,
    snr_db: Math.max(0, avgRssi - noiseFloor),
    packets_per_window: recentWindowPackets,
    peer_rssi: peerRssi,
  };
  recentWindowPackets = 0;

  SPECTRUM_HISTORY.push(sample);
  if (SPECTRUM_HISTORY.length > 48) {
    SPECTRUM_HISTORY.shift();
  }

  if (STATE.sos_active && !STATE.ack_received) {
    executeSosBroadcastCycle();
  }

  broadcastWs('telemetry:tick', {
    nodes_discovered: STATE.nodes_discovered,
    spectrum_point: sample,
    ack_received: STATE.ack_received,
    ack_by: STATE.ack_by,
    messages_relayed: STATE.messages_relayed,
    packets_deduped: STATE.packets_deduped,
    tx_packets: STATE.tx_packets,
    rx_packets: STATE.rx_packets,
  });
}, CONFIG.beacon_interval_ms);

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS compatibility for local CLI / Arduino bridge clients
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // 1. Compatible status endpoint matching Python MeshUIHandler
  app.get('/api/status', (_req, res) => {
    res.json(buildSnapshot());
  });

  // 2. Compatible SOS & Medical Assistance toggle endpoint
  app.post('/api/toggle_sos', (req, res) => {
    const active =
      typeof req.body?.active === 'boolean' ? req.body.active : !STATE.sos_active;
    if (typeof req.body?.node_id === 'string' && req.body.node_id.trim()) {
      STATE.node_id = req.body.node_id.trim().slice(0, 28);
    }
    if (typeof req.body?.category === 'string' && req.body.category.trim()) {
      STATE.sos_category = req.body.category.trim();
    }
    if (typeof req.body?.note === 'string') {
      STATE.sos_note = req.body.note.trim();
    }
    if (typeof req.body?.message === 'string' && req.body.message.trim()) {
      STATE.sos_note = req.body.message.trim();
    }
    if (
      typeof req.body?.status === 'string' &&
      ['CRITICAL', 'URGENT', 'STABLE', 'STANDBY'].includes(req.body.status)
    ) {
      STATE.medical_status = req.body.status as MedicalStatus;
    }
    if (
      typeof req.body?.blood_type === 'string' &&
      ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].includes(req.body.blood_type)
    ) {
      STATE.blood_type = req.body.blood_type as BloodType;
    }
    if (Array.isArray(req.body?.gps_last_known) && req.body.gps_last_known.length === 2) {
      const lat = Number(req.body.gps_last_known[0]);
      const lon = Number(req.body.gps_last_known[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        STATE.latitude = lat;
        STATE.longitude = lon;
        recomputePeerGeometry();
      }
    }

    STATE.sos_active = active;
    STATE.ack_received = false;
    STATE.ack_by = null;
    STATE.ack_timestamp = null;

    if (active) {
      executeSosBroadcastCycle();
    }

    broadcastWs('state:sync', buildSnapshot());
    res.json({
      success: true,
      sos_active: STATE.sos_active,
      ack_received: STATE.ack_received,
      medical_payload: buildMedicalPayload(),
    });
  });

  // 3. Compatible GPS & Battery telemetry endpoint matching Python MeshUIHandler
  app.post('/api/update_telemetry', (req, res) => {
    if (req.body?.lat !== undefined) {
      const lat = Number(req.body.lat);
      if (!Number.isNaN(lat) && lat >= -90 && lat <= 90) {
        STATE.latitude = lat;
      }
    }
    if (req.body?.lon !== undefined) {
      const lon = Number(req.body.lon);
      if (!Number.isNaN(lon) && lon >= -180 && lon <= 180) {
        STATE.longitude = lon;
      }
    }
    if (req.body?.battery !== undefined) {
      const bat = Number(req.body.battery);
      if (!Number.isNaN(bat)) {
        STATE.battery = Math.max(1, Math.min(100, Math.round(bat)));
      }
    }
    if (req.body?.heading !== undefined) {
      const hdg = Number(req.body.heading);
      if (!Number.isNaN(hdg)) {
        STATE.heading = ((Math.round(hdg) % 360) + 360) % 360;
      }
    }

    recomputePeerGeometry();
    broadcastWs('state:sync', buildSnapshot());
    res.json({ success: true, latitude: STATE.latitude, longitude: STATE.longitude });
  });

  // 4. Node Role & Engine Configuration
  app.post('/api/config', (req, res) => {
    if (typeof req.body?.node_id === 'string' && req.body.node_id.trim()) {
      STATE.node_id = req.body.node_id.trim().slice(0, 28);
    }
    if (req.body?.mode && ['victim', 'rescuer', 'relay'].includes(req.body.mode)) {
      STATE.mode = req.body.mode as NodeMode;
    }
    if (req.body?.ttl_limit !== undefined) {
      CONFIG.ttl_limit = Math.max(1, Math.min(8, Number(req.body.ttl_limit) || 4));
    }
    if (typeof req.body?.auto_ack === 'boolean') {
      CONFIG.auto_ack = req.body.auto_ack;
    }
    if (typeof req.body?.auto_relay === 'boolean') {
      CONFIG.auto_relay = req.body.auto_relay;
    }

    broadcastWs('state:sync', buildSnapshot());
    res.json({ success: true, state: buildSnapshot() });
  });

  // 5. Manual Rescuer ACK Dispatch
  app.post('/api/dispatch_ack', (req, res) => {
    const target = String(req.body?.target || '').trim();
    if (!target) {
      res.status(400).json({ error: 'Target node ID is required' });
      return;
    }
    dispatchAckToTarget(target);
    res.json({ success: true, target });
  });

  // 6. Targeted Peer RF Link Ping
  app.post('/api/ping_peer', (req, res) => {
    const target = String(req.body?.target || '').trim();
    const peer = STATE.nodes_discovered[target];
    if (!peer) {
      res.status(404).json({ error: 'Peer node not found in registry' });
      return;
    }

    const pktId = crypto.randomUUID();
    const hops = [STATE.node_id];
    if (peer.via) hops.push(peer.via);
    hops.push(peer.id);

    const pingRaw = {
      packet_id: pktId,
      origin: STATE.node_id,
      target: peer.id,
      type: 'PING' as PacketType,
      ttl: CONFIG.ttl_limit,
      hops,
      timestamp: Date.now() / 1000,
    };

    STATE.tx_packets += 1;
    STATE.rx_packets += 1;
    peer.last_seen = Date.now() / 1000;
    transmitUdpPacket(pingRaw);

    recordPacket({
      packet_id: pktId,
      origin: STATE.node_id,
      target: peer.id,
      type: 'PING',
      ttl: CONFIG.ttl_limit,
      max_ttl: CONFIG.ttl_limit,
      hops,
      rssi: peer.rssi,
      snr: peer.snr,
      timestamp: Date.now() / 1000,
      relayed: hops.length > 2,
      dedup_count: 0,
      payload_summary: `ICMP/UDP Mesh Ping → ${peer.id} (${peer.rssi} dBm, ${peer.distance_m} m)`,
    });

    broadcastWs('state:sync', buildSnapshot());
    res.json({ success: true, rssi: peer.rssi, distance_m: peer.distance_m });
  });

  // 7. Spawn Field Node for Multi-Hop Mesh Workbench
  app.post('/api/peers/spawn', (req, res) => {
    const role = (['victim', 'rescuer', 'relay'].includes(req.body?.mode)
      ? req.body.mode
      : 'relay') as NodeMode;
    const prefix = role === 'rescuer' ? 'Rescuer' : role === 'relay' ? 'ESP32_Relay' : 'Field_Node';
    const suffix = Math.floor(10 + Math.random() * 89);
    const id = String(req.body?.id || `${prefix}_${suffix}`).trim().slice(0, 24);
    const angleRad = ((Number(req.body?.bearing_deg ?? Math.random() * 360)) * Math.PI) / 180;
    const distMeters = Math.max(40, Math.min(950, Number(req.body?.distance_m ?? 220)));

    const dLat = (distMeters * Math.cos(angleRad)) / 111320;
    const dLon =
      (distMeters * Math.sin(angleRad)) /
      (111320 * Math.cos((STATE.latitude * Math.PI) / 180));

    const lat = Number((STATE.latitude + dLat).toFixed(6));
    const lon = Number((STATE.longitude + dLon).toFixed(6));
    const hostOctet = Math.floor(120 + Math.random() * 120);

    STATE.nodes_discovered[id] = {
      id,
      ip: `192.168.43.${hostOctet}`,
      last_seen: Date.now() / 1000,
      telemetry: {
        lat,
        lon,
        battery: Math.floor(55 + Math.random() * 44),
        mode: role,
        hardware: String(req.body?.hardware || 'ESP32 Ad-Hoc Transceiver'),
        sos_active: false,
      },
      type: 'BEACON',
      rssi: -60,
      snr: 36,
      distance_m: distMeters,
      bearing_deg: 0,
      hops: distMeters > 260 ? 2 : 1,
      via: null,
      ack_ready: role === 'rescuer',
      source: 'field',
    };

    recomputePeerGeometry();
    const created = STATE.nodes_discovered[id];

    recordPacket({
      packet_id: crypto.randomUUID(),
      origin: id,
      type: 'BEACON',
      ttl: CONFIG.ttl_limit,
      max_ttl: CONFIG.ttl_limit,
      hops: created.via ? [id, created.via, STATE.node_id] : [id, STATE.node_id],
      rssi: created.rssi,
      snr: created.snr,
      timestamp: Date.now() / 1000,
      relayed: Boolean(created.via),
      dedup_count: 0,
      payload_summary: `Peer discovery beacon from ${id} (${role.toUpperCase()} · ${created.ip})`,
    });

    broadcastWs('state:sync', buildSnapshot());
    res.json({ success: true, node: created });
  });

  // 8. Simulate Incoming Peer SOS (Tests Rescuer auto-ACK & Relay Store-and-Forward)
  app.post('/api/peers/trigger_sos', (req, res) => {
    const peerId = String(req.body?.id || '').trim();
    const peer = STATE.nodes_discovered[peerId];
    if (!peer) {
      res.status(404).json({ error: 'Peer not found' });
      return;
    }

    peer.telemetry.sos_active = true;
    peer.telemetry.medical_status = 'CRITICAL';
    peer.telemetry.blood_type = peer.telemetry.blood_type || 'O+';
    peer.telemetry.sos_category = 'Medical / Structural Collapse';
    peer.telemetry.sos_note = 'Trapped under debris, need medical assistance.';
    peer.telemetry.medical_payload = {
      node_id: peer.id,
      status: 'CRITICAL',
      blood_type: peer.telemetry.blood_type,
      gps_last_known: [peer.telemetry.lat, peer.telemetry.lon],
      message: peer.telemetry.sos_note,
    };
    peer.type = 'SOS';
    peer.last_seen = Date.now() / 1000;
    STATE.rx_packets += 1;

    const pktId = crypto.randomUUID();
    const inboundHops = peer.via ? [peer.id, peer.via, STATE.node_id] : [peer.id, STATE.node_id];
    const inboundRecord: PacketRecord = {
      packet_id: pktId,
      origin: peer.id,
      type: 'SOS',
      ttl: Math.max(1, CONFIG.ttl_limit - (inboundHops.length - 2)),
      max_ttl: CONFIG.ttl_limit,
      hops: inboundHops,
      rssi: peer.rssi,
      snr: peer.snr,
      timestamp: Date.now() / 1000,
      relayed: inboundHops.length > 2,
      dedup_count: 0,
      payload_summary: `INBOUND MEDICAL SOS [${peer.telemetry.medical_status} · Blood ${peer.telemetry.blood_type}] from ${peer.id} (${peer.telemetry.lat.toFixed(4)}, ${peer.telemetry.lon.toFixed(4)})`,
    };
    recordPacket(inboundRecord);

    if (STATE.mode === 'rescuer' && CONFIG.auto_ack) {
      setTimeout(() => {
        dispatchAckToTarget(peer.id);
      }, 500);
    } else if (CONFIG.auto_relay && inboundRecord.ttl > 1) {
      relayInboundPacket(
        {
          packet_id: pktId,
          origin: peer.id,
          type: 'SOS',
          ttl: inboundRecord.ttl,
          hops: inboundHops,
          telemetry: peer.telemetry,
        },
        inboundRecord
      );
    }

    broadcastWs('state:sync', buildSnapshot());
    res.json({ success: true });
  });

  // 9. Remove Peer Node
  app.delete('/api/peers/:id', (req, res) => {
    const id = req.params.id;
    delete STATE.nodes_discovered[id];
    recomputePeerGeometry();
    broadcastWs('state:sync', buildSnapshot());
    res.json({ success: true });
  });

  // 10. Clear Packet Cache & Dedup Table
  app.post('/api/packets/clear', (_req, res) => {
    SEEN_PACKET_IDS.clear();
    PACKET_LOG.length = 0;
    STATE.packets_deduped = 0;
    broadcastWs('state:sync', buildSnapshot());
    res.json({ success: true });
  });

  const server = http.createServer(app);

  // Attach WebSocket Server on /ws
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    wsClients.add(ws);
    ws.send(
      JSON.stringify({
        event: 'state:sync',
        data: buildSnapshot(),
        ts: Date.now(),
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.action === 'request_sync') {
          ws.send(
            JSON.stringify({
              event: 'state:sync',
              data: buildSnapshot(),
              ts: Date.now(),
            })
          );
        }
      } catch {
        // Ignore invalid WS messages
      }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
    });
  });

  const distPath = path.join(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpPort = parseInt(process.env.PORT || '3000', 10);
  server.listen(httpPort, '0.0.0.0', () => {
    console.log(`[AetherMesh] Web & WS Server active at http://0.0.0.0:${httpPort}`);
  });
}

startServer();
