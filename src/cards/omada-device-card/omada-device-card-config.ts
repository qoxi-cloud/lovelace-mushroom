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

export const DEVICE_STATS = [
  "cpu",
  "mem",
  "clients",
  "uptime",
  "rx_rate",
  "tx_rate",
  "ports_up",
  "temp",
  "poe_remain",
  "util_2g",
  "util_5g",
  "download",
  "upload",
  "model",
  "firmware",
] as const;

export type DeviceStat = (typeof DEVICE_STATS)[number];

export const DEFAULT_DEVICE_STATS: DeviceStat[] = [
  "cpu",
  "mem",
  "clients",
  "uptime",
];

export type OmadaDeviceCardConfig = LovelaceCardConfig &
  AppearanceSharedConfig &
  ActionsSharedConfig & {
    device?: string;
    site?: string;
    name?: string;
    icon?: string;
    icon_color?: string;
    stats?: DeviceStat[];
  };

export const omadaDeviceCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  assign(appearanceSharedConfigStruct, actionsSharedConfigStruct),
  object({
    device: optional(string()),
    site: optional(string()),
    name: optional(string()),
    icon: optional(string()),
    icon_color: optional(string()),
    stats: optional(array(enums(DEVICE_STATS))),
  })
);
