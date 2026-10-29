// qoxi: PON ONU sticks / modems. Sources are discovered through the
// vendor-neutral contract in ./onu-contract.ts (attribute `metric: onu_*` or
// entity-id prefixes such as the 8311 ONU Monitor's `8311_onu_`).
import { HassEntity } from "home-assistant-js-websocket";
import { HomeAssistant } from "../../ha";
import { ONU_CANONICAL_PREFIX, ONU_ID_PREFIXES } from "./onu-contract";

export interface OnuDevice {
  serial: string;
  name: string;
  online: boolean;
  /** the source has no usable state right now (unavailable/unknown): not an outage */
  unknown: boolean;
  alarm: boolean;
  ponState: string;
  ponPreviousState: string;
  model: string;
  vendor: string;
  oltVendor: string;
  ponMode: string;
  gponSerial: string;
  linkEntityId: string;
  entities: Map<string, HassEntity>;
  metrics: OnuMetrics;
}

export interface OnuMetrics {
  rx_power: number;
  tx_power: number;
  optic_temp: number;
  cpu_temp: number;
  voltage: number;
  tx_bias: number;
  uptime: number;
  time_in_state: number;
  down_total: number;
  up_total: number;
  down_rate: number;
  up_rate: number;
  fec_corrected: number;
  fec_uncorrected: number;
  bip_errors: number;
  lods_events: number;
  gem_key_errors: number;
  memory: number;
  load_1m: number;
  ethernet_speed: number;
}

interface CounterSample {
  value: number;
  ts: number;
}
const counterHistory = new Map<string, CounterSample>();
const counterRate = new Map<string, number>();

const BYTES: Record<string, number> = {
  B: 1,
  kB: 1e3,
  KB: 1e3,
  KiB: 1024,
  MB: 1e6,
  MiB: 1048576,
  GB: 1e9,
  GiB: 1073741824,
  TB: 1e12,
};
const SECONDS: Record<string, number> = { s: 1, min: 60, h: 3600, d: 86400 };

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unitScale(entity: HassEntity, table: Record<string, number>): number {
  const unit = String(entity.attributes.unit_of_measurement ?? "");
  return table[unit] ?? 1;
}

/** Bytes per second from a monotonically increasing byte counter, remembered across renders. */
function counterRateFor(entity: HassEntity): number {
  const value = toNumber(entity.state) * unitScale(entity, BYTES);
  const ts = Date.parse(entity.last_updated) || Date.now();
  const prev = counterHistory.get(entity.entity_id);
  if (!prev) {
    counterHistory.set(entity.entity_id, { value, ts });
    return counterRate.get(entity.entity_id) ?? 0;
  }
  if (ts > prev.ts) {
    const dt = (ts - prev.ts) / 1000;
    const rate = value >= prev.value && dt > 0 ? (value - prev.value) / dt : 0;
    counterHistory.set(entity.entity_id, { value, ts });
    counterRate.set(entity.entity_id, rate);
  }
  return counterRate.get(entity.entity_id) ?? 0;
}

