// qoxi: thin adapter over the OmadaBridge dashboard model for one device.
import { HomeAssistant as MushroomHass } from "../../ha";
import {
  formatRateBits,
  formatSpeedMbps,
  formatUptimeSeconds,
} from "../../shared/omada/format";
import {
  getDashboardModel,
  isDeviceConnected,
  normalizeMacKey,
} from "../../shared/omada/model";
import type {
  ClientRecord,
  DeviceRecord,
  HomeAssistant as OmadaHass,
  PortRecord,
} from "../../shared/omada/ha-types";

export type {
  DeviceRecord,
  PortRecord,
  ClientRecord,
} from "../../shared/omada/ha-types";

function omadaHass(hass: MushroomHass): OmadaHass {
  return hass as unknown as OmadaHass;
}

export function listDevices(hass: MushroomHass, site?: string): DeviceRecord[] {
  return getDashboardModel(omadaHass(hass), site ? { site } : undefined)
    .devices;
}

/** Match by MAC (any separator / case) or by device name (case-insensitive). */
export function findDevice(
  hass: MushroomHass,
  device: string | undefined,
  site?: string
): DeviceRecord | undefined {
  const devices = listDevices(hass, site);
  if (!device) return devices[0];
  const wanted = device.trim().toLowerCase();
  const wantedMac = normalizeMacKey(device);
  return devices.find(
    (d) =>
      (wantedMac && normalizeMacKey(d.mac) === wantedMac) ||
      d.name.toLowerCase() === wanted ||
      d.key.toLowerCase() === wanted
  );
}

export function deviceOnline(device: DeviceRecord): boolean {
  return isDeviceConnected(device.status);
}

export function portUp(port: PortRecord): boolean {
  return /^connected$/i.test(port.status) || port.status === "1";
}

export function portSpeedMbps(port: PortRecord): number {
  return (
    port.metrics.omada_port_link_speed_mbps ??
    Number(port.attrs.link_speed ?? 0) ??
    0
  );
}

export function portsUp(device: DeviceRecord): [number, number] {
  const total = device.ports.length;
  const up = device.ports.filter(portUp).length;
  return [up, total];
}

export function deviceUptime(device: DeviceRecord): string {
  return formatUptimeSeconds(device.metrics.omada_device_uptime_seconds ?? 0);
}

export function deviceRate(device: DeviceRecord, dir: "rx" | "tx"): string {
  return formatRateBits(device.metrics[`omada_device_${dir}_rate`] ?? 0);
}

const DEVICE_STAT_METRIC: Record<string, string> = {
  cpu: "omada_device_cpu_percentage",
  mem: "omada_device_mem_percentage",
  uptime: "omada_device_uptime_seconds",
  rx_rate: "omada_device_rx_rate",
  tx_rate: "omada_device_tx_rate",
  temp: "omada_device_temp",
  poe_remain: "omada_device_poe_remain_watts",
  download: "omada_device_download",
  upload: "omada_device_upload",
  util_2g: "omada_device_2g_rx_util",
  util_5g: "omada_device_5g_rx_util",
};

/** entity id of the OmadaBridge sensor behind a device stat (for more-info / history) */
export function deviceStatEntityId(
  hass: MushroomHass,
  device: DeviceRecord,
  stat: string
): string | undefined {
  const metric = DEVICE_STAT_METRIC[stat];
  if (!metric) return undefined;
  const mac = normalizeMacKey(device.mac);
  for (const entity of Object.values(hass.states)) {
    const a = entity.attributes as Record<string, unknown>;
    if (
      a.metric === metric &&
      normalizeMacKey(String(a.device_mac ?? "")) === mac
    ) {
      return entity.entity_id;
    }
  }
  return undefined;
}

/** The primary device-level entity, used for more-info / badges. */
export function deviceEntityId(
  hass: MushroomHass,
  device: DeviceRecord
): string | undefined {
  const mac = normalizeMacKey(device.mac);
  for (const entity of Object.values(hass.states)) {
    const a = entity.attributes as Record<string, unknown>;
    if (
      a.metric === "omada_device_uptime_seconds" &&
      normalizeMacKey(String(a.device_mac ?? "")) === mac
    ) {
      return entity.entity_id;
    }
  }
  return undefined;
}

export function listClients(hass: MushroomHass, site?: string): ClientRecord[] {
  return getDashboardModel(omadaHass(hass), site ? { site } : undefined)
    .clients;
}

/** Match by MAC (any separator / case), IP or name (case-insensitive). */
export function findClient(
  hass: MushroomHass,
  client: string | undefined,
  site?: string
): ClientRecord | undefined {
  if (!client) return undefined;
  const wanted = client.trim().toLowerCase();
  const wantedMac = normalizeMacKey(client);
  return listClients(hass, site).find(
    (c) =>
      (wantedMac && normalizeMacKey(c.mac) === wantedMac) ||
      c.ip.toLowerCase() === wanted ||
      c.name.toLowerCase() === wanted ||
      c.key.toLowerCase() === wanted
  );
}

/** "Wi-Fi · IoT · AP-2" or "Wired · SG3218XP · Port 3" */
export function clientVia(client: ClientRecord, short = false): string {
  if (client.wireless) {
    const parts = [client.ssid, client.apName].filter(Boolean);
    return short ? parts.join(" · ") : ["Wi-Fi", ...parts].join(" · ");
  }
  const where = client.switchName || client.gatewayName;
  const port = client.attachmentLagId
    ? `LAG ${client.attachmentLagId}`
    : client.attachmentPort
      ? `Port ${client.attachmentPort}`
      : "";
  const parts = [where, port].filter(Boolean);
  return short ? parts.join(" · ") : ["Wired", ...parts].join(" · ");
}

