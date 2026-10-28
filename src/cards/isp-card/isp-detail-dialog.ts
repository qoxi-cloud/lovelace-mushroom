import { html } from "lit";
import { customElement } from "lit/decorators.js";
import setupCustomlocalize from "../../localize";
import { QoxiSheet, SheetRow, showSheet } from "../../shared/qoxi-sheet";
import { computeRgbColor } from "../../utils/colors";
import {
  onuHeroRows,
  onuLinkRows,
  onuTrafficRows,
} from "../onu-card/onu-detail-dialog";
import { formatDuration } from "../onu-card/onu-model";
import { DEFAULT_ISP_ICON } from "./const";
import {
  findWanLink,
  formatBitRate,
  formatLatency,
  formatMbps,
  WanLink,
} from "./isp-model";

export const ISP_DETAIL_DIALOG_NAME = "mushroom-isp-detail-dialog";

export interface IspDetailDialogParams {
  wan?: string;
  onu_prefix?: string;
  name?: string;
  icon?: string;
  icon_color?: string;
}

export function showIspDetailDialog(
  element: HTMLElement,
  params: IspDetailDialogParams
) {
  showSheet(element, ISP_DETAIL_DIALOG_NAME, params);
}

export function wanStateColor(link: WanLink): string {
  switch (link.state) {
    case "online":
      return "green";
    case "offline":
      return "red";
    case "connecting":
    case "disconnecting":
      return "orange";
    default:
      return "grey";
  }
}

export function latencyTone(ms: number): SheetRow["tone"] {
  if (ms <= 0) return "normal";
  if (ms >= 100) return "danger";
  if (ms >= 40) return "warning";
  return "normal";
}

@customElement(ISP_DETAIL_DIALOG_NAME)
export class IspDetailDialog extends QoxiSheet<IspDetailDialogParams> {
  private get _link(): WanLink | undefined {
    if (!this._params || !this.hass) return undefined;
    return findWanLink(this.hass, this._params.wan, this._params.onu_prefix);
  }

  protected renderHeader() {
    const link = this._link;
    const name = this._params?.name || link?.name || this._params?.wan || "";
    if (!link) {
      return html`<div class="header"><span class="name">${name}</span></div>`;
    }
    const localize = setupCustomlocalize(this.hass);
    const rgb = computeRgbColor(
      this._params?.icon_color ?? wanStateColor(link)
    );
    const subtitle = [
      localize(`card.isp.state.${link.state}`),
      link.ip && link.ip !== "0.0.0.0" ? link.ip : undefined,
      `${link.gatewayName} · WAN ${link.port}`,
    ]
      .filter(Boolean)
      .join(" · ");
    return this.renderTitle(
      this._params?.icon ?? DEFAULT_ISP_ICON,
      rgb,
      link.state === "offline",
      name,
      subtitle
    );
  }

  protected renderBody() {
    const link = this._link;
    const localize = setupCustomlocalize(this.hass);
    if (!link) return html`<p>${localize("card.not_found")}</p>`;
    const t = (key: string) => localize(`card.isp.detail.${key}`);
    const to = (key: string) => localize(`card.onu.detail.${key}`);

    const hero: SheetRow[] = [
      {
        label: t("latency"),
        value: formatLatency(link.latency),
        tone: latencyTone(link.latency),
      },
      { label: t("down_rate"), value: formatBitRate(link.downRate) },
      { label: t("up_rate"), value: formatBitRate(link.upRate) },
      { label: t("link_speed"), value: formatMbps(link.linkSpeedMbps) },
    ];

    const wanRows: SheetRow[] = [
      {
        label: t("state"),
        value: localize(`card.isp.state.${link.state}`),
        tone:
          link.state === "online"
            ? "success"
            : link.state === "offline"
              ? "danger"
              : "warning",
      },
      {
        label: t("isp_enabled"),
        value: link.ispEnabled ? t("yes") : t("no"),
        tone: link.ispEnabled ? "normal" : "warning",
      },
      { label: t("ip"), value: link.ip || "—" },
      { label: t("proto"), value: link.proto ? link.proto.toUpperCase() : "—" },
      { label: t("gateway"), value: link.gatewayName },
      { label: t("port"), value: String(link.port) },
      { label: t("max_bandwidth"), value: formatMbps(link.maxBandwidthMbps) },
      { label: t("gw_rx"), value: formatBitRate(link.rxRate) },
      { label: t("gw_tx"), value: formatBitRate(link.txRate) },
    ];

    const onu = link.onu;
    return html`
      <div class="hero">${hero.map((r) => this.renderStat(r))}</div>
      ${onu
        ? html`
            <div class="hero">
              ${onuHeroRows(onu, to)
                .slice(0, 4)
                .map((r) => this.renderStat(r))}
            </div>
          `
        : ""}
      <div class="columns ${onu ? "" : "single"}">
        ${this.renderSection(t("wan"), link.gatewayName, wanRows)}
        ${onu
          ? this.renderSection(onu.name, onu.oltVendor || "OLT", [
              ...onuLinkRows(onu, to).slice(0, 6),
              {
                label: to("uptime"),
                value: formatDuration(onu.metrics.uptime),
              },
              ...onuTrafficRows(onu, to).slice(0, 2),
            ])
          : ""}
      </div>
    `;
  }
}
