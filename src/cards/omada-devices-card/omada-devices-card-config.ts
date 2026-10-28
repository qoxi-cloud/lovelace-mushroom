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
  appearanceSharedConfigStruct,
  AppearanceSharedConfig,
} from "../../shared/config/appearance-config";
import { lovelaceCardConfigStruct } from "../../shared/config/lovelace-card-config";
import { LovelaceCardConfig } from "../../ha";
import {
  DEVICE_STATS,
  DeviceStat,
} from "../omada-device-card/omada-device-card-config";

export const DEVICE_TYPES = ["gateway", "switch", "ap", "controller"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_SORTS = ["type", "name", "status"] as const;
export type DeviceSort = (typeof DEVICE_SORTS)[number];

export type OmadaDevicesCardConfig = LovelaceCardConfig &
  AppearanceSharedConfig & {
    site?: string;
    name?: string;
    types?: DeviceType[];
    exclude?: string[];
    stats?: DeviceStat[];
    show_filters?: boolean;
    show_health?: boolean;
    show_header?: boolean;
    sort?: DeviceSort;
  };

export const omadaDevicesCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  appearanceSharedConfigStruct,
  object({
    site: optional(string()),
    name: optional(string()),
    types: optional(array(enums(DEVICE_TYPES))),
    exclude: optional(array(string())),
    stats: optional(array(enums(DEVICE_STATS))),
    show_filters: optional(boolean()),
    show_health: optional(boolean()),
    show_header: optional(boolean()),
    sort: optional(enums(DEVICE_SORTS)),
  })
);
