// qoxi: ISP / WAN links published by OmadaBridge (net_exporter) through MQTT
// discovery as `sensor.<gateway>_wan_<metric>_port_<port>_<slug>` plus
// `binary_sensor.<gateway>_isp_status_port_<port>_<slug>`.
import { HassEntity } from "home-assistant-js-websocket";
import { HomeAssistant } from "../../ha";

export type WanState =
  | "online"
  | "offline"
  | "connecting"
  | "disconnecting"
  | "unknown";

export interface WanLink {
  key: string;
  gateway: string;
  gatewayName: string;
  port: number;
  slug: string;
  name: string;
  ip: string;
  proto: string;
  state: WanState;
  ispEnabled: boolean;
  latency: number; // ms
  linkSpeedMbps: number;
  maxBandwidthMbps: number;
  rxRate: number; // bit/s
  txRate: number;
  /** last Ookla run from the bridge (net_wan_speedtest_*); 0 / "" when never run */
  speedtestDownMbps: number;
  speedtestUpMbps: number;
  speedtestLatency: number; // ms
  speedtestJitter: number; // ms
  speedtestLoss: number; // %
  speedtestAt: number; // unix seconds
  speedtestServer: string;
  speedtestStatus: string; // ok | error | ""
  speedtestError: string;
  statusEntityId: string;
  /** latency sensor: the natural "history" entity for an ISP link */
  latencyEntityId: string;
  entities: Record<string, HassEntity | undefined>;
}

