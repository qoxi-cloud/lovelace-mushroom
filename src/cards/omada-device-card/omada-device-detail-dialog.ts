import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import setupCustomlocalize from "../../localize";
import {
  linkSpeedColor,
  PathHop,
  QoxiSheet,
  SheetRow,
  showMoreInfo,
  showSheet,
  TableCell,
} from "../../shared/qoxi-sheet";
import {
  formatBytes,
  formatPercent,
  formatRateBits,
  formatSpeedMbps,
} from "../../shared/network/format";
import { computeRgbColor } from "../../utils/colors";
import { DEFAULT_DEVICE_ICON, DEVICE_TYPE_ICONS } from "./const";
import {
  apRadios,
  childrenByPort,
  ClientRecord,
  deviceHealth,
  poeBudget,
  clientRate,
  deviceChain,
  DeviceRecord,
  deviceOnline,
  deviceUplink,
  uplinkLabel,
  uplinkPortsOf,
  deviceRate,
  deviceStatEntityId,
  deviceUptime,
  findDevice,
  PortRecord,
  portSpeedMbps,
  portsUp,
  portUp,
} from "./device-model";

export const OMADA_DEVICE_DETAIL_DIALOG_NAME =
  "mushroom-omada-device-detail-dialog";

export interface OmadaDeviceDetailDialogParams {
  device?: string;
  site?: string;
  name?: string;
  icon?: string;
  icon_color?: string;
}

export function showOmadaDeviceDetailDialog(
  element: HTMLElement,
  params: OmadaDeviceDetailDialogParams
) {
  showSheet(element, OMADA_DEVICE_DETAIL_DIALOG_NAME, params);
}

function pctTone(value: number): SheetRow["tone"] {
  if (value >= 90) return "danger";
  if (value >= 75) return "warning";
  return "success";
}

function clientAttachment(client: ClientRecord): string {
  if (client.wireless) return client.ssid || "Wi-Fi";
  if (client.attachmentLagId) return `LAG ${client.attachmentLagId}`;
  if (client.attachmentPort) return `Port ${client.attachmentPort}`;
  return "";
}

@customElement(OMADA_DEVICE_DETAIL_DIALOG_NAME)
export class OmadaDeviceDetailDialog extends QoxiSheet<OmadaDeviceDetailDialogParams> {
  /** port selected from either table; highlights the port row and its clients */
  @state() private _activePort?: string;

  public showDialog(params: OmadaDeviceDetailDialogParams): void {
    this._activePort = undefined;
    super.showDialog(params);
  }

