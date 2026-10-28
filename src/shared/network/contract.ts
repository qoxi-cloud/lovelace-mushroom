// qoxi: vendor-neutral metric contract.
//
// Every bridge (OmadaBridge today, a UniFi bridge tomorrow) publishes Home
// Assistant entities through MQTT discovery with an attribute `metric` =
// `<vendor>_<name>` plus a fixed label set (device_mac, device_type, port,
// mac, switch_mac, ssid, uplink_name, …). The cards only ever see the
// canonical `net_<name>` form, so a new vendor only needs a prefix here and a
// bridge that honours the names in docs/contract.md.
export const VENDOR_PREFIXES = ["omada_", "unifi_", "net_"] as const;

export const CANONICAL_PREFIX = "net_";

/** `net_device_cpu_percentage` → `net_device_cpu_percentage`; unknown prefixes pass through */
export function canonicalMetric(metric: unknown): string {
  const name = String(metric ?? "");
  for (const prefix of VENDOR_PREFIXES) {
    if (name.startsWith(prefix)) {
      return CANONICAL_PREFIX + name.slice(prefix.length);
    }
  }
  return name;
}

/** true when an entity carries a bridge metric of any known vendor */
export function isBridgeMetric(metric: unknown): boolean {
  const name = String(metric ?? "");
  return VENDOR_PREFIXES.some((prefix) => name.startsWith(prefix));
}
