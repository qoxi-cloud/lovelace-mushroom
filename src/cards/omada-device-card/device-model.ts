// qoxi: thin adapter over the OmadaBridge dashboard model for one device.
import { HomeAssistant as MushroomHass } from "../../ha";
import { formatRateBits, formatUptimeSeconds } from "../../shared/omada/format";
import {
  getDashboardModel,
  isDeviceConnected,
  normalizeMacKey,
} from "../../shared/omada/model";
import type {
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
