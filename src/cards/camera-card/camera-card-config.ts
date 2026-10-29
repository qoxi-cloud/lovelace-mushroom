import { assign, boolean, number, object, optional, string } from "superstruct";
import {
  ActionsSharedConfig,
  actionsSharedConfigStruct,
} from "../../shared/config/actions-config";
import { lovelaceCardConfigStruct } from "../../shared/config/lovelace-card-config";
import { LovelaceCardConfig } from "../../ha";

export type CameraCardConfig = LovelaceCardConfig &
  ActionsSharedConfig & {
    entity: string;
    name?: string;
    /** seconds between snapshot refreshes (default 10) */
    refresh?: number;
    /** CSS aspect ratio, default "16 / 9" */
    aspect_ratio?: string;
    show_age?: boolean;
    /** play the live stream (HLS/WebRTC through HA) instead of snapshots; default true when the camera supports it */
    live?: boolean;
  };

export const cameraCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  actionsSharedConfigStruct,
  object({
    entity: string(),
    name: optional(string()),
    refresh: optional(number()),
    aspect_ratio: optional(string()),
    show_age: optional(boolean()),
    live: optional(boolean()),
  })
);
