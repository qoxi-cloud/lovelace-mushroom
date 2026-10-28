// qoxi: thin adapter over the OmadaBridge dashboard model for one device.
import { HomeAssistant as MushroomHass } from "../../ha";
import { formatRateBits, formatUptimeSeconds } from "../../shared/omada/format";
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

export function clientRate(client: ClientRecord): number {
  return (
    (client.metrics.omada_client_rx_rate ?? 0) +
    (client.metrics.omada_client_tx_rate ?? 0)
  );
}