function stripSuffix(name: string, suffix: string): string {
  return name.endsWith(suffix) ? name.slice(0, -suffix.length).trim() : name;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function collectOnuDevices(
  hass: HomeAssistant,
  prefix?: string
): OnuDevice[] {
  const groups = new Map<string, Map<string, HassEntity>>();
  const idPrefix = new Map<string, string>();
  const names = new Map<string, string>();
  const put = (
    serial: string,
    metric: string,
    entity: HassEntity,
    canonical: boolean
  ) => {
    let group = groups.get(serial);
    if (!group) {
      group = new Map();
      groups.set(serial, group);
    }
    // a canonical entity wins over one matched by entity id only
    if (canonical || !group.has(metric)) group.set(metric, entity);
  };

  // 1. canonical: `metric: onu_<name>` + `serial`
  for (const entity of Object.values(hass.states)) {
    const metric = entity.attributes.metric;
    const serial = entity.attributes.serial;
    if (
      typeof metric !== "string" ||
      !metric.startsWith(ONU_CANONICAL_PREFIX) ||
      typeof serial !== "string" ||
      !serial
    )
      continue;
    const key = serial.toLowerCase();
    put(key, metric.slice(ONU_CANONICAL_PREFIX.length), entity, true);
    const onuName = entity.attributes.onu_name;
    if (typeof onuName === "string" && onuName && !names.has(key))
      names.set(key, onuName);
  }

  // 2. by entity id: `<prefix><serial>_<name>`
  const prefixes = Array.from(
    new Set([...(prefix ? [prefix] : []), ...ONU_ID_PREFIXES])
  );
  for (const p of prefixes) {
    const pattern = new RegExp(
      `^(sensor|binary_sensor)\\.${escapeRegExp(p)}([a-z0-9]+)_(.+)$`
    );
    for (const entity of Object.values(hass.states)) {
      const match = pattern.exec(entity.entity_id);
      if (!match) continue;
      const [, , serial, metric] = match;
      put(serial!, metric!, entity, false);
      if (!idPrefix.has(serial!)) idPrefix.set(serial!, p);
    }
  }

  const devices: OnuDevice[] = [];
  for (const [serial, group] of groups) {
    const get = (key: string) => group.get(key);
    const state = (key: string) => {
      const entity = get(key);
      if (
        !entity ||
        entity.state === "unknown" ||
        entity.state === "unavailable"
      )
        return "";
      return entity.state;
    };
    const num = (key: string) => toNumber(state(key));
    const link = get("pon_link");
    const name =
      names.get(serial) ??
      (link
        ? stripSuffix(String(link.attributes.friendly_name ?? ""), "PON Link")
        : "");
    const uptime = get("onu_uptime");
    const inState = get("pon_time_in_state");
    const down = get("gem_downstream");
    const up = get("gem_upstream");

    devices.push({
      serial,
      name: name || `ONU ${serial.toUpperCase()}`,
      online: link?.state === "on",
      unknown:
        !link || link.state === "unavailable" || link.state === "unknown",
      alarm: get("pon_alarms")?.state === "on",
      ponState: state("pon_state"),
      ponPreviousState: state("pon_previous_state"),
      model: state("part_number"),
      vendor: state("vendor"),
      oltVendor: state("olt_vendor"),
      ponMode: state("pon_mode"),
      gponSerial: state("gpon_serial"),
      linkEntityId:
        link?.entity_id ??
        `binary_sensor.${idPrefix.get(serial) ?? prefixes[0]}${serial}_pon_link`,
      entities: group,
      metrics: {
        rx_power: num("rx_power"),
        tx_power: num("tx_power"),
        optic_temp: num("optic_temperature"),
        cpu_temp: Math.max(num("cpu0_temperature"), num("cpu1_temperature")),
        voltage: num("voltage"),
        tx_bias: num("tx_bias_current"),
        uptime: uptime ? num("onu_uptime") * unitScale(uptime, SECONDS) : 0,
        time_in_state: inState
          ? num("pon_time_in_state") * unitScale(inState, SECONDS)
          : 0,
        down_total: down ? num("gem_downstream") * unitScale(down, BYTES) : 0,
        up_total: up ? num("gem_upstream") * unitScale(up, BYTES) : 0,
        down_rate: down ? counterRateFor(down) : 0,
        up_rate: up ? counterRateFor(up) : 0,
        fec_corrected: num("gtc_fec_corrected"),
        fec_uncorrected: num("gtc_fec_uncorrected"),
        bip_errors: num("gtc_bip_errors"),
        lods_events: num("gtc_lods_events"),
        gem_key_errors: num("gem_key_errors"),
        memory: num("memory_usage"),
        load_1m: num("cpu_load_1m"),
        ethernet_speed: num("ethernet_speed"),
      },
    });
  }
  return devices.sort((a, b) => a.name.localeCompare(b.name));
}

export function findOnu(
  hass: HomeAssistant,
  prefix: string | undefined,
  serial: string | undefined
): OnuDevice | undefined {
  const devices = collectOnuDevices(hass, prefix || undefined);
  if (!serial) return devices[0];
  const wanted = serial.toLowerCase();
  return devices.find((d) => d.serial === wanted);
}

/** "O5 - Operation state" -> "O5 Operation" */
/** nominal downstream / upstream line rate (Gbit/s) of a PON technology */
export function ponLineRates(
  ponMode: string
): { down: number; up: number } | undefined {
  const mode = ponMode.toUpperCase().replace(/[\s_-]/g, "");
  const table: Record<string, [number, number]> = {
    GPON: [2.5, 1.25],
    XGPON: [10, 2.5],
    XGSPON: [10, 10],
    NGPON2: [10, 10],
    "25GPON": [25, 25],
    "50GPON": [50, 25],
  };
  const hit = table[mode];
  return hit ? { down: hit[0], up: hit[1] } : undefined;
}

export function shortPonState(ponState: string): string {
  return ponState
    .replace(/\s*-\s*/, " ")
    .replace(/\s+state$/i, "")
    .trim();
}

/** metric suffix of the 8311 entity behind a card/sheet stat */
const ONU_STAT_ENTITY: Record<string, string> = {
  rx_power: "rx_power",
  tx_power: "tx_power",
  down_rate: "gem_downstream",
  up_rate: "gem_upstream",
  down_total: "gem_downstream",
  up_total: "gem_upstream",
  optic_temp: "optic_temperature",
  cpu_temp: "cpu0_temperature",
  voltage: "voltage",
  tx_bias: "tx_bias_current",
  uptime: "onu_uptime",
  time_in_state: "pon_time_in_state",
  fec_corrected: "gtc_fec_corrected",
  fec_uncorrected: "gtc_fec_uncorrected",
  bip_errors: "gtc_bip_errors",
  lods_events: "gtc_lods_events",
  gem_key_errors: "gem_key_errors",
  memory: "memory_usage",
  load_1m: "cpu_load_1m",
  ethernet_speed: "ethernet_speed",
  pon_state: "pon_state",
  pon_previous_state: "pon_previous_state",
  alarm: "pon_alarms",
};

export function onuStatEntityId(
  onu: OnuDevice,
  stat: string
): string | undefined {
  const suffix = ONU_STAT_ENTITY[stat];
  return suffix ? onu.entities.get(suffix)?.entity_id : undefined;
}

export function formatRate(bytesPerSecond: number): string {
  const bits = bytesPerSecond * 8;
  // same rounding as shared/network/format.ts so "17.5 Mbit/s" does not overflow a phone tile
  if (bits >= 1e9)
    return `${(bits / 1e9).toFixed(bits >= 1e10 ? 0 : 1)} Gbit/s`;
  if (bits >= 1e6) return `${(bits / 1e6).toFixed(bits >= 1e7 ? 0 : 1)} Mbit/s`;
  if (bits >= 1e3) return `${(bits / 1e3).toFixed(0)} kbit/s`;
  return `${bits.toFixed(0)} bit/s`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} kB`;
  return `${bytes.toFixed(0)} B`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function nameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/** Find the ONU serving a WAN/ISP by name tokens, e.g. "LinkCom_sfp2" ↔ "ONU LinkCom (sfp2)". */
export function findOnuForLink(
  onus: OnuDevice[],
  linkName: string
): OnuDevice | undefined {
  const want = nameTokens(linkName);
  if (want.length === 0) return undefined;
  return onus.find((onu) => {
    const have = new Set(nameTokens(onu.name));
    return want.every((t) => have.has(t));
  });
}
