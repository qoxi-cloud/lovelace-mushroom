import { html } from "lit";
import { customElement } from "lit/decorators.js";
import setupCustomlocalize from "../../localize";
import {
  formatBytes,
  formatRateBits,
  formatSpeedMbps,
  qualityLabel,
} from "../../shared/omada/format";
import { QoxiSheet, SheetRow, showSheet } from "../../shared/qoxi-sheet";
import { computeRgbColor } from "../../utils/colors";
import {
  ClientRecord,
  clientVia,
  findClient,
} from "../omada-device-card/device-model";

export const OMADA_CLIENT_DETAIL_DIALOG_NAME =
  "mushroom-omada-client-detail-dialog";

export interface OmadaClientDetailDialogParams {
  client: string;
  site?: string;
}

export function showOmadaClientDetailDialog(
  element: HTMLElement,
  params: OmadaClientDetailDialogParams
) {
  showSheet(element, OMADA_CLIENT_DETAIL_DIALOG_NAME, params);
}

export function clientIcon(client: ClientRecord): string {
  const cat = `${client.category} ${client.clientType}`.toLowerCase();
  if (/camera|ipc/.test(cat)) return "mdi:cctv";
  if (/phone|mobile/.test(cat)) return "mdi:cellphone";
  if (/tablet|ipad/.test(cat)) return "mdi:tablet";
  if (/tv|media|apple tv/.test(cat)) return "mdi:television";
  if (/printer/.test(cat)) return "mdi:printer";
  if (/computer|desktop|laptop|pc|mac/.test(cat)) return "mdi:laptop";
  if (/iot|smart|appliance|washer|fridge/.test(cat))
    return "mdi:home-automation";
  return client.wireless ? "mdi:wifi" : "mdi:ethernet";
}

export function signalTone(pct: number): SheetRow["tone"] {
  if (pct <= 0) return "normal";
  if (pct < 40) return "danger";
  if (pct < 65) return "warning";
  return "normal";
}

@customElement(OMADA_CLIENT_DETAIL_DIALOG_NAME)
export class OmadaClientDetailDialog extends QoxiSheet<OmadaClientDetailDialogParams> {
  private get _client(): ClientRecord | undefined {
    if (!this._params || !this.hass) return undefined;
    return findClient(this.hass, this._params.client, this._params.site);
  }

  protected renderHeader() {
    const client = this._client;
    const name = client?.name || client?.hostName || this._params?.client || "";
    if (!client) {
      return html`<div class="header"><span class="name">${name}</span></div>`;
    }
    const rgb = computeRgbColor(client.wireless ? "teal" : "indigo");
    const subtitle = [clientVia(client), client.ip].filter(Boolean).join(" · ");
    return this.renderTitle(clientIcon(client), rgb, false, name, subtitle);
  }

  protected renderBody() {
    const client = this._client;
    const localize = setupCustomlocalize(this.hass);
    if (!client) return html`<p>${localize("card.not_found")}</p>`;
    const t = (key: string) => localize(`card.omada_clients.detail.${key}`);
    const m = client.metrics;
    const signal = m.omada_client_signal_pct ?? 0;

    const hero: SheetRow[] = [
      {
        label: t("down_rate"),
        value: formatRateBits(m.omada_client_rx_rate ?? 0),
      },
      {
        label: t("up_rate"),
        value: formatRateBits(m.omada_client_tx_rate ?? 0),
      },
    ];
    if (client.wireless) {
      hero.push({
        label: t("signal"),
        value: signal ? `${signal.toFixed(0)} %` : "—",
        tone: signalTone(signal),
      });
      hero.push({
        label: t("rssi"),
        value:
          m.omada_client_rssi_dbm !== undefined
            ? `${m.omada_client_rssi_dbm.toFixed(0)} dBm`
            : "—",
      });
    } else {
      hero.push({
        label: t("link_speed"),
        value: client.attachmentLinkSpeedMbps
          ? formatSpeedMbps(client.attachmentLinkSpeedMbps)
          : "—",
      });
      hero.push({ label: t("vlan"), value: client.vlanId || "—" });
    }

    const info: SheetRow[] = [
      { label: t("name"), value: client.name || "—" },
      { label: t("host_name"), value: client.hostName || "—" },
      { label: t("mac"), value: client.mac || "—" },
      { label: t("vendor"), value: client.vendor || "—" },
      {
        label: t("category"),
        value:
          [client.category, client.clientType].filter(Boolean).join(" / ") ||
          "—",
      },
      { label: t("ip"), value: client.ip || "—" },
      { label: t("vlan"), value: client.vlanId || "—" },
    ];

    const conn: SheetRow[] = client.wireless
      ? [
          { label: t("type"), value: "Wi-Fi" },
          { label: t("ssid"), value: client.ssid || "—" },
          { label: t("ap"), value: client.apName || "—" },
          { label: t("wifi_mode"), value: client.wifiMode || "—" },
          {
            label: t("signal"),
            value: signal
              ? `${signal.toFixed(0)} % · ${qualityLabel(signal, m.omada_client_rssi_dbm ?? 0)}`
              : "—",
            tone: signalTone(signal),
          },
          {
            label: t("rssi"),
            value:
              m.omada_client_rssi_dbm !== undefined
                ? `${m.omada_client_rssi_dbm.toFixed(0)} dBm`
                : "—",
          },
          {
            label: t("snr"),
            value:
              m.omada_client_snr_dbm !== undefined
                ? `${m.omada_client_snr_dbm.toFixed(0)} dB`
                : "—",
          },
        ]
      : [
          { label: t("type"), value: t("wired") },
          {
            label: t("device"),
            value: client.switchName || client.gatewayName || "—",
          },
          {
            label: t("port"),
            value: client.attachmentLagId
              ? `LAG ${client.attachmentLagId}${client.attachmentLagPorts ? ` (${client.attachmentLagPorts})` : ""}`
              : client.attachmentPort || "—",
          },
          {
            label: t("link_speed"),
            value: client.attachmentLinkSpeedMbps
              ? formatSpeedMbps(client.attachmentLinkSpeedMbps)
              : "—",
          },
        ];

    const traffic: SheetRow[] = [
      {
        label: t("down_total"),
        value: formatBytes(m.omada_client_traffic_down_bytes ?? 0),
      },
      {
        label: t("up_total"),
        value: formatBytes(m.omada_client_traffic_up_bytes ?? 0),
      },
      {
        label: t("down_activity"),
        value: formatBytes(m.omada_client_download_activity_bytes ?? 0),
      },
      {
        label: t("up_activity"),
        value: formatBytes(m.omada_client_upload_activity_bytes ?? 0),
      },
    ];

    return html`
      <div class="hero">${hero.map((r) => this.renderStat(r))}</div>
      <div class="columns">
        ${this.renderSection(
          t("client"),
          client.wireless ? "Wi-Fi" : t("wired"),
          info
        )}
        <div>
          ${this.renderSection(
            t("connection"),
            client.wireless
              ? client.apName || ""
              : client.switchName || client.gatewayName || "",
            conn
          )}
          <div style="height: 16px"></div>
          ${this.renderSection(t("traffic"), t("session"), traffic)}
        </div>
      </div>
    `;
  }
}
