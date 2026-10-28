import { HassEntity } from "home-assistant-js-websocket";
import { css, CSSResultGroup, html, nothing, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  actionHandler,
  ActionHandlerEvent,
  computeRTL,
  handleAction,
  hasAction,
  HomeAssistant,
  LovelaceCard,
  LovelaceCardEditor,
  LovelaceGridOptions,
} from "../../ha";
import setupCustomlocalize from "../../localize";
import "../../shared/badge-icon";
import "../../shared/card";
import "../../shared/shape-icon";
import "../../shared/state-info";
import "../../shared/state-item";
import {
  formatBytes,
  formatPercent,
  formatRateBits,
} from "../../shared/network/format";
import { computeAppearance } from "../../utils/appearance";
import { MushroomBaseCard } from "../../utils/base-card";
import { cardStyle } from "../../utils/card-styles";
import { computeRgbColor } from "../../utils/colors";
import { registerCustomCard } from "../../utils/custom-cards";
import { computeInfoDisplay } from "../../utils/info";
import {
  DEFAULT_DEVICE_ICON,
  DEVICE_TYPE_ICONS,
  OMADA_DEVICE_CARD_EDITOR_NAME,
  OMADA_DEVICE_CARD_NAME,
} from "./const";
import {
  DeviceRecord,
  deviceEntityId,
  deviceHealth,
  deviceOnline,
  deviceStatEntityId,
  poeBudget,
  deviceUptime,
  findDevice,
  listDevices,
  portsUp,
} from "./device-model";
import {
  DEFAULT_DEVICE_STATS,
  DeviceStat,
  OmadaDeviceCardConfig,
} from "./omada-device-card-config";
import "./omada-device-detail-dialog";
import { showOmadaDeviceDetailDialog } from "./omada-device-detail-dialog";
import { showMoreInfo } from "../../shared/qoxi-sheet";

registerCustomCard({
  type: OMADA_DEVICE_CARD_NAME,
  name: "Mushroom Omada Device Card",
  description:
    "Card for an Omada gateway, switch or access point (OmadaBridge)",
});

type StatTone = "normal" | "warning" | "danger";

function pctTone(value: number): StatTone {
  if (value >= 90) return "danger";
  if (value >= 75) return "warning";
  return "normal";
}

function computeStat(
  hass: HomeAssistant,
  device: DeviceRecord,
  key: DeviceStat
): { value: string; tone: StatTone } {
  const m = device.metrics;
  let value = "—";
  let tone: StatTone = "normal";
  switch (key) {
    case "cpu":
      value = formatPercent(m.net_device_cpu_percentage ?? 0);
      tone = pctTone(m.net_device_cpu_percentage ?? 0);
      break;
    case "mem":
      value = formatPercent(m.net_device_mem_percentage ?? 0);
      tone = pctTone(m.net_device_mem_percentage ?? 0);
      break;
    case "clients":
      value = String(device.clients.length);
      break;
    case "uptime":
      value = deviceUptime(device);
      break;
    case "rx_rate":
      value = formatRateBits(m.net_device_rx_rate ?? 0);
      break;
    case "tx_rate":
      value = formatRateBits(m.net_device_tx_rate ?? 0);
      break;
    case "ports_up": {
      const [up, total] = portsUp(device);
      value = total ? `${up} / ${total}` : "—";
      break;
    }
    case "temp":
      if (m.net_device_temp !== undefined) {
        value = `${m.net_device_temp.toFixed(0)} °C`;
        tone = m.net_device_temp >= 70 ? "warning" : "normal";
      }
      break;
    case "poe_remain":
      if (m.net_device_poe_remain_watts !== undefined)
        value = `${m.net_device_poe_remain_watts.toFixed(1)} W`;
      break;
    case "poe": {
      const budget = poeBudget(hass, device);
      if (budget) {
        value = budget.total
          ? `${(budget.total - budget.remain).toFixed(0)} / ${budget.total.toFixed(0)} W`
          : `${budget.remain.toFixed(1)} W`;
        if (budget.total && budget.remain / budget.total < 0.1) tone = "danger";
        else if (budget.total && budget.remain / budget.total < 0.25)
          tone = "warning";
      }
      break;
    }
    case "health": {
      const health = deviceHealth(hass, device);
      if (health) {
        value = `${health.score.toFixed(0)} / 10`;
        tone =
          health.score < 5 ? "danger" : health.score < 8 ? "warning" : "normal";
      }
      break;
    }
    case "util_2g":
      if (m.net_device_2g_rx_util !== undefined)
        value = `${(m.net_device_2g_rx_util ?? 0).toFixed(0)}/${(m.net_device_2g_tx_util ?? 0).toFixed(0)}%`;
      break;
    case "util_5g":
      if (m.net_device_5g_rx_util !== undefined)
        value = `${(m.net_device_5g_rx_util ?? 0).toFixed(0)}/${(m.net_device_5g_tx_util ?? 0).toFixed(0)}%`;
      break;
    case "download":
      value = formatBytes(m.net_device_download ?? 0);
      break;
    case "upload":
      value = formatBytes(m.net_device_upload ?? 0);
      break;
    case "model":
      value = device.model || "—";
      break;
    case "firmware":
      value = device.version || "—";
      break;
  }
  return { value, tone };
}

