// qoxi: vendor-neutral metric contract.
//
// Every bridge (OmadaBridge today, a UniFi bridge tomorrow) publishes Home
// Assistant entities through MQTT discovery with an attribute `metric` =
// `net_<name>` plus a fixed label set (device_mac, device_type, port, mac,
// switch_mac, ssid, uplink_name, …) as written down in docs/contract.md. There
// are no vendor prefixes: a bridge that does not speak `net_*` is not a bridge.
export const CANONICAL_PREFIX = "net_";

/** the `metric` attribute as a string ("" when absent) */
export function canonicalMetric(metric: unknown): string {
  return String(metric ?? "");
}

/** true when an entity carries a bridge metric */
export function isBridgeMetric(metric: unknown): boolean {
  return canonicalMetric(metric).startsWith(CANONICAL_PREFIX);
}
