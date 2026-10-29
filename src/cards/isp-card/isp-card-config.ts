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
  "link_speed",
  "port",
  "proto",
  "ip",
  "isp_enabled",
  "max_bandwidth",
  "rx_rate",
  "tx_rate",
] as const;

export type IspStat = (typeof ISP_STATS)[number];

export const DEFAULT_ISP_STATS: IspStat[] = [
  "latency",
  "link_speed",
  "port",
  "proto",
];

export type IspCardConfig = LovelaceCardConfig &
  AppearanceSharedConfig &
  ActionsSharedConfig & {
    wan?: string;
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
    name: optional(string()),
    icon: optional(string()),
    icon_color: optional(string()),
    stats: optional(array(enums(ISP_STATS))),
  })
);