  private _selectPort = (port: string) => {
    this._activePort = this._activePort === port ? undefined : port;
    if (this._activePort) {
      this.updateComplete.then(() => {
        const row = this.renderRoot.querySelector(".table-row.active");
        row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  };

  private get _device(): DeviceRecord | undefined {
    if (!this._params || !this.hass) return undefined;
    return findDevice(this.hass, this._params.device, this._params.site);
  }

  protected renderHeader() {
    const device = this._device;
    const name =
      this._params?.name || device?.name || this._params?.device || "";
    if (!device) {
      return html`<div class="header"><span class="name">${name}</span></div>`;
    }
    const online = deviceOnline(device);
    const rgb = computeRgbColor(
      this._params?.icon_color ?? (online ? "blue" : "grey")
    );
    const subtitle = [device.status, device.model, device.ip]
      .filter(Boolean)
      .join(" · ");
    return this.renderTitle(
      this._params?.icon ??
        DEVICE_TYPE_ICONS[device.type] ??
        DEFAULT_DEVICE_ICON,
      rgb,
      !online,
      name,
      subtitle
    );
  }

  protected renderBody() {
    const device = this._device;
    const localize = setupCustomlocalize(this.hass);
    if (!device) return html`<p>${localize("card.not_found")}</p>`;
    const t = (key: string) => localize(`card.net_device.detail.${key}`);
    const m = device.metrics;

    const hero: SheetRow[] = [
      {
        label: t("cpu"),
        entityId: deviceStatEntityId(this.hass, device, "cpu"),
        value: formatPercent(m.net_device_cpu_percentage ?? 0),
        tone: pctTone(m.net_device_cpu_percentage ?? 0),
      },
      {
        label: t("mem"),
        entityId: deviceStatEntityId(this.hass, device, "mem"),
        value: formatPercent(m.net_device_mem_percentage ?? 0),
        tone: pctTone(m.net_device_mem_percentage ?? 0),
      },
      { label: t("clients"), value: String(device.clients.length) },
      {
        label: t("uptime"),
        entityId: deviceStatEntityId(this.hass, device, "uptime"),
        value: deviceUptime(device),
        tone: deviceOnline(device) ? "success" : "danger",
      },
      {
        label: t("rx_rate"),
        entityId: deviceStatEntityId(this.hass, device, "rx_rate"),
        value: deviceRate(device, "rx"),
        tone: (m.net_device_rx_rate ?? 0) > 0 ? "success" : "normal",
      },
      {
        label: t("tx_rate"),
        entityId: deviceStatEntityId(this.hass, device, "tx_rate"),
        value: deviceRate(device, "tx"),
        tone: (m.net_device_tx_rate ?? 0) > 0 ? "success" : "normal",
      },
    ];
    if (m.net_device_temp !== undefined) {
      hero.push({
        label: t("temp"),
        entityId: deviceStatEntityId(this.hass, device, "temp"),
        value: `${m.net_device_temp.toFixed(0)} °C`,
        tone:
          m.net_device_temp >= 80
            ? "danger"
            : m.net_device_temp >= 70
              ? "warning"
              : "success",
      });
    }
    const budget = poeBudget(this.hass, device);
    if (budget) {
      const used = budget.total ? budget.total - budget.remain : 0;
      hero.push({
        label: t("poe"),
        entityId: budget.entityId,
        value: budget.total
          ? `${used.toFixed(0)} / ${budget.total.toFixed(0)} W`
          : `${budget.remain.toFixed(1)} W`,
        tone:
          budget.total && budget.remain / budget.total < 0.1
            ? "danger"
            : budget.total && budget.remain / budget.total < 0.25
              ? "warning"
              : "success",
      });
    }
    const health = deviceHealth(this.hass, device);
    if (device.type === "switch" || device.type === "gateway") {
      const [up, total] = portsUp(device);
      hero.push({
        label: t("ports_up"),
        value: `${up} / ${total}`,
        tone: up > 0 ? "success" : "warning",
      });
    }

    const uplink = deviceUplink(this.hass, device);
    const chain = deviceChain(this.hass, device, this._params?.site);
    const info: SheetRow[] = [
      {
        label: t("status"),
        value: device.status || "—",
        tone: deviceOnline(device) ? "success" : "danger",
      },
      { label: t("model"), value: device.model || "—" },
      { label: t("ip"), value: device.ip || "—" },
      { label: t("mac"), value: device.mac || "—" },
      ...(health?.serial ? [{ label: t("serial"), value: health.serial }] : []),
      { label: t("firmware"), value: device.version || "—" },
      ...(health
        ? [
            {
              label: t("client_health"),
              value: `${health.good} ${t("good")} · ${health.fair} ${t("fair")} · ${health.poor} ${t("poor")}`,
              tone: (health.poor > 0
                ? "danger"
                : health.fair > 0
                  ? "warning"
                  : "normal") as SheetRow["tone"],
              entityId: health.entityId,
            },
          ]
        : []),
      ...(health && device.type === "switch"
        ? [
            {
              label: t("fan"),
              value:
                health.fanStatus === "0"
                  ? t("fan_ok")
                  : health.fanStatus || "—",
              tone: (health.fanStatus && health.fanStatus !== "0"
                ? "warning"
                : "normal") as SheetRow["tone"],
            },
            {
              label: t("stp"),
              value: `${health.loops} ${t("loops")} · ${health.blocks} ${t("blocks")}`,
              tone: (health.loops > 0 || health.blocks > 0
                ? "warning"
                : "normal") as SheetRow["tone"],
            },
          ]
        : []),
      {
        label: t("upgrade"),
        value: m.net_device_need_upgrade
          ? t("upgrade_available")
          : t("upgrade_none"),
        tone: m.net_device_need_upgrade ? "warning" : "normal",
      },
      ...(uplink
        ? [
            {
              label: t("uplink"),
              value: `${uplink.parentName} · ${uplinkLabel(uplink, t("port"))}`,
              entityId: uplink.entityId,
            },
          ]
        : []),
      {
        label: t("download"),
        value: formatBytes(m.net_device_download ?? 0),
      },
      { label: t("upload"), value: formatBytes(m.net_device_upload ?? 0) },
    ];

    const [portsUpCount, portsTotal] = portsUp(device);
    const uplinkMbps = device.ports.reduce(
      (max, port) => Math.max(max, portSpeedMbps(port)),
      0
    );
    const radar = this.renderRadar(
      t("health_profile"),
      health
        ? this.renderHeaderTrail(
            "mdi:heart-pulse",
            `${health.score.toFixed(0)}/10`,
            health.score < 5
              ? "danger"
              : health.score < 8
                ? "warning"
                : "normal",
            () => showMoreInfo(this, health.entityId),
            "Health"
          )
        : t("health_tag"),
      [
        {
          label: t("cpu"),
          value: m.net_device_cpu_percentage ?? 0,
        },
        {
          label: t("mem"),
          value: m.net_device_mem_percentage ?? 0,
        },
        {
          label: t("ports"),
          value: portsTotal ? (portsUpCount / portsTotal) * 100 : 0,
          detail: portsTotal ? `${portsUpCount}/${portsTotal}` : "—",
        },
        {
          label: t("clients"),
          value: Math.min(device.clients.length * 12, 100),
          detail: String(device.clients.length),
        },
        {
          label: t("uplink"),
          value: Math.min(uplinkMbps / 100, 100),
          detail: uplinkMbps ? formatSpeedMbps(uplinkMbps) : "—",
        },
      ]
    );
    const sections = [
      this.renderSection(t("device"), device.type.toUpperCase(), info),
      radar,
    ];
    const tables: unknown[] = [];
    const openDevice = (name: string) => () =>
      this.openSheet(OMADA_DEVICE_DETAIL_DIALOG_NAME, {
        device: name,
        site: this._params?.site,
      });
    const pathHops: PathHop[] = [
      {
        icon: DEVICE_TYPE_ICONS[device.type] ?? DEFAULT_DEVICE_ICON,
        title: device.name,
        subtitle: device.ip || undefined,
      },
      ...chain.map(({ device: hop, via }) => ({
        icon: DEVICE_TYPE_ICONS[hop.type] ?? DEFAULT_DEVICE_ICON,
        title: hop.name,
        subtitle: uplinkLabel(via, t("port")),
        onClick: openDevice(hop.name),
      })),
    ];

    if (device.type === "ap") {
      const radios: SheetRow[] = [];
      const settings = new Map(
        apRadios(this.hass, device).map((r) => [r.band, r])
      );
      for (const band of ["2g", "5g", "5g2", "6g"] as const) {
        const rx = m[`net_device_${band}_rx_util`];
        const tx = m[`net_device_${band}_tx_util`];
        const radio = settings.get(band);
        if (rx === undefined && tx === undefined && !radio) continue;
        const label =
          band === "2g"
            ? "2.4 GHz"
            : band === "5g"
              ? "5 GHz"
              : band === "5g2"
                ? "5 GHz (2)"
                : "6 GHz";
        if (radio) {
          radios.push({
            label: `${label} · ${t("radio")}`,
            value: [
              radio.channel ? `${t("channel")} ${radio.channel}` : "",
              radio.width,
              radio.txPower ? `${radio.txPower} dBm` : "",
              `${radio.clients} ${t("clients_short")}`,
            ]
              .filter(Boolean)
              .join(" · "),
            tone: radio.channel ? "normal" : "warning",
          });
        }
        radios.push({
          label: `${label} · ${t("rx_util")}`,
          value: formatPercent(rx ?? 0),
          tone: pctTone(rx ?? 0),
        });
        radios.push({
          label: `${label} · ${t("tx_util")}`,
          value: formatPercent(tx ?? 0),
          tone: pctTone(tx ?? 0),
        });
      }
      for (const i of device.quality?.interference ?? []) {
        const label = i.band.startsWith("2") ? "2.4 GHz" : `${i.band} GHz`;
        radios.push({
          label: `${label} · ${t("interference")}`,
          value: formatPercent(i.percentage),
          tone: i.percentage >= 30 ? "warning" : "normal",
        });
      }
      const uplink = device.quality?.uplink;
      if (uplink) {
        radios.push({
          label: t("uplink_packets"),
          value: `${uplink.down.packets ?? 0} / ${uplink.up.packets ?? 0}`,
        });
        const packets =
          (uplink.down.packets ?? 0) + (uplink.up.packets ?? 0);
        const dropped =
          (uplink.down.dropped ?? 0) + (uplink.up.dropped ?? 0);
        const errors = (uplink.down.errors ?? 0) + (uplink.up.errors ?? 0);
        // Linux counts frames nobody consumes (LLDP, foreign VLAN tags) as
        // rx_dropped, so a steady trickle is normal; only a share of traffic
        // points at a real problem. Errors (CRC etc.) are always a problem.
        const droppedShare = packets > 0 ? (dropped / packets) * 100 : 0;
        radios.push({
          label: t("uplink_dropped"),
          value:
            dropped > 0
              ? `${dropped} (${droppedShare.toFixed(2)}%)`
              : "0",
          tone: droppedShare > 0.5 ? "warning" : "normal",
        });
        radios.push({
          label: t("uplink_errors"),
          value: String(errors),
          tone: errors > 0 ? "warning" : "normal",
        });
      }
      if (radios.length)
        sections.push(this.renderSection(t("radios"), "Wi-Fi", radios));
    }

    if (device.ports.length) {
      // PoE column only when the device has at least one PoE-capable port.
      const hasPoe = device.ports.some(
        (port) => port.poe || port.metrics.net_port_power_watts !== undefined
      );
      const children = childrenByPort(this.hass, device, this._params?.site);
      const ownUplinkPorts = uplinkPortsOf(this.hass, device);
      const rows: TableCell[][] = device.ports.map((port: PortRecord) => {
        const up = portUp(port);
        const speed = portSpeedMbps(port);
        const poe = port.metrics.net_port_power_watts;
        const who = port.clients
          .map((c) => c.name)
          .filter(Boolean)
          .slice(0, 2)
          .join(", ");
        const custom =
          port.name && !/^port\s*\d+$/i.test(port.name) ? port.name : "";
        // port name (e.g. "SFP+ WAN1") goes with the client column so the port column stays narrow
        const kids = children.get(port.port) ?? [];
        const kidText = kids.map((k) => k.name).join(", ");
        const isUplink = ownUplinkPorts.has(port.port);
        const clientText = [
          isUplink && uplink ? uplink.parentName : "",
          kidText,
          custom,
          who,
        ]
          .filter(Boolean)
          .join(" · ");
        const cells: TableCell[] = [
          { text: port.port },
          {
            text: up
              ? port.status || t("port_up")
              : port.status || t("port_down"),
            dot: up ? "success" : "danger",
            muted: !up,
          },
          {
            text: up ? formatSpeedMbps(speed) : "—",
            muted: !up,
            dotColor: up ? linkSpeedColor(speed) : undefined,
          },
        ];
        if (hasPoe) {
          cells.push(
            port.poe || poe
              ? { text: `${(poe ?? 0).toFixed(0)} W`, icon: "mdi:flash" }
              : { text: "—", muted: true }
          );
        }
        cells.push({
          text: clientText || "—",
          muted: !who && !kids.length && !isUplink,
          icon: isUplink
            ? "mdi:arrow-up-bold"
            : kids.length
              ? (DEVICE_TYPE_ICONS[kids[0].type] ?? "mdi:lan")
              : undefined,
        });
        return cells;
      });
      const [up, total] = portsUp(device);
      tables.push(
        this.renderTable({
          title: t("ports"),
          tag: `${up} / ${total} ${t("ports_up_tag")}`,
          columns: hasPoe
            ? "40px 132px 96px 64px minmax(0, 1fr)"
            : "40px 132px 96px minmax(0, 1fr)",
          columnsMobile: hasPoe
            ? "32px minmax(0, 1fr) 84px 56px"
            : "32px minmax(0, 1fr) 84px",
          hideOnMobile: [hasPoe ? 4 : 3],
          headers: hasPoe
            ? [t("port"), t("status"), t("speed"), "PoE", t("client")]
            : [t("port"), t("status"), t("speed"), t("client")],
          rows,
          minWidth: "480px",
          rowKeys: device.ports.map((port) => port.port),
          activeKeys: this._activePort ? [this._activePort] : [],
          onRow: this._selectPort,
          footer: this.renderSpeedLegend(),
        })
      );
    }

    if (device.clients.length) {
      const sortedClients = device.clients
        .slice()
        .sort((a, b) => clientRate(b) - clientRate(a));
      const rows: TableCell[][] = sortedClients.map((client) => {
        const rate = clientRate(client);
        return [
          {
            text: client.name || client.hostName || client.mac,
            dot: "success",
          },
          { text: clientAttachment(client) || "—", muted: true },
          { text: client.ip || "—" },
          { text: rate > 0 ? formatRateBits(rate) : "—", muted: rate <= 0 },
        ];
      });
      tables.push(
        this.renderTable({
          title: t("clients"),
          tag: String(device.clients.length),
          columns: "minmax(0, 1.4fr) minmax(0, 1fr) 120px 96px",
          columnsMobile: "minmax(0, 1.4fr) minmax(0, 1fr) 80px",
          hideOnMobile: [2],
          headers: [t("name"), t("via"), t("ip_short"), t("rate")],
          rows,
          minWidth: "460px",
          rowKeys: sortedClients.map((c) => c.attachmentPort || ""),
          activeKeys: this._activePort ? [this._activePort] : [],
          onRow: (port) => port && this._selectPort(port),
        })
      );
    }

    return html`
      <div class="hero">${hero.map((r) => this.renderStat(r))}</div>
      ${chain.length
        ? html`${this.renderPath(t("path"), t("path_tag"), pathHops)}
            <div style="height: 16px"></div>`
        : ""}
      <div class="columns ${sections.length === 1 ? "single" : ""}">
        ${sections}
      </div>
      <div class="tables">${tables}</div>
    `;
  }
}
