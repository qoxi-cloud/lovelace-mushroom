import { array, assign, enums, object, optional, string } from "superstruct";
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

export const ISP_STATS = [
  "latency",
  "down_rate",
  "up_rate",
  "link_speed",
  "ip",
  "rx_power",
  "tx_power",
  "onu_uptime",
] as const;

export type IspStat = (typeof ISP_STATS)[number];

export const DEFAULT_ISP_STATS: IspStat[] = [
  "latency",
  "down_rate",
  "up_rate",
  "link_speed",
];

export type IspCardConfig = LovelaceCardConfig &
  AppearanceSharedConfig &
  ActionsSharedConfig & {
    wan?: string;
    onu_prefix?: string;
    name?: string;
    icon?: string;
    icon_color?: string;
    stats?: IspStat[];
  };

export const ispCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  assign(appearanceSharedConfigStruct, actionsSharedConfigStruct),
  object({
    wan: optional(string()),
    onu_prefix: optional(string()),
    name: optional(string()),
    icon: optional(string()),
    icon_color: optional(string()),
    stats: optional(array(enums(ISP_STATS))),
  })
);
