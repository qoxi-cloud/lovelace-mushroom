import {
  array,
  assign,
  boolean,
  enums,
  object,
  optional,
  string,
} from "superstruct";
import { lovelaceCardConfigStruct } from "../../shared/config/lovelace-card-config";
import { LovelaceCardConfig } from "../../ha";

/** how the second line of a pill is computed from hass.states */
export const STATUS_KINDS = [
  "count_on", // "<n> On" over `entities` or every entity of `domain`
  "count", // "<n>" entities (any state) of `domain` / `entities`
  "temperature", // mean `current_temperature` of `entities` (climates)
  "state", // state of `entity`, optionally mapped through `map`
  "attribute_equals", // "<n> <suffix>" entities whose `attribute` == `equals`
] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];

export interface CategoryStatus {
  kind: StatusKind;
  domain?: string;
  entities?: string[];
  entity?: string;
  attribute?: string;
  equals?: string;
  map?: Record<string, string>;
  suffix?: string;
}

export interface CategoryItem {
  label: string;
  icon: string;
  color?: string;
  path: string;
  status?: CategoryStatus;
}

export type CategoryBarCardConfig = LovelaceCardConfig & {
  title?: string;
  items: CategoryItem[];
  home_path?: string;
  show_home_button?: boolean;
};

const statusStruct = object({
  kind: enums(STATUS_KINDS),
  domain: optional(string()),
  entities: optional(array(string())),
  entity: optional(string()),
  attribute: optional(string()),
  equals: optional(string()),
  map: optional(object()),
  suffix: optional(string()),
});

export const categoryBarCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  object({
    title: optional(string()),
    items: array(
      object({
        label: string(),
        icon: string(),
        color: optional(string()),
        path: string(),
        status: optional(statusStruct),
      })
    ),
    home_path: optional(string()),
    show_home_button: optional(boolean()),
  })
);