@customElement(OMADA_DEVICE_CARD_NAME)
export class OmadaDeviceCard
  extends MushroomBaseCard<OmadaDeviceCardConfig>
  implements LovelaceCard
{
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./omada-device-card-editor");
    return document.createElement(
      OMADA_DEVICE_CARD_EDITOR_NAME
    ) as LovelaceCardEditor;
  }

  public static async getStubConfig(
    hass: HomeAssistant
  ): Promise<OmadaDeviceCardConfig> {
    const first = listDevices(hass)[0];
    return {
      type: `custom:${OMADA_DEVICE_CARD_NAME}`,
      device: first?.mac || first?.name,
    };
  }

  /** Property form of setConfig so container cards can bind `.config=` */
  public set config(value: OmadaDeviceCardConfig) {
    this.setConfig(value);
  }

  public get config(): OmadaDeviceCardConfig | undefined {
    return this._config;
  }

  setConfig(config: OmadaDeviceCardConfig): void {
    this._config = {
      hold_action: { action: "more-info" },
      ...config,
    };
  }

  private get _device(): DeviceRecord | undefined {
    if (!this.hass || !this._config) return undefined;
    return findDevice(this.hass, this._config.device, this._config.site);
  }

  protected get _stateObj(): HassEntity | undefined {
    const device = this._device;
    if (!device) return undefined;
    const id = deviceEntityId(this.hass, device);
    return id ? this.hass.states[id] : undefined;
  }

  private get _stats(): DeviceStat[] {
    return this._config?.stats ?? DEFAULT_DEVICE_STATS;
  }

  public getGridOptions(): LovelaceGridOptions {
    const appearance = computeAppearance(this._config ?? {});
    let rows = appearance.layout === "vertical" ? 2 : 1;
    if (this._stats.length > 0) rows += 1;
    return { columns: 6, rows, min_columns: 4, min_rows: rows };
  }

  public getCardSize(): number {
    return this.getGridOptions().rows ?? 1;
  }

  private _openDetail() {
    const device = this._device;
    showOmadaDeviceDetailDialog(this, {
      device: device?.mac || device?.name || this._config!.device,
      site: this._config!.site,
      name: this._config!.name,
      icon: this._config!.icon,
      icon_color: this._config!.icon_color,
    });
  }

  private _handleAction(ev: ActionHandlerEvent) {
    const action = ev.detail.action!;
    const configured = this._config![`${action}_action`];
    if (
      action === "tap" &&
      (!configured || (configured.action as string) === "device-detail")
    ) {
      this._openDetail();
      return;
    }
    handleAction(
      this,
      this.hass!,
      { ...this._config!, entity: this._stateObj?.entity_id },
      action
    );
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const device = this._device;
    if (!device) {
      return this.renderNotFound({
        ...this._config,
        entity: this._config.device ?? "omada device",
      });
    }
    const customLocalize = setupCustomlocalize(this.hass);
    const appearance = computeAppearance(this._config);
    const rtl = computeRTL(this.hass);
    const name = this._config.name || device.name;
    const stateText = [device.status, device.ip].filter(Boolean).join(" · ");
    const stateObj = this._stateObj;
    const primary = stateObj
      ? computeInfoDisplay(
          appearance.primary_info,
          name,
          stateText,
          stateObj,
          this.hass
        )
      : name;
    const secondary = stateObj
      ? computeInfoDisplay(
          appearance.secondary_info,
          name,
          stateText,
          stateObj,
          this.hass
        )
      : stateText;

    return html`
      <ha-card
        class=${classMap({ "fill-container": appearance.fill_container })}
      >
        <mushroom-card .appearance=${appearance} ?rtl=${rtl}>
          <div class="head">
            <mushroom-state-item
              ?rtl=${rtl}
              .appearance=${appearance}
              @action=${this._handleAction}
              .actionHandler=${actionHandler({
                hasHold: hasAction(this._config.hold_action),
                hasDoubleClick: hasAction(this._config.double_tap_action),
              })}
            >
              ${appearance.icon_type !== "none"
                ? this.renderDeviceIcon(device)
                : nothing}
              ${this.renderDeviceBadge(device)}
              <mushroom-state-info
                slot="info"
                .primary=${primary}
                .secondary=${secondary}
              ></mushroom-state-info>
            </mushroom-state-item>
            ${this.renderHealthTrail(device, appearance.layout)}
          </div>
          ${this.renderStats(device, customLocalize)}
        </mushroom-card>
      </ha-card>
    `;
  }

  /** "10 / 10" at the right end of the header row; coloured only when the score drops */
  private renderHealthTrail(device: DeviceRecord, layout: string) {
    if (this._config?.show_health === false || layout === "vertical")
      return nothing;
    const health = deviceHealth(this.hass, device);
    if (!health) return nothing;
    const tone =
      health.score < 5 ? "danger" : health.score < 8 ? "warning" : "normal";
    return html`
      <span
        class=${classMap({ trail: true, [tone]: true })}
        title="Health"
        @click=${() => showMoreInfo(this, health.entityId)}
      >
        <ha-icon icon="mdi:heart-pulse"></ha-icon>
        <span>${health.score.toFixed(0)}/10</span>
      </span>
    `;
  }

  private renderDeviceIcon(device: DeviceRecord): TemplateResult {
    const online = deviceOnline(device);
    const rgb = computeRgbColor(
      this._config?.icon_color ?? (online ? "blue" : "grey")
    );
    return html`
      <mushroom-shape-icon
        slot="icon"
        .disabled=${!online}
        style=${styleMap({
          "--icon-color": `rgb(${rgb})`,
          "--shape-color": `rgba(${rgb}, 0.2)`,
        })}
      >
        <ha-icon
          .icon=${this._config?.icon ??
          DEVICE_TYPE_ICONS[device.type] ??
          DEFAULT_DEVICE_ICON}
        ></ha-icon>
      </mushroom-shape-icon>
    `;
  }

  private renderDeviceBadge(device: DeviceRecord) {
    if (!deviceOnline(device)) {
      return html`
        <mushroom-badge-icon
          slot="badge"
          class="offline"
          icon="mdi:lan-disconnect"
        ></mushroom-badge-icon>
      `;
    }
    if (device.metrics.net_device_need_upgrade) {
      return html`
        <mushroom-badge-icon
          slot="badge"
          class="pending"
          icon="mdi:arrow-up-bold-circle"
        ></mushroom-badge-icon>
      `;
    }
    return nothing;
  }

  private renderStats(
    device: DeviceRecord,
    customLocalize: ReturnType<typeof setupCustomlocalize>
  ) {
    const stats = this._stats;
    if (stats.length === 0) return nothing;
    return html`
      <div
        class="actions stats"
        ?rtl=${computeRTL(this.hass)}
        @click=${this._openDetail}
      >
        ${stats.map((key) => {
          const stat = computeStat(this.hass, device, key);
          const entityId = deviceStatEntityId(this.hass, device, key);
          return html`
            <div
              class=${classMap({
                stat: true,
                linked: !!entityId,
                [stat.tone]: true,
              })}
              @click=${entityId
                ? (ev: Event) => {
                    ev.stopPropagation();
                    showMoreInfo(this, entityId);
                  }
                : undefined}
            >
              <span class="stat-label"
                >${customLocalize(`card.net_device.stats.${key}`)}</span
              >
              <span class="stat-value">${stat.value}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      cardStyle,
      css`
        mushroom-state-item {
          cursor: pointer;
        }
        .head {
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
        }
        .head > mushroom-state-item {
          flex: 1;
          min-width: 0;
        }
        .trail {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          --mdc-icon-size: 15px;
          flex: none;
          padding: 0 var(--spacing) 0 4px;
          font-size: 13px;
          line-height: 16px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--secondary-text-color);
          cursor: pointer;
          white-space: nowrap;
        }
        .trail.warning {
          color: rgb(var(--rgb-warning));
        }
        .trail.danger {
          color: rgb(var(--rgb-danger));
        }
        .offline {
          --main-color: rgb(var(--rgb-danger));
        }
        .pending {
          --main-color: rgb(var(--rgb-warning));
        }
        .stats {
          cursor: pointer;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
          gap: 8px;
          overflow: hidden;
        }
        .stat {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          height: var(--control-height);
          box-sizing: border-box;
          padding: 0 7px;
          border-radius: var(--control-border-radius);
          background: rgba(var(--rgb-primary-text-color), 0.05);
          --stat-color: var(--primary-text-color);
        }
        .stat.linked:hover {
          background: rgba(var(--rgb-primary-text-color), 0.1);
        }
        .stat.warning {
          background: rgba(var(--rgb-warning), 0.15);
          --stat-color: rgb(var(--rgb-warning));
        }
        .stat.danger {
          background: rgba(var(--rgb-danger), 0.15);
          --stat-color: rgb(var(--rgb-danger));
        }
        .stat-label {
          font-size: 10px;
          line-height: 12px;
          font-weight: 500;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          color: var(--secondary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .stat-value {
          font-size: 12px;
          line-height: 16px;
          font-weight: 600;
          letter-spacing: 0;
          font-variant-numeric: tabular-nums;
          color: var(--stat-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `,
    ];
  }
}