const BITS: Record<string, number> = {
  "bit/s": 1,
  "kbit/s": 1e3,
  "Mbit/s": 1e6,
  "Gbit/s": 1e9,
  "B/s": 8,
  "kB/s": 8e3,
  "MB/s": 8e6,
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numState(entity?: HassEntity): number {
  if (!entity || entity.state === "unknown" || entity.state === "unavailable")
    return 0;
  if (entity.state === "on") return 1;
  if (entity.state === "off") return 0;
  return toNumber(entity.state);
}

function bitRate(entity?: HassEntity): number {
  if (!entity) return 0;
  const unit = String(entity.attributes.unit_of_measurement ?? "bit/s");
  return numState(entity) * (BITS[unit] ?? 1);
}

/** unix seconds from a timestamp sensor (ISO state) or a plain numeric state */
function timestampState(entity?: HassEntity): number {
  if (!entity || entity.state === "unknown" || entity.state === "unavailable")
    return 0;
  const n = Number(entity.state);
  if (Number.isFinite(n)) return n > 1e12 ? n / 1000 : n;
  const t = Date.parse(entity.state);
  return Number.isFinite(t) ? t / 1000 : 0;
}

function wanState(status: number, internet: number, isp: number): WanState {
  if (status === 0) return "offline";
  switch (internet) {
    case 0:
      return "offline";
    case 1:
      return "online";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
  }
  return isp === 1 ? "online" : isp === 0 ? "offline" : "unknown";
}

const LATENCY_RE = /^sensor\.(.+?)_wan_latency_port_(\d+)_(.+)$/;

export function collectWanLinks(hass: HomeAssistant): WanLink[] {
  const links: WanLink[] = [];
  for (const entity of Object.values(hass.states)) {
    const match = LATENCY_RE.exec(entity.entity_id);
    if (!match) continue;
    const [, gateway, portText, slug] = match;
    const port = Number(portText);
    const suffix = `port_${portText}_${slug}`;
    const get = (metric: string, domain = "sensor") =>
      hass.states[`${domain}.${gateway}_${metric}_${suffix}`];
    const entities = {
      latency: entity,
      status: get("wan_status"),
      internet: get("wan_internet_state"),
      linkSpeed: get("wan_link_speed_mbps"),
      rx: get("wan_rx_rate"),
      tx: get("wan_tx_rate"),
      isp: get("isp_status", "binary_sensor"),
      ispDown: get("isp_download_speed"),
      ispUp: get("isp_upload_speed"),
      stDown: get("wan_speedtest_download_mbps"),
      stUp: get("wan_speedtest_upload_mbps"),
      stLatency: get("wan_speedtest_latency_ms"),
      stJitter: get("wan_speedtest_jitter_ms"),
      stLoss: get("wan_speedtest_packet_loss_percentage"),
      stRun: get("wan_speedtest_last_run_timestamp"),
    };
    const stAttrs = entities.stRun?.attributes ?? {};
    const attrs = (entities.status ?? entity).attributes;
    const ispAttrs = entities.isp?.attributes ?? {};
    const name = String(attrs.desc ?? attrs.name ?? slug).replace(/_/g, " ");
    links.push({
      key: `${gateway}:${port}`,
      gateway: gateway!,
      gatewayName: String(
        attrs.device_name ?? ispAttrs.gateway_name ?? gateway
      ),
      port,
      slug: slug!,
      name,
      ip: String(attrs.ip ?? ispAttrs.ip ?? ""),
      proto: String(attrs.proto ?? ""),
      state: wanState(
        entities.status ? numState(entities.status) : 1,
        entities.internet ? numState(entities.internet) : -1,
        entities.isp ? numState(entities.isp) : -1
      ),
      ispEnabled: entities.isp ? entities.isp.state === "on" : true,
      latency: numState(entity),
      linkSpeedMbps: numState(entities.linkSpeed),
      maxBandwidthMbps: toNumber(ispAttrs.max_bandwidth),
      rxRate: bitRate(entities.rx),
      txRate: bitRate(entities.tx),
      speedtestDownMbps: numState(entities.stDown),
      speedtestUpMbps: numState(entities.stUp),
      speedtestLatency: numState(entities.stLatency),
      speedtestJitter: numState(entities.stJitter),
      speedtestLoss: numState(entities.stLoss),
      speedtestAt: timestampState(entities.stRun),
      speedtestServer: [stAttrs.server_name, stAttrs.server_location]
        .filter(Boolean)
        .join(", "),
      speedtestStatus: String(stAttrs.speedtest_status ?? ""),
      speedtestError: String(stAttrs.error ?? ""),
      statusEntityId: (entities.status ?? entity).entity_id,
      latencyEntityId: entity.entity_id,
      entities,
    });
  }
  return links.sort((a, b) => a.port - b.port || a.name.localeCompare(b.name));
}

/** Match by `gateway:port`, port number, slug or display name (case-insensitive). */
export function findWanLink(
  hass: HomeAssistant,
  wan: string | undefined
): WanLink | undefined {
  const links = collectWanLinks(hass);
  if (!wan) return links[0];
  const wanted = wan.toLowerCase();
  return links.find(
    (l) =>
      l.key === wanted ||
      String(l.port) === wanted ||
      l.slug.toLowerCase() === wanted ||
      l.name.toLowerCase() === wanted
  );
}

export function formatBitRate(bitsPerSecond: number): string {
  if (bitsPerSecond >= 1e9) return `${(bitsPerSecond / 1e9).toFixed(2)} Gbit/s`;
  if (bitsPerSecond >= 1e6) return `${(bitsPerSecond / 1e6).toFixed(1)} Mbit/s`;
  if (bitsPerSecond >= 1e3) return `${(bitsPerSecond / 1e3).toFixed(0)} kbit/s`;
  return `${bitsPerSecond.toFixed(0)} bit/s`;
}

export function formatLatency(ms: number): string {
  if (ms <= 0) return "—";
  return ms < 10 ? `${ms.toFixed(1)} ms` : `${ms.toFixed(0)} ms`;
}

export function formatMbps(mbps: number): string {
  if (mbps <= 0) return "—";
  return mbps >= 1000 ? `${(mbps / 1000).toFixed(0)} Gbit/s` : `${mbps} Mbit/s`;
}

/** measured throughput: keeps decimals, e.g. 937 Mbit/s, 1.24 Gbit/s */
export function formatMeasuredMbps(mbps: number): string {
  if (mbps <= 0) return "—";
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbit/s`;
  return `${mbps >= 100 ? mbps.toFixed(0) : mbps.toFixed(1)} Mbit/s`;
}

/** "5 min", "2 h", "3 d" since a unix-seconds timestamp; "" when unknown */
export function formatAge(unixSeconds: number, now = Date.now()): string {
  if (unixSeconds <= 0) return "";
  const s = Math.max(0, now / 1000 - unixSeconds);
  if (s < 90) return "now";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

const ISP_STAT_ENTITY: Record<string, string> = {
  latency: "latency",
  link_speed: "linkSpeed",
  rx_rate: "rx",
  tx_rate: "tx",
  isp_enabled: "isp",
  max_bandwidth: "ispDown",
  ip: "status",
  port: "status",
  proto: "status",
  speedtest_down: "stDown",
  speedtest_up: "stUp",
  speedtest_latency: "stLatency",
  speedtest_age: "stRun",
};

export function ispStatEntityId(
  link: WanLink,
  stat: string
): string | undefined {
  const key = ISP_STAT_ENTITY[stat];
  return key ? link.entities[key]?.entity_id : undefined;
}

/** RFC1918, CGNAT (100.64/10), link-local, loopback and unset addresses are "local". */
export function isLocalIp(ip: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip.trim());
  if (!m) return true;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

export function wanStateColor(link: WanLink): string {
  switch (link.state) {
    case "online":
      return "green";
    case "offline":
      return "red";
    case "connecting":
    case "disconnecting":
      return "orange";
    default:
      return "grey";
  }
}

export function latencyTone(ms: number): "normal" | "warning" | "danger" {
  if (ms <= 0) return "normal";
  if (ms >= 100) return "danger";
  if (ms >= 40) return "warning";
  return "normal";
}