/** Real throughput in bit/s: Omada's client "activity" counters are bytes per second. */
export function clientRate(client: ClientRecord): number {
  return (
    ((client.metrics.omada_client_download_activity_bytes ?? 0) +
      (client.metrics.omada_client_upload_activity_bytes ?? 0)) *
    8
  );
}

export function clientDownRate(client: ClientRecord): number {
  return (client.metrics.omada_client_download_activity_bytes ?? 0) * 8;
}

export function clientUpRate(client: ClientRecord): number {
  return (client.metrics.omada_client_upload_activity_bytes ?? 0) * 8;
}

// ---- wired topology (OmadaBridge >= 2.4.4-qoxi.3: omada_device_uplink_link_speed_mbps)

export interface DeviceUplink {
  parentMac: string;
  parentName: string;
  parentType: string;
  /** port number on the parent, or "LAG n" */
  parentPort: string;
  /** own port number (empty for APs) */
  localPort: string;
  lagId: string;
  /** own LAG member ports */
  lagPorts: string[];
  speedMbps: number;
  entityId: string;
}

function entityForDevice(
  hass: MushroomHass,
  mac: string,
  metric: string,
  extra?: (attrs: Record<string, unknown>) => boolean
): HassEntityLike | undefined {
  const wanted = normalizeMacKey(mac);
  for (const entity of Object.values(hass.states)) {
    const a = entity.attributes as Record<string, unknown>;
    if (
      a.metric === metric &&
      normalizeMacKey(String(a.device_mac ?? "")) === wanted &&
      (!extra || extra(a))
    ) {
      return entity as unknown as HassEntityLike;
    }
  }
  return undefined;
}

interface HassEntityLike {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export function deviceUplink(
  hass: MushroomHass,
  device: DeviceRecord
): DeviceUplink | undefined {
  const entity = entityForDevice(
    hass,
    device.mac,
    "omada_device_uplink_link_speed_mbps"
  );
  if (!entity) return undefined;
  const a = entity.attributes;
  const parentMac = String(a.uplink_mac ?? "");
  if (!parentMac) return undefined;
  return {
    parentMac,
    parentName: String(a.uplink_name ?? ""),
    parentType: String(a.uplink_type ?? ""),
    parentPort: String(a.uplink_port ?? ""),
    localPort: String(a.uplink_local_port ?? ""),
    lagId: String(a.uplink_lag_id ?? ""),
    lagPorts: String(a.uplink_lag_ports ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    speedMbps: Number(entity.state) || 0,
    entityId: entity.entity_id,
  };
}

/** member ports of a LAG on a switch, from the bridge's omada_lag_* entities */
export function lagMemberPorts(
  hass: MushroomHass,
  deviceMac: string,
  lagId: string
): string[] {
  const entity = entityForDevice(
    hass,
    deviceMac,
    "omada_lag_link_status",
    (a) => String(a.lag_id ?? "") === lagId
  );
  return String(entity?.attributes.lag_ports ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/** parent, grandparent, … up to the gateway (cycle-safe) */
export function deviceChain(
  hass: MushroomHass,
  device: DeviceRecord,
  site?: string
): { device: DeviceRecord; via: DeviceUplink }[] {
  const devices = listDevices(hass, site);
  const byMac = new Map(devices.map((d) => [normalizeMacKey(d.mac), d]));
  const chain: { device: DeviceRecord; via: DeviceUplink }[] = [];
  const seen = new Set<string>([normalizeMacKey(device.mac)]);
  let current = device;
  for (let i = 0; i < 8; i++) {
    const up = deviceUplink(hass, current);
    if (!up) break;
    const parent = byMac.get(normalizeMacKey(up.parentMac));
    if (!parent || seen.has(normalizeMacKey(parent.mac))) break;
    seen.add(normalizeMacKey(parent.mac));
    chain.push({ device: parent, via: up });
    current = parent;
  }
  return chain;
}

/** "Port 3 · 2.5 Gbps" — how `child` plugs into its parent */
export function uplinkLabel(up: DeviceUplink, portWord: string): string {
  const port = /^LAG/i.test(up.parentPort)
    ? up.parentPort
    : `${portWord} ${up.parentPort}`;
  return [port, up.speedMbps ? formatSpeedMbps(up.speedMbps) : ""]
    .filter(Boolean)
    .join(" · ");
}

/** child devices hanging off each port of `device` (LAG parents expanded to member ports) */
export function childrenByPort(
  hass: MushroomHass,
  device: DeviceRecord,
  site?: string
): Map<string, { name: string; type: string; speedMbps: number }[]> {
  const result = new Map<
    string,
    { name: string; type: string; speedMbps: number }[]
  >();
  const mac = normalizeMacKey(device.mac);
  for (const other of listDevices(hass, site)) {
    if (normalizeMacKey(other.mac) === mac) continue;
    const up = deviceUplink(hass, other);
    if (!up || normalizeMacKey(up.parentMac) !== mac) continue;
    const lag = /^LAG\s*(\d+)/i.exec(up.parentPort);
    const ports = lag
      ? lagMemberPorts(hass, device.mac, lag[1])
      : [up.parentPort];
    for (const port of ports) {
      const list = result.get(port) ?? [];
      list.push({
        name: other.name,
        type: other.type,
        speedMbps: up.speedMbps,
      });
      result.set(port, list);
    }
  }
  return result;
}

/** own ports that form this device's uplink */
export function uplinkPortsOf(
  hass: MushroomHass,
  device: DeviceRecord
): Set<string> {
  const up = deviceUplink(hass, device);
  if (!up) return new Set();
  return new Set(
    up.lagPorts.length ? up.lagPorts : up.localPort ? [up.localPort] : []
  );
}
