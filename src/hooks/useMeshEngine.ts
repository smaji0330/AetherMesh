import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  BloodType,
  MedicalStatus,
  MeshSnapshot,
  NodeMode,
  PacketRecord,
} from '../types/mesh';

export function useMeshEngine() {
  const [snapshot, setSnapshot] = useState<MeshSnapshot | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [gpsSyncing, setGpsSyncing] = useState<boolean>(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const fetchInitialStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data: MeshSnapshot = await res.json();
        setSnapshot(data);
      }
    } catch {
      // Handled by WebSocket retry
    }
  }, []);

  useEffect(() => {
    fetchInitialStatus();

    let unmounted = false;

    const connectWs = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) {
          setWsConnected(true);
        }
      };

      ws.onmessage = (evt) => {
        if (unmounted) return;
        try {
          const payload = JSON.parse(evt.data);
          const { event, data } = payload;

          if (event === 'state:sync') {
            setSnapshot(data as MeshSnapshot);
          } else if (event === 'packet:logged') {
            const incoming = data as PacketRecord;
            setSnapshot((prev) => {
              if (!prev) return prev;
              const exists = prev.packets.some((p) => p.packet_id === incoming.packet_id);
              if (exists) return prev;
              return {
                ...prev,
                packets: [incoming, ...prev.packets].slice(0, 80),
                seen_cache_size: prev.seen_cache_size + 1,
              };
            });
          } else if (event === 'packet:dedup') {
            setSnapshot((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                packets_deduped: data.packets_deduped,
                packets: prev.packets.map((p) =>
                  p.packet_id === data.packet_id ? { ...p, dedup_count: data.dedup_count } : p
                ),
              };
            });
          } else if (event === 'telemetry:tick') {
            setSnapshot((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                nodes_discovered: data.nodes_discovered,
                spectrum: [...prev.spectrum.slice(-35), data.spectrum_point],
                ack_received: data.ack_received,
                ack_by: data.ack_by,
                messages_relayed: data.messages_relayed,
                packets_deduped: data.packets_deduped,
                tx_packets: data.tx_packets,
                rx_packets: data.rx_packets,
              };
            });
          }
        } catch {
          // Ignore malformed WS frame
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setWsConnected(false);
          reconnectTimerRef.current = window.setTimeout(connectWs, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchInitialStatus]);

  const toggleSos = useCallback(
    async (
      active?: boolean,
      category?: string,
      note?: string,
      medicalOpts?: {
        node_id?: string;
        status?: MedicalStatus;
        blood_type?: BloodType;
        gps_last_known?: [number, number];
        message?: string;
      }
    ) => {
      const targetState = typeof active === 'boolean' ? active : !snapshot?.sos_active;
      const resolvedNote = medicalOpts?.message ?? note;
      setSnapshot((prev) => {
        if (!prev) return prev;
        const nextNodeId = medicalOpts?.node_id ?? prev.node_id;
        const nextStatus = medicalOpts?.status ?? prev.medical_status;
        const nextBlood = medicalOpts?.blood_type ?? prev.blood_type;
        const nextLat = medicalOpts?.gps_last_known ? medicalOpts.gps_last_known[0] : prev.latitude;
        const nextLon = medicalOpts?.gps_last_known ? medicalOpts.gps_last_known[1] : prev.longitude;
        const nextMsg = resolvedNote ?? prev.sos_note;
        return {
          ...prev,
          node_id: nextNodeId,
          sos_active: targetState,
          ack_received: false,
          ack_by: null,
          sos_category: category ?? prev.sos_category,
          sos_note: nextMsg,
          medical_status: nextStatus,
          blood_type: nextBlood,
          latitude: nextLat,
          longitude: nextLon,
          medical_payload: {
            node_id: nextNodeId,
            status: nextStatus,
            blood_type: nextBlood,
            gps_last_known: [nextLat, nextLon],
            message: nextMsg,
          },
        };
      });

      await fetch('/api/toggle_sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: targetState,
          category,
          note: resolvedNote,
          ...medicalOpts,
        }),
      });
    },
    [snapshot?.sos_active]
  );

  const updateTelemetry = useCallback(
    async (params: { lat?: number; lon?: number; battery?: number; heading?: number }) => {
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              latitude: params.lat ?? prev.latitude,
              longitude: params.lon ?? prev.longitude,
              battery: params.battery ?? prev.battery,
              heading: params.heading ?? prev.heading,
            }
          : prev
      );

      await fetch('/api/update_telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    },
    []
  );

  const updateConfig = useCallback(
    async (params: {
      node_id?: string;
      mode?: NodeMode;
      ttl_limit?: number;
      auto_ack?: boolean;
      auto_relay?: boolean;
    }) => {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    },
    []
  );

  const dispatchAck = useCallback(async (targetId: string) => {
    await fetch('/api/dispatch_ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: targetId }),
    });
  }, []);

  const pingPeer = useCallback(async (targetId: string) => {
    await fetch('/api/ping_peer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: targetId }),
    });
  }, []);

  const spawnPeer = useCallback(
    async (params: {
      id?: string;
      mode: NodeMode;
      bearing_deg: number;
      distance_m: number;
      hardware: string;
    }) => {
      await fetch('/api/peers/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    },
    []
  );

  const triggerPeerSos = useCallback(async (peerId: string) => {
    await fetch('/api/peers/trigger_sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: peerId }),
    });
  }, []);

  const removePeer = useCallback(async (peerId: string) => {
    await fetch(`/api/peers/${encodeURIComponent(peerId)}`, {
      method: 'DELETE',
    });
  }, []);

  const clearPackets = useCallback(async () => {
    await fetch('/api/packets/clear', {
      method: 'POST',
    });
  }, []);

  const syncBrowserGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatusMsg('Hardware GPS unavailable in browser; using calibrated coordinates.');
      return;
    }
    setGpsSyncing(true);
    setGpsStatusMsg('Acquiring GNSS fix...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        const heading =
          pos.coords.heading !== null && !Number.isNaN(pos.coords.heading)
            ? Math.round(pos.coords.heading)
            : undefined;
        updateTelemetry({ lat, lon, heading });
        setGpsSyncing(false);
        setGpsStatusMsg(`GNSS locked (±${Math.round(pos.coords.accuracy)} m)`);
      },
      () => {
        setGpsSyncing(false);
        setGpsStatusMsg('Browser GNSS permission denied; retaining field preset coordinates.');
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, [updateTelemetry]);

  return {
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
  };
}
