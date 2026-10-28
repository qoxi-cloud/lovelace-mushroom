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
import { computeAppearance } from "../../utils/appearance";
import { MushroomBaseCard } from "../../utils/base-card";
import { cardStyle } from "../../utils/card-styles";
import { computeRgbColor } from "../../utils/colors";
import { registerCustomCard } from "../../utils/custom-cards";
import { computeInfoDisplay } from "../../utils/info";
import { DEFAULT_ONU_ICON, ONU_CARD_EDITOR_NAME, ONU_CARD_NAME } from "./const";
import { DEFAULT_ONU_STATS, OnuCardConfig, OnuStat } from "./onu-card-config";
import {
  collectOnuDevices,
  findOnu,
  formatBytes,
  formatDuration,
  formatRate,
  OnuDevice,
  shortPonState,
} from "./onu-model";
import "./onu-detail-dialog";
import { showOnuDetailDialog } from "./onu-detail-dialog";

registerCustomCard({
  type: ONU_CARD_NAME,
  name: "Mushroom ONU Card",
  description: "Card for XGS-PON ONU sticks (8311 ONU Monitor)",
});

type StatTone = "normal" | "warning" | "danger";

interface StatView {
  key: OnuStat;
  value: string;
  tone: StatTone;
}

function computeStat(onu: OnuDevice, key: OnuStat): StatView {
  const m = onu.metrics;
  let value = "";
  let tone: StatTone = "normal";
  switch (key) {
    case "rx_power":
      value = `${m.rx_power.toFixed(1)} dBm`;
      if (m.rx_power <= -27) tone = "danger";
      else if (m.rx_power <= -24) tone = "warning";
      break;
    case "tx_power":
      value = `${m.tx_power.toFixed(1)} dBm`;
      break;
    case "down_rate":
      value = formatRate(m.down_rate);
      break;
    case "up_rate":
      value = formatRate(m.up_rate);
      break;
    case "down_total":
      value = formatBytes(m.down_total);
      break;
    case "up_total":
      value = formatBytes(m.up_total);
      break;
    case "optic_temp":
      value = `${m.optic_temp.toFixed(0)} °C`;
      if (m.optic_temp >= 70) tone = "danger";
      else if (m.optic_temp >= 60) tone = "warning";
      break;
    case "cpu_temp":
      value = `${m.cpu_temp.toFixed(0)} °C`;
      if (m.cpu_temp >= 85) tone = "danger";
      else if (m.cpu_temp >= 75) tone = "warning";
      break;
    case "voltage":
      value = `${m.voltage.toFixed(2)} V`;
      break;
    case "tx_bias":
      value = `${m.tx_bias.toFixed(1)} mA`;
      break;
    case "uptime":
      value = formatDuration(m.uptime);
      break;
    case "time_in_state":
      value = formatDuration(m.time_in_state);
      break;
    case "fec_corrected":
      value = m.fec_corrected.toLocaleString();
      break;
    case "fec_uncorrected":
      value = m.fec_uncorrected.toLocaleString();
      if (m.fec_uncorrected > 0) tone = "warning";
      break;
    case "bip_errors":
      value = m.bip_errors.toLocaleString();
      if (m.bip_errors > 0) tone = "warning";
      break;
    case "lods_events":
      value = m.lods_events.toLocaleString();
      if (m.lods_events > 0) tone = "warning";
      break;
    case "memory":
      value = `${m.memory.toFixed(0)} %`;
      if (m.memory >= 90) tone = "warning";
      break;
    case "load_1m":
      value = m.load_1m.toFixed(2);
      break;
    case "ethernet_speed":
      value =
        m.ethernet_speed >= 1000
          ? `${(m.ethernet_speed / 1000).toFixed(0)} Gbit/s`
          : `${m.ethernet_speed.toFixed(0)} Mbit/s`;
      break;
  }
  return { key, value, tone };
}

