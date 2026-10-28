import { html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import setupCustomlocalize from "../../localize";
import { QoxiSheet, SheetRow, showSheet } from "../../shared/qoxi-sheet";
import { computeRgbColor } from "../../utils/colors";
import { DEFAULT_ONU_ICON } from "./const";
import {
  findOnu,
  formatBytes,
  formatDuration,
  formatRate,
  OnuDevice,
  shortPonState,
} from "./onu-model";

export const ONU_DETAIL_DIALOG_NAME = "mushroom-onu-detail-dialog";

export interface OnuDetailDialogParams {
  serial?: string;
  prefix?: string;
  name?: string;
  icon?: string;
  icon_color?: string;
}

export function showOnuDetailDialog(
  element: HTMLElement,
  params: OnuDetailDialogParams
) {
  showSheet(element, ONU_DETAIL_DIALOG_NAME, params);
}

export function onuHeroRows(
  onu: OnuDevice,
  t: (k: string) => string
): SheetRow[] {
  const m = onu.metrics;
  return [
    {
      label: t("rx_power"),
      value: `${m.rx_power.toFixed(2)} dBm`,
      tone:
        m.rx_power <= -27
          ? "danger"
          : m.rx_power <= -24
            ? "warning"
            : m.rx_power < 0
              ? "success"
              : "normal",
    },
    {
      label: t("tx_power"),
      value: `${m.tx_power.toFixed(2)} dBm`,
      tone:
        m.tx_power > 0 && m.tx_power < 9
          ? "success"
          : m.tx_power <= -30
            ? "danger"
            : "warning",
    },
    {
      label: t("uptime"),
      value: formatDuration(m.uptime),
      tone: m.uptime > 3600 ? "success" : m.uptime > 0 ? "warning" : "normal",
    },
    {
      label: t("time_in_state"),
      value: formatDuration(m.time_in_state),
      tone: onu.online ? "success" : "danger",
    },
    {
      label: t("optic_temp"),
      value: `${m.optic_temp.toFixed(1)} °C`,
      tone:
        m.optic_temp >= 70
          ? "danger"
          : m.optic_temp >= 60
            ? "warning"
            : "success",
    },
    {
      label: t("cpu_temp"),
      value: `${m.cpu_temp.toFixed(1)} °C`,
      tone:
        m.cpu_temp >= 85 ? "danger" : m.cpu_temp >= 75 ? "warning" : "success",
    },
    {
      label: t("down_rate"),
      value: formatRate(m.down_rate),
      tone: m.down_rate > 0 ? "success" : "normal",
    },
    {
      label: t("up_rate"),
      value: formatRate(m.up_rate),
      tone: m.up_rate > 0 ? "success" : "normal",
    },
  ];
}

export function onuLinkRows(
  onu: OnuDevice,
  t: (k: string) => string
): SheetRow[] {
  const m = onu.metrics;
  return [
    { label: t("vendor"), value: onu.vendor || "—" },
    {
      label: t("pon_state"),
      value: onu.ponState || "—",
      tone: /^O5/.test(onu.ponState)
        ? "success"
        : /^O[1-4]/.test(onu.ponState)
          ? "warning"
          : onu.ponState
            ? "danger"
            : "normal",
    },
    { label: t("pon_previous_state"), value: onu.ponPreviousState || "—" },
    { label: t("pon_mode"), value: onu.ponMode || "—" },
    { label: t("gpon_serial"), value: onu.gponSerial || "—" },
    { label: t("sfp_serial"), value: onu.serial.toUpperCase() },
    {
      label: t("voltage"),
      value: `${m.voltage.toFixed(3)} V`,
      tone:
        m.voltage >= 3.13 && m.voltage <= 3.47
          ? "success"
          : m.voltage > 0
            ? "warning"
            : "normal",
    },
    {
      label: t("tx_bias"),
      value: `${m.tx_bias.toFixed(2)} mA`,
      tone:
        m.tx_bias > 0 && m.tx_bias < 60
          ? "success"
          : m.tx_bias >= 60
            ? "warning"
            : "normal",
    },
    {
      label: t("memory"),
      value: `${m.memory.toFixed(0)} %`,
      tone: m.memory >= 90 ? "danger" : m.memory >= 80 ? "warning" : "success",
    },
    {
      label: t("load_1m"),
      value: m.load_1m.toFixed(2),
      tone: m.load_1m >= 2 ? "danger" : m.load_1m >= 1 ? "warning" : "success",
    },
    {
      label: t("ethernet_speed"),
      value: m.ethernet_speed ? `${m.ethernet_speed} Mbit/s` : "—",
      tone:
        m.ethernet_speed >= 10000
          ? "success"
          : m.ethernet_speed > 0
            ? "warning"
            : "normal",
    },
  ];
}

export function onuTrafficRows(
  onu: OnuDevice,
  t: (k: string) => string
): SheetRow[] {
  const m = onu.metrics;
  return [
    {
      label: t("down_total"),
      value: formatBytes(m.down_total),
      tone: "normal",
    },
    { label: t("up_total"), value: formatBytes(m.up_total), tone: "normal" },
    {
      label: t("gem_key_errors"),
      value: String(m.gem_key_errors),
      tone: m.gem_key_errors > 0 ? "warning" : "success",
    },
    {
      label: t("fec_corrected"),
      value: String(m.fec_corrected),
      tone: m.fec_corrected > 10000 ? "warning" : "success",
    },
    {
      label: t("fec_uncorrected"),
      value: String(m.fec_uncorrected),
      tone: m.fec_uncorrected > 0 ? "danger" : "success",
    },
    {
      label: t("bip_errors"),
      value: String(m.bip_errors),
      tone: m.bip_errors > 0 ? "warning" : "success",
    },
    {
      label: t("lods_events"),
      value: String(m.lods_events),
      tone: m.lods_events > 0 ? "warning" : "success",
    },
    {
      label: t("alarm"),
      value: onu.alarm ? t("alarm_active") : t("alarm_none"),
      tone: onu.alarm ? "danger" : "success",
    },
  ];
}

export function onuSubtitle(
  onu: OnuDevice,
  localize: ReturnType<typeof setupCustomlocalize>
): string {
  const status = onu.online
    ? localize("card.onu.online")
    : localize("card.onu.offline");
  return `${status}${onu.ponState ? ` · ${shortPonState(onu.ponState)}` : ""}${
    onu.model ? ` · ${onu.model}` : ""
  }`;
}

@customElement(ONU_DETAIL_DIALOG_NAME)
export class OnuDetailDialog extends QoxiSheet<OnuDetailDialogParams> {
  private get _onu(): OnuDevice | undefined {
    if (!this._params || !this.hass) return undefined;
    return findOnu(this.hass, this._params.prefix, this._params.serial);
  }

  protected renderHeader() {
    const onu = this._onu;
    const name = this._params?.name || onu?.name || this._params?.serial || "";
    if (!onu) {
      return html`<div class="header"><span class="name">${name}</span></div>`;
    }
    const localize = setupCustomlocalize(this.hass);
    const rgb = computeRgbColor(
      this._params?.icon_color ?? (onu.online ? "green" : "grey")
    );
    return this.renderTitle(
      this._params?.icon ?? DEFAULT_ONU_ICON,
      rgb,
      !onu.online,
      name,
      onuSubtitle(onu, localize)
    );
  }

  protected renderBody() {
    const onu = this._onu;
    const localize = setupCustomlocalize(this.hass);
    if (!onu) return html`<p>${localize("card.not_found")}</p>`;
    const t = (key: string) => localize(`card.onu.detail.${key}`);
    return html`
      <div class="hero">
        ${onuHeroRows(onu, t).map((r) => this.renderStat(r))}
      </div>
      <div class="columns">
        ${this.renderSection(
          t("pon_link"),
          onu.oltVendor || "OLT",
          onuLinkRows(onu, t)
        )}
        ${this.renderSection(t("traffic"), "GEM", onuTrafficRows(onu, t))}
      </div>
    `;
  }
}
