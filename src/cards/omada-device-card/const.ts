import { PREFIX_NAME } from "../../const";

export const OMADA_DEVICE_CARD_NAME = `${PREFIX_NAME}-omada-device-card`;
export const OMADA_DEVICE_CARD_EDITOR_NAME = `${OMADA_DEVICE_CARD_NAME}-editor`;

export const DEVICE_TYPE_ICONS: Record<string, string> = {
  gateway: "mdi:router-network",
  switch: "mdi:lan",
  ap: "mdi:access-point",
  controller: "mdi:server",
};
export const DEFAULT_DEVICE_ICON = "mdi:network";
