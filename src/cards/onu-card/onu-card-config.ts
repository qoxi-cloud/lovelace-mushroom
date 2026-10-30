import {
  array,
  assign,
  boolean,
  enums,
  object,
  optional,
  string,
} from "superstruct";
import {
  ActionsSharedConfig,
  actionsSharedConfigStruct,
} from "../../shared/config/actions-config";
import {
  appearanceSharedConfigStruct,
  AppearanceSharedConfig,
} from "../../shared/config/appearance-config";
import { lovelaceCardConfigStruct } from "../../shared/config/lovelace-card-config";
import { LovelaceCardConfig } from "../../ha";

export const ONU_STATS = [
  "rx_power",
  "tx_power",
  "down_rate",
  "up_rate",
  "down_total",
  "up_total",
  "optic_temp",
  "cpu_temp",
  "voltage",
  "tx_bias",
  "uptime",
  "time_in_state",
  "fec_corrected",
  "fec_uncorrected",
  "bip_errors",
  "lods_events",
  "memory",
  "load_1m",
  "ethernet_speed",
] as const;

export type OnuStat = (typeof ONU_STATS)[number];

// line diagnostics: signal both ways, module temperature (WAS-110 drops PON
// when hot), uncorrectable FEC (fibre/connector trouble before RX dBm shows it);
// throughput lives on the ISP card, from the aggregation switch
export const DEFAULT_ONU_STATS: OnuStat[] = [
  "rx_power",
  "tx_power",
  "optic_temp",
  "fec_uncorrected",
];

export type OnuCardConfig = LovelaceCardConfig &
  AppearanceSharedConfig &
  ActionsSharedConfig & {
    serial?: string;
    prefix?: string;
    name?: string;
    icon?: string;
    icon_color?: string;
    stats?: OnuStat[];
    show_pon_mode?: boolean;
  };

export const onuCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  assign(appearanceSharedConfigStruct, actionsSharedConfigStruct),
  object({
    serial: optional(string()),
    prefix: optional(string()),
    name: optional(string()),
    icon: optional(string()),
    icon_color: optional(string()),
    stats: optional(array(enums(ONU_STATS))),
    show_pon_mode: optional(boolean()),
  })
);
