export type NodeMode = 'victim' | 'rescuer' | 'relay';
export type PacketType = 'SOS' | 'ACK' | 'BEACON' | 'RELAY' | 'PING';
export type MedicalStatus = 'CRITICAL' | 'URGENT' | 'STABLE' | 'STANDBY';
export type BloodType = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';

export interface MedicalEmergencyPayload {
  node_id: string;
  status: MedicalStatus;
  blood_type: BloodType;
  gps_last_known: [number, number];
  message: string;
}

export interface PeerTelemetry {
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

export interface DiscoveredNode {
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

export interface PacketRecord {
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

export interface SpectrumPoint {
  timestamp: number;
  noise_floor_dbm: number;
  avg_rssi_dbm: number;
  strongest_rssi_dbm: number;
  snr_db: number;
  packets_per_window: number;
  peer_rssi: Record<string, number>;
}

export interface SubnetInfo {
  interface_name: string;
  local_ip: string;
  netmask: string;
  broadcast_ip: string;
  transport_layer: string;
  udp_bound: boolean;
  udp_port: number;
}

export interface MeshConfig {
  port: number;
  broadcast_ip: string;
  beacon_interval_ms: number;
  ttl_limit: number;
  auto_ack: boolean;
  auto_relay: boolean;
}

export interface MeshSnapshot {
  node_id: string;
  mode: NodeMode;
  sos_active: boolean;
  sos_category: string;
  sos_note: string;
  medical_status: MedicalStatus;
  blood_type: BloodType;
  medical_payload: MedicalEmergencyPayload;
  battery: number;
  latitude: number;
  longitude: number;
  heading: number;
  nodes_discovered: Record<string, DiscoveredNode>;
  ack_received: boolean;
  ack_by: string | null;
  ack_timestamp: number | null;
  messages_relayed: number;
  packets_deduped: number;
  tx_packets: number;
  rx_packets: number;
  config: MeshConfig;
  subnet: SubnetInfo;
  packets: PacketRecord[];
  spectrum: SpectrumPoint[];
  seen_cache_size: number;
}
