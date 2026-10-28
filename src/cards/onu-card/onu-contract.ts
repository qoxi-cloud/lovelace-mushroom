// qoxi: vendor-neutral ONU contract (docs/contract.md, section "ONU metrics").
//
// An ONU source is any integration or bridge that exposes one HA entity per
// metric per stick. The card finds them two ways, in this order:
//   1. canonical: entities carrying attributes `metric: onu_<name>` and
//      `serial: <serial>` (plus optional `onu_name`); entity ids are free
//   2. by entity id: `sensor.<prefix><serial>_<name>` for the prefixes below
//      (the 8311 ONU Monitor integration sets no attributes, so it is matched
//      this way; `net_onu_` is the suggested prefix for a bridge that does not
//      publish attributes either)
// A card option `prefix` adds one more entity-id prefix for exotic sources.
export const ONU_CANONICAL_PREFIX = "onu_";

export const ONU_ID_PREFIXES = ["net_onu_", "8311_onu_"] as const;

/** metric names (`onu_<name>` / `<prefix><serial>_<name>`); names follow the 8311 firmware vocabulary */
export const ONU_METRICS = [
  // identity / state
  "pon_link", // binary_sensor, on = O5 operation
  "pon_alarms", // binary_sensor, on = alarm raised
  "pon_state", // "O5 - Operation state"
  "pon_previous_state",
  "pon_time_in_state", // h
  "pon_mode", // GPON | XG-PON | XGS-PON | …
  "pon_vendor_id",
  "gpon_serial",
  "vendor",
  "olt_vendor",
  "part_number",
  "hardware_revision",
  "module_type",
  "active_firmware_bank",
  // optics
  "rx_power", // dBm
  "tx_power", // dBm
  "optic_temperature", // °C
  "voltage", // V
  "tx_bias_current", // mA
  // host
  "cpu0_temperature", // °C
  "cpu1_temperature", // °C
  "cpu_load_1m",
  "memory_usage", // %
  "onu_uptime", // h
  "ethernet_speed", // Mbps
  // traffic / errors (monotonic counters)
  "gem_downstream", // bytes, unit attribute honoured (B…TB)
  "gem_upstream",
  "gem_key_errors",
  "gtc_bip_errors",
  "gtc_fec_corrected",
  "gtc_fec_uncorrected",
  "gtc_lods_events",
] as const;

export type OnuMetric = (typeof ONU_METRICS)[number];