@customElement(ONU_CARD_NAME)
export class OnuCard
  extends MushroomBaseCard<OnuCardConfig>
  implements LovelaceCard
{
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./onu-card-editor");
    return document.createElement(ONU_CARD_EDITOR_NAME) as LovelaceCardEditor;
  }

  public static async getStubConfig(
    hass: HomeAssistant
  ): Promise<OnuCardConfig> {
    const first = collectOnuDevices(hass)[0];
    return {
      type: `custom:${ONU_CARD_NAME}`,
      serial: first?.serial,
    };
  }

  setConfig(config: OnuCardConfig): void {
    this._config = {
      hold_action: { action: "more-info" },
      ...config,
    };
  }

  private get _onu(): OnuDevice | undefined {
    if (!this.hass || !this._config) return undefined;
    return findOnu(this.hass, this._config.prefix, this._config.serial);
  }

  // Link sensor stands in for "the entity" (more-info, badges, relative time).
  protected get _stateObj(): HassEntity | undefined {
    const onu = this._onu;
    if (!onu) return undefined;
    return this.hass.states[onu.linkEntityId];
  }

  private get _stats(): OnuStat[] {
    return this._config?.stats ?? DEFAULT_ONU_STATS;
  }

  public getGridOptions(): LovelaceGridOptions {
    const appearance = computeAppearance(this._config ?? {});
    let rows = appearance.layout === "vertical" ? 2 : 1;
    if (this._stats.length > 0) rows += 1;
    return {
      columns: 6,
      rows,
      min_columns: 4,
      min_rows: rows,
    };
  }

  public getCardSize(): number {
    return this.getGridOptions().rows ?? 1;
  }

  private _openDetail() {
    const onu = this._onu;
    showOnuDetailDialog(this, {
      serial: onu?.serial ?? this._config!.serial,
      prefix: this._config!.prefix,
      name: this._config!.name,
      icon: this._config!.icon,
      icon_color: this._config!.icon_color,
    });
  }

  private _handleAction(ev: ActionHandlerEvent) {
    const action = ev.detail.action!;
    const configured = this._config![`${action}_action`];
    // Tap opens the ONU detail sheet unless the user configured an action.
    if (
      action === "tap" &&
      (!configured || (configured.action as string) === "onu-detail")
    ) {
      this._openDetail();
      return;
    }
    handleAction(
      this,
      this.hass!,
      { ...this._config!, entity: this._onu?.linkEntityId },
      action
    );
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }

    const onu = this._onu;
    if (!onu) {
      return this.renderNotFound({
        ...this._config,
        entity: this._config.serial
          ? `${this._config.prefix ?? "8311_onu_"}${this._config.serial}`
          : "8311_onu_*",
      });
    }

    const customLocalize = setupCustomlocalize(this.hass);
    const appearance = computeAppearance(this._config);
    const rtl = computeRTL(this.hass);
    const name = this._config.name || onu.name;
    const status = onu.online
      ? customLocalize("card.onu.online")
      : customLocalize("card.onu.offline");
    const ponState = shortPonState(onu.ponState);
    const stateText = ponState ? `${status} · ${ponState}` : status;
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
              ? this.renderOnuIcon(onu)
              : nothing}
            ${this.renderOnuBadge(onu)}
            <mushroom-state-info
              slot="info"
              .primary=${primary}
              .secondary=${secondary}
            ></mushroom-state-info>
          </mushroom-state-item>
          ${this.renderStats(onu, customLocalize)}
        </mushroom-card>
      </ha-card>
    `;
  }

  private renderOnuIcon(onu: OnuDevice): TemplateResult {
    const iconStyle = {};
    const color =
      this._config?.icon_color ?? (onu.online ? "green" : undefined);
    if (color) {
      const rgb = computeRgbColor(color);
      iconStyle["--icon-color"] = `rgb(${rgb})`;
      iconStyle["--shape-color"] = `rgba(${rgb}, 0.2)`;
    }
    return html`
      <mushroom-shape-icon
        slot="icon"
        .disabled=${!onu.online}
        style=${styleMap(iconStyle)}
      >
        <ha-icon .icon=${this._config?.icon ?? DEFAULT_ONU_ICON}></ha-icon>
      </mushroom-shape-icon>
    `;
  }

  private renderOnuBadge(onu: OnuDevice) {
    if (!onu.online) {
      return html`
        <mushroom-badge-icon
          slot="badge"
          class="offline"
          icon="mdi:lan-disconnect"
        ></mushroom-badge-icon>
      `;
    }
    if (onu.alarm) {
      return html`
        <mushroom-badge-icon
          slot="badge"
          class="alarm"
          icon="mdi:alert"
        ></mushroom-badge-icon>
      `;
    }
    return nothing;
  }

  private renderStats(
    onu: OnuDevice,
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
          const stat = computeStat(onu, key);
          return html`
            <div class=${classMap({ stat: true, [stat.tone]: true })}>
              <span class="stat-label"
                >${customLocalize(`card.onu.stats.${key}`)}</span
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
        mushroom-shape-icon {
          --icon-color: rgb(var(--rgb-state-entity));
          --shape-color: rgba(var(--rgb-state-entity), 0.2);
        }
        .offline {
          --main-color: rgb(var(--rgb-danger));
        }
        .alarm {
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
