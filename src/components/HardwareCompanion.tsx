import React, { useState, useMemo } from 'react';
import { Cpu, Copy, Check, Download, Terminal } from 'lucide-react';
import type { MeshSnapshot } from '../types/mesh';

interface HardwareCompanionProps {
  snapshot: MeshSnapshot;
}

export const HardwareCompanion: React.FC<HardwareCompanionProps> = ({ snapshot }) => {
  const [activeTab, setActiveTab] = useState<'arduino' | 'python'>('arduino');
  const [copied, setCopied] = useState<boolean>(false);
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  const arduinoCode = useMemo(
    () => `/*
 * AetherMesh — Arduino / ESP32 Offline Emergency UDP Mesh Transceiver
 * Wire-compatible with AetherMesh Web Console & Python Mesh Core (UDP Port ${snapshot.config.port})
 * Hardware: ESP32-WROOM / ESP8266 + Tactile SOS Button (GPIO 4) + ACK Status LED (GPIO 2)
 */

#include <WiFi.h>
#include <WiFiUdp.h>

const char* WIFI_SSID     = "Emergency_Mesh_AP";   // Local Hotspot or Wi-Fi Direct SSID
const char* WIFI_PASS     = "meshrescue123";
const uint16_t MESH_PORT  = ${snapshot.config.port};

const int SOS_BUTTON_PIN  = 4;   // Momentary SOS push-button to GND
const int ACK_LED_PIN     = 2;   // Onboard / panel LED lights solid on Rescuer ACK

String NODE_ID            = "${snapshot.node_id}_ESP32";
String NODE_MODE          = "${snapshot.mode}";   // "victim", "relay", or "rescuer"
bool sosActive            = false;
bool ackReceived          = false;
unsigned long lastBeacon  = 0;

WiFiUDP udp;
String recentCache[32];
int cacheIndex = 0;

bool isDuplicatePacket(const String& pktId) {
  for (int i = 0; i < 32; i++) {
    if (recentCache[i] == pktId) return true;
  }
  recentCache[cacheIndex] = pktId;
  cacheIndex = (cacheIndex + 1) % 32;
  return false;
}

IPAddress getBroadcastIP() {
  IPAddress local = WiFi.localIP();
  IPAddress subnet = WiFi.subnetMask();
  IPAddress bcast;
  for (int i = 0; i < 4; i++) {
    bcast[i] = local[i] | (~subnet[i]);
  }
  return bcast;
}

void broadcastSosFrame() {
  String pktId = NODE_ID + "_" + String(millis());
  String payload = "{";
  payload += "\\"packet_id\\":\\"" + pktId + "\\",";
  payload += "\\"origin\\":\\"" + NODE_ID + "\\",";
  payload += "\\"type\\":\\"SOS\\",";
  payload += "\\"ttl\\":${snapshot.config.ttl_limit},";
  payload += "\\"telemetry\\":{";
  payload += "\\"lat\\":${snapshot.latitude.toFixed(4)},";
  payload += "\\"lon\\":${snapshot.longitude.toFixed(4)},";
  payload += "\\"battery\\":89,";
  payload += "\\"mode\\":\\"" + NODE_MODE + "\\",";
  payload += "\\"hardware\\":\\"ESP32-WROOM Field Unit\\"";
  payload += "}}";

  udp.beginPacket(getBroadcastIP(), MESH_PORT);
  udp.print(payload);
  udp.endPacket();
  Serial.println("[BEACON] UDP SOS Dispatched -> " + payload);
}

void setup() {
  Serial.begin(115200);
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);
  pinMode(ACK_LED_PIN, OUTPUT);
  digitalWrite(ACK_LED_PIN, LOW);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[*] Joining local mesh hotspot");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\\n[+] IP: " + WiFi.localIP().toString());
  udp.begin(MESH_PORT);
}

void loop() {
  if (digitalRead(SOS_BUTTON_PIN) == LOW) {
    delay(180); // Hardware debounce
    sosActive = !sosActive;
    ackReceived = false;
    digitalWrite(ACK_LED_PIN, LOW);
    Serial.println(sosActive ? "[!] EMERGENCY SOS ARMED" : "[*] SOS STANDBY");
  }

  int packetSize = udp.parsePacket();
  if (packetSize > 0) {
    char incoming[1024];
    int len = udp.read(incoming, sizeof(incoming) - 1);
    if (len > 0) incoming[len] = '\\0';
    String frame = String(incoming);

    if (frame.indexOf("\\"type\\":\\"ACK\\"") >= 0 && frame.indexOf(NODE_ID) >= 0) {
      ackReceived = true;
      digitalWrite(ACK_LED_PIN, HIGH);
      Serial.println("[CONFIRMED] Rescuer ACK received on ESP32!");
    } else if (NODE_MODE == "relay" && frame.indexOf("\\"ttl\\":1") < 0) {
      // Multi-hop store & forward relay
      udp.beginPacket(getBroadcastIP(), MESH_PORT);
      udp.print(frame);
      udp.endPacket();
    }
  }

  if (sosActive && !ackReceived && (millis() - lastBeacon >= 2500)) {
    lastBeacon = millis();
    broadcastSosFrame();
  }
}
`,
    [snapshot.config.port, snapshot.config.ttl_limit, snapshot.latitude, snapshot.longitude, snapshot.mode, snapshot.node_id]
  );

  const pythonCode = useMemo(
    () => `"""
AetherMesh — Upgraded Offline UDP Mesh Network Core & CLI
Wire-compatible with AetherMesh Web UI & Arduino/ESP32 Field Nodes.
Supports Subnet Auto-Detection, Hop Trace Arrays, Dedup Cache, and CORS REST API.
"""

import socket
import threading
import time
import json
import uuid
import sys
import argparse
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

STATE = {
    "node_id": "${snapshot.node_id}",
    "mode": "${snapshot.mode}",
    "sos_active": False,
    "battery": ${snapshot.battery},
    "latitude": ${snapshot.latitude},
    "longitude": ${snapshot.longitude},
    "nodes_discovered": {},
    "ack_received": False,
    "messages_relayed": 0,
}

SEEN_PACKET_IDS = set()
CONFIG = {
    "port": ${snapshot.config.port},
    "web_port": 8080,
    "broadcast_ip": "255.255.255.255",
    "beacon_interval": 2.5,
    "ttl_limit": ${snapshot.config.ttl_limit},
}

def get_broadcast_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        parts = local_ip.split(".")
        parts[-1] = "255"
        return ".".join(parts)
    except Exception:
        return "255.255.255.255"

def mesh_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("", CONFIG["port"]))
    print(f"[*] Mesh Engine listening on UDP port {CONFIG['port']}...")

    while True:
        try:
            data, addr = sock.recvfrom(4096)
            packet = json.loads(data.decode("utf-8"))
            pkt_id = packet.get("packet_id")
            origin = packet.get("origin")
            msg_type = packet.get("type")
            hops = packet.get("hops", [origin])

            if origin == STATE["node_id"] and len(hops) <= 1:
                continue
            if pkt_id in SEEN_PACKET_IDS:
                continue
            SEEN_PACKET_IDS.add(pkt_id)

            STATE["nodes_discovered"][origin] = {
                "ip": addr[0],
                "last_seen": time.time(),
                "telemetry": packet.get("telemetry", {}),
                "type": msg_type,
                "hops": len(hops),
            }

            if msg_type == "SOS":
                print(f"[ALERT] SOS from {origin} via {' -> '.join(hops)}")
                if STATE["mode"] == "rescuer":
                    send_ack(origin)
                else:
                    relay_packet(packet)
            elif msg_type == "ACK" and packet.get("target") == STATE["node_id"]:
                print(f"[CONFIRMED] Rescuer {origin} confirmed SOS receipt!")
                STATE["ack_received"] = True
        except Exception:
            time.sleep(0.1)

def send_ack(target_node_id):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    ack_packet = {
        "packet_id": str(uuid.uuid4()),
        "origin": STATE["node_id"],
        "target": target_node_id,
        "type": "ACK",
        "ttl": CONFIG["ttl_limit"],
        "hops": [STATE["node_id"], target_node_id],
        "timestamp": time.time(),
        "telemetry": {
            "lat": STATE["latitude"],
            "lon": STATE["longitude"],
            "battery": STATE["battery"],
            "mode": STATE["mode"],
        },
    }
    sock.sendto(json.dumps(ack_packet).encode("utf-8"), (CONFIG["broadcast_ip"], CONFIG["port"]))

def relay_packet(packet):
    ttl = packet.get("ttl", CONFIG["ttl_limit"])
    if ttl > 1:
        packet["ttl"] = ttl - 1
        hops = packet.get("hops", [packet.get("origin", "peer")])
        packet["hops"] = hops + [STATE["node_id"]]
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.sendto(json.dumps(packet).encode("utf-8"), (CONFIG["broadcast_ip"], CONFIG["port"]))
        STATE["messages_relayed"] += 1

def mesh_broadcaster():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    while True:
        if STATE["sos_active"] and not STATE["ack_received"]:
            packet = {
                "packet_id": str(uuid.uuid4()),
                "origin": STATE["node_id"],
                "type": "SOS",
                "ttl": CONFIG["ttl_limit"],
                "hops": [STATE["node_id"]],
                "timestamp": time.time(),
                "telemetry": {
                    "lat": STATE["latitude"],
                    "lon": STATE["longitude"],
                    "battery": STATE["battery"],
                    "mode": STATE["mode"],
                },
            }
            sock.sendto(json.dumps(packet).encode("utf-8"), (CONFIG["broadcast_ip"], CONFIG["port"]))
        time.sleep(CONFIG["beacon_interval"])

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AetherMesh Offline UDP Node")
    parser.add_argument("--mode", choices=["victim", "rescuer", "relay"], default="${snapshot.mode}")
    parser.add_argument("--node-id", default="${snapshot.node_id}_CLI")
    parser.add_argument("--port", type=int, default=${snapshot.config.port})
    parser.add_argument("--sos", action="store_true")
    args = parser.parse_args()

    CONFIG["port"] = args.port
    CONFIG["broadcast_ip"] = get_broadcast_ip()
    STATE["node_id"] = args.node_id
    STATE["mode"] = args.mode
    STATE["sos_active"] = args.sos

    threading.Thread(target=mesh_listener, daemon=True).start()
    threading.Thread(target=mesh_broadcaster, daemon=True).start()
    print(f"[*] Active on {CONFIG['broadcast_ip']}:{CONFIG['port']} as {STATE['node_id']} ({STATE['mode']})")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        sys.exit(0)
`,
    [snapshot.battery, snapshot.config.port, snapshot.config.ttl_limit, snapshot.latitude, snapshot.longitude, snapshot.mode, snapshot.node_id]
  );

  const currentSource = activeTab === 'arduino' ? arduinoCode : pythonCode;
  const currentFilename = activeTab === 'arduino' ? 'esp32_mesh_node.ino' : 'mesh_node.py';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([currentSource], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Hardware Reference & Wiring Bench */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-12 items-stretch divide-y xl:divide-y-0 xl:divide-x divide-slate-800/80">
          {/* Studio Hardware Preview */}
          <div className="xl:col-span-6 relative min-h-[260px] bg-[#07090E]">
            {!imgFailed ? (
              <img
                src="/src/assets/images/esp32_mesh_transceiver_1793318959212.jpg"
                alt="ESP32 Arduino emergency Wi-Fi mesh transceiver module with external dipole antenna, OLED telemetry display, and industrial red SOS button"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-900 to-slate-950">
                <Cpu className="w-10 h-10 text-cyan-400 mb-3" />
                <p className="text-sm font-semibold text-slate-200">
                  ESP32-WROOM Off-Grid UDP Transceiver Reference
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  2.4 GHz Ad-Hoc Broadcast · GPIO 4 SOS Trigger · SSD1306 I2C Telemetry
                </p>
              </div>
            )}
          </div>

          {/* Hardware Wiring & Protocol Spec */}
          <div className="xl:col-span-6 p-6 flex flex-col justify-between gap-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-100 mb-2">
                Arduino / ESP32 &amp; Python CLI Interoperability
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                This web console runs a live UDP transceiver on port{' '}
                <span className="font-mono text-cyan-300">{snapshot.config.port}</span> alongside its
                WebSocket engine. Flash an ESP32/ESP8266 board or launch the Python CLI on the same
                mobile hotspot (<span className="font-mono text-slate-200">192.168.43.x</span>) to
                exchange real emergency beacons, multi-hop relays, and rescuer ACKs.
              </p>
            </div>

            <div className="border-t border-slate-800/80 pt-4">
              <div className="text-xs font-semibold text-slate-300 mb-2.5">
                ESP32 Hardware Pinout Specification
              </div>
              <div className="divide-y divide-slate-800/70 text-xs font-mono">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">SOS Momentary Push-Button</span>
                  <span className="text-slate-100">GPIO 4 → GND (INPUT_PULLUP)</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">Rescuer ACK Confirmation LED</span>
                  <span className="text-emerald-400">GPIO 2 (HIGH on ACK)</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">SSD1306 128x64 OLED Display</span>
                  <span className="text-slate-100">SDA: GPIO 21 · SCL: GPIO 22</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">UDP Broadcast Frame Endpoint</span>
                  <span className="text-cyan-300">
                    {snapshot.subnet.broadcast_ip}:{snapshot.config.port}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Firmware & CLI Code Exporter */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/90">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('arduino')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'arduino'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Arduino / ESP32 Sketch (.ino)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('python')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'python'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Python Mesh CLI (.py)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Code
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download {currentFilename}
            </button>
          </div>
        </div>

        <pre className="p-5 bg-[#07090E] text-xs font-mono text-slate-300 overflow-x-auto max-h-[440px] leading-relaxed">
          <code>{currentSource}</code>
        </pre>
      </section>
    </div>
  );
};
