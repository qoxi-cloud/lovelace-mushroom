import { html } from "lit";
import { customElement } from "lit/decorators.js";
import setupCustomlocalize from "../../localize";
import {
  formatBytes,
  formatRateBits,
  formatSpeedMbps,
  formatUptimeSeconds,
  qualityLabel,
} from "../../shared/network/format";
import {
  PathHop,
  QoxiSheet,
  SheetRow,
  showSheet,
} from "../../shared/qoxi-sheet";
import {
  deviceChain,
  listDevices,
  uplinkLabel,
} from "../omada-device-card/device-model";
import { OMADA_DEVICE_DETAIL_DIALOG_NAME } from "../omada-device-card/omada-device-detail-dialog";
import { DEVICE_TYPE_ICONS } from "../omada-device-card/const";
import { computeRgbColor } from "../../utils/colors";
import {
  ClientRecord,
  clientDownRate,
  clientUpRate,
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

export function linkSpeedTone(mbps: number): SheetRow["tone"] {
  if (mbps <= 0) return "normal";
  if (mbps < 100) return "danger";
  if (mbps < 1000) return "warning";
  return "success";
}

function rssiTone(dbm: number): SheetRow["tone"] {
  if (!dbm) return "normal";
  if (dbm <= -75) return "danger";
  if (dbm <= -65) return "warning";
  return "success";
}

function snrTone(db: number): SheetRow["tone"] {
  if (!db) return "normal";
  if (db < 15) return "danger";
  if (db < 25) return "warning";
  return "success";
}

function activeTone(bps: number): SheetRow["tone"] {
  return bps > 0 ? "success" : "normal";
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

  /** client → attachment device (AP / switch port) → gateway; hops open the device sheet */
  private buildPath(client: ClientRecord, t: (k: string) => string): PathHop[] {
    const devices = listDevices(this.hass, this._params?.site);
    const byName = (name: string) =>
      devices.find((d) => d.name.toLowerCase() === name.toLowerCase());
    const openDevice = (name: string) => () =>
      this.openSheet(OMADA_DEVICE_DETAIL_DIALOG_NAME, {
        device: name,
        site: this._params?.site,
      });
    const hops: PathHop[] = [
      {
        icon: clientIcon(client),
        title: client.name || client.hostName || client.mac,
        subtitle: client.ip || undefined,
      },
    ];
    const band = (mode: string) =>
      /a$/.test(mode) || /ax$/.test(mode)
        ? "5 GHz"
        : /(g|n)$/.test(mode)
          ? "2.4 GHz"
          : "";
    if (client.wireless && client.apName) {
      hops.push({
        icon: DEVICE_TYPE_ICONS.ap,
        title: client.apName,
        subtitle: [client.ssid, band(client.wifiMode), client.wifiMode]
          .filter(Boolean)
          .join(" · "),
        onClick: byName(client.apName) ? openDevice(client.apName) : undefined,
      });
    } else if (client.switchName) {
      hops.push({
        icon: DEVICE_TYPE_ICONS.switch,
        title: client.switchName,
        subtitle: [
          client.attachmentLagId
            ? `LAG ${client.attachmentLagId}`
            : client.attachmentPort
              ? `${t("port")} ${client.attachmentPort}`
              : "",
          client.attachmentLinkSpeedMbps
            ? formatSpeedMbps(client.attachmentLinkSpeedMbps)
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        onClick: byName(client.switchName)
          ? openDevice(client.switchName)
          : undefined,
      });
    }
    // follow the wired topology from the attachment device up to the gateway
    const attached =
      hops.length > 1 ? byName(hops[hops.length - 1].title) : undefined;
    if (attached) {
      for (const { device: hop, via } of deviceChain(
        this.hass,
        attached,
        this._params?.site
      )) {
        hops.push({
          icon: DEVICE_TYPE_ICONS[hop.type] ?? "mdi:lan",
          title: hop.name,
          subtitle: uplinkLabel(via, t("port")),
          onClick: openDevice(hop.name),
        });
      }
    }
    const gateway = devices.find((d) => d.type === "gateway");
    const gatewayName = client.gatewayName || gateway?.name;
    if (gatewayName && gatewayName !== hops[hops.length - 1].title) {
      hops.push({
        icon: DEVICE_TYPE_ICONS.gateway,
        title: gatewayName,
        subtitle:
          [
            String(client.attrs.network_name ?? ""),
            client.vlanId ? `VLAN ${client.vlanId}` : "",
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
        onClick: byName(gatewayName) ? openDevice(gatewayName) : undefined,
      });
    }
    return hops;
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
    const t = (key: string) => localize(`card.net_clients.detail.${key}`);
    const m = client.metrics;
    const signal = m.net_client_signal_pct ?? 0;

    const hero: SheetRow[] = [
      {
        label: t("down_rate"),
        value: formatRateBits(clientDownRate(client)),
        tone: activeTone(clientDownRate(client)),
      },
      {
        label: t("up_rate"),
        value: formatRateBits(clientUpRate(client)),
        tone: activeTone(clientUpRate(client)),
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
          m.net_client_rssi_dbm !== undefined
            ? `${m.net_client_rssi_dbm.toFixed(0)} dBm`
            : "—",
        tone: rssiTone(m.net_client_rssi_dbm ?? 0),
      });
    } else {
      hero.push({
        label: t("link_speed"),
        value: client.attachmentLinkSpeedMbps
          ? formatSpeedMbps(client.attachmentLinkSpeedMbps)
          : "—",
        tone: linkSpeedTone(client.attachmentLinkSpeedMbps ?? 0),
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
      {
        label: t("network"),
        value:
          [
            String(client.attrs.network_name ?? "") ||
              (client.wireless ? client.ssid : ""),
            client.vlanId ? `VLAN ${client.vlanId}` : "",
          ]
            .filter(Boolean)
            .join(" · ") || "—",
      },
      ...(Number(client.attrs.uptime_seconds ?? 0) > 0
        ? [
            {
              label: t("connected_for"),
              value: formatUptimeSeconds(Number(client.attrs.uptime_seconds)),
            },
          ]
        : []),
      ...(client.attrs.health_score !== undefined &&
      client.attrs.health_score !== ""
        ? [
            {
              label: t("health"),
              value: `${client.attrs.health_score} / 10`,
              tone: (Number(client.attrs.health_score) < 5
                ? "danger"
                : Number(client.attrs.health_score) < 8
                  ? "warning"
                  : "normal") as SheetRow["tone"],
            },
          ]
        : []),
      ...(String(client.attrs.guest ?? "") === "true"
        ? [
            {
              label: t("guest"),
              value: t("yes"),
              tone: "warning" as SheetRow["tone"],
            },
          ]
        : []),
      ...(String(client.attrs.blocked ?? "") === "true"
        ? [
            {
              label: t("blocked"),
              value: t("yes"),
              tone: "danger" as SheetRow["tone"],
            },
          ]
        : []),
    ];

    const conn: SheetRow[] = client.wireless
      ? [
          { label: t("status"), value: t("connected"), tone: "success" },
          { label: t("type"), value: "Wi-Fi" },
          { label: t("ssid"), value: client.ssid || "—" },
          ...(client.attrs.channel
            ? [
                {
                  label: t("channel"),
                  value: `${client.attrs.channel}${client.attrs.radio_id === "1" ? " · 5 GHz" : client.attrs.radio_id === "0" ? " · 2.4 GHz" : ""}`,
                },
              ]
            : []),
          ...(String(client.attrs.power_save ?? "") === "true"
            ? [{ label: t("power_save"), value: t("yes") }]
            : []),
          { label: t("ap"), value: client.apName || "—" },
          { label: t("wifi_mode"), value: client.wifiMode || "—" },
          {
            label: t("link_rate"),
            value: `${formatRateBits(m.net_client_rx_rate ?? 0)} / ${formatRateBits(m.net_client_tx_rate ?? 0)}`,
          },
          {
            label: t("signal"),
            value: signal
              ? `${signal.toFixed(0)} % · ${qualityLabel(signal, m.net_client_rssi_dbm ?? 0)}`
              : "—",
            tone: signalTone(signal),
          },
          {
            label: t("rssi"),
            value:
              m.net_client_rssi_dbm !== undefined
                ? `${m.net_client_rssi_dbm.toFixed(0)} dBm`
                : "—",
            tone: rssiTone(m.net_client_rssi_dbm ?? 0),
          },
          {
            label: t("snr"),
            value:
              m.net_client_snr_dbm !== undefined
                ? `${m.net_client_snr_dbm.toFixed(0)} dB`
                : "—",
            tone: snrTone(m.net_client_snr_dbm ?? 0),
          },
        ]
      : [
          { label: t("status"), value: t("connected"), tone: "success" },
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
            tone: linkSpeedTone(client.attachmentLinkSpeedMbps ?? 0),
          },
        ];

    const traffic: SheetRow[] = [
      {
        label: t("down_total"),
        value: formatBytes(m.net_client_traffic_down_bytes ?? 0),
      },
      {
        label: t("up_total"),
        value: formatBytes(m.net_client_traffic_up_bytes ?? 0),
      },
      {
        label: t("down_activity"),
        value: `${formatBytes(m.net_client_download_activity_bytes ?? 0)}/s`,
        tone: activeTone(m.net_client_download_activity_bytes ?? 0),
      },
      {
        label: t("up_activity"),
        value: `${formatBytes(m.net_client_upload_activity_bytes ?? 0)}/s`,
        tone: activeTone(m.net_client_upload_activity_bytes ?? 0),
      },
    ];

    const path = this.buildPath(client, t);
    return html`
      <div class="hero">${hero.map((r) => this.renderStat(r))}</div>
      ${this.renderPath(
        t("path"),
        client.wireless ? "Wi-Fi" : t("wired"),
        path
      )}
      <div style="height: 16px"></div>
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
