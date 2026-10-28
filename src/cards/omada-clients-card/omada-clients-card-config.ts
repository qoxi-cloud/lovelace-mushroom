import {
  assign,
  boolean,
  enums,
  number,
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

export const CLIENT_FILTERS = ["all", "wired", "wireless"] as const;
export type ClientFilter = (typeof CLIENT_FILTERS)[number];

export const CLIENT_SORTS = ["rate", "name", "ip"] as const;
export type ClientSort = (typeof CLIENT_SORTS)[number];

export type OmadaClientsCardConfig = LovelaceCardConfig &
  AppearanceSharedConfig & {
    site?: string;
    name?: string;
    icon?: string;
    icon_color?: string;
    filter?: ClientFilter;
    show_filters?: boolean;
    sort?: ClientSort;
    limit?: number;
    /** only clients attached to this device (name or MAC) */
    device?: string;
  };

export const omadaClientsCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  appearanceSharedConfigStruct,
  object({
    site: optional(string()),
    name: optional(string()),
    icon: optional(string()),
    icon_color: optional(string()),
    filter: optional(enums(CLIENT_FILTERS)),
    show_filters: optional(boolean()),
    sort: optional(enums(CLIENT_SORTS)),
    limit: optional(number()),
    device: optional(string()),
  })
);
