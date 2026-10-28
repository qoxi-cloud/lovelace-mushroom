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
import { formatDuration } from "../onu-card/onu-model";
import { DEFAULT_ISP_ICON, ISP_CARD_EDITOR_NAME, ISP_CARD_NAME } from "./const";
import "./isp-detail-dialog";
import {
  latencyTone,
  showIspDetailDialog,
  wanStateColor,
} from "./isp-detail-dialog";
import { DEFAULT_ISP_STATS, IspCardConfig, IspStat } from "./isp-card-config";
import {
  collectWanLinks,
  findWanLink,
  formatBitRate,
  formatLatency,
  formatMbps,
  WanLink,
} from "./isp-model";

registerCustomCard({
  type: ISP_CARD_NAME,
  name: "Mushroom ISP Card",
  description: "Card for an ISP / WAN link (OmadaBridge, optional 8311 ONU)",
});

type StatTone = "normal" | "warning" | "danger";

interface StatView {
  key: IspStat;
  value: string;
  tone: StatTone;
}

function computeStat(link: WanLink, key: IspStat): StatView {
  let value = "—";
  let tone: StatTone = "normal";
  const onu = link.onu;
  switch (key) {
    case "latency":
      value = formatLatency(link.latency);
      tone = (latencyTone(link.latency) ?? "normal") as StatTone;
      break;
    case "down_rate":
      value = formatBitRate(link.downRate);
      break;
    case "up_rate":
      value = formatBitRate(link.upRate);
      break;
    case "link_speed":
      value = formatMbps(link.linkSpeedMbps);
      break;
    case "ip":
      value = link.ip || "—";
      break;
    case "rx_power":
      if (onu) {
        value = `${onu.metrics.rx_power.toFixed(1)} dBm`;
        if (onu.metrics.rx_power <= -27) tone = "danger";
        else if (onu.metrics.rx_power <= -24) tone = "warning";
      }
      break;
    case "tx_power":
      if (onu) value = `${onu.metrics.tx_power.toFixed(1)} dBm`;
      break;
    case "onu_uptime":
      if (onu) value = formatDuration(onu.metrics.uptime);
      break;
  }
  return { key, value, tone };
}

@customElement(ISP_CARD_NAME)
export class IspCard
  extends MushroomBaseCard<IspCardConfig>
  implements LovelaceCard
{
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./isp-card-editor");
    return document.createElement(ISP_CARD_EDITOR_NAME) as LovelaceCardEditor;
  }

  public static async getStubConfig(
    hass: HomeAssistant
  ): Promise<IspCardConfig> {
    const first = collectWanLinks(hass)[0];
    return {
      type: `custom:${ISP_CARD_NAME}`,
      wan: first?.slug,
    };
  }

  setConfig(config: IspCardConfig): void {
    this._config = {
      hold_action: { action: "more-info" },
      ...config,
    };
  }

  private get _link(): WanLink | undefined {
    if (!this.hass || !this._config) return undefined;
    return findWanLink(this.hass, this._config.wan, this._config.onu_prefix);
  }

  protected get _stateObj(): HassEntity | undefined {
    const link = this._link;
    if (!link) return undefined;
    return this.hass.states[link.statusEntityId];
  }

  private get _stats(): IspStat[] {
    return this._config?.stats ?? DEFAULT_ISP_STATS;
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
    const link = this._link;
    showIspDetailDialog(this, {
      wan: link?.slug ?? this._config!.wan,
      onu_prefix: this._config!.onu_prefix,
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
      (!configured || (configured.action as string) === "isp-detail")
    ) {
      this._openDetail();
      return;
    }
    handleAction(
      this,
      this.hass!,
      { ...this._config!, entity: this._link?.statusEntityId },
      action
    );
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const link = this._link;
    if (!link) {
      return this.renderNotFound({
        ...this._config,
        entity: this._config.wan ?? "wan",
      });
    }
    const customLocalize = setupCustomlocalize(this.hass);
    const appearance = computeAppearance(this._config);
    const rtl = computeRTL(this.hass);
    const name = this._config.name || link.name;
    const stateText = [
      customLocalize(`card.isp.state.${link.state}`),
      link.ip && link.ip !== "0.0.0.0" ? link.ip : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
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
              ? this.renderLinkIcon(link)
              : nothing}
            ${this.renderLinkBadge(link)}
            <mushroom-state-info
              slot="info"
              .primary=${primary}
              .secondary=${secondary}
            ></mushroom-state-info>
          </mushroom-state-item>
          ${this.renderStats(link, customLocalize)}
        </mushroom-card>
      </ha-card>
    `;
  }

  private renderLinkIcon(link: WanLink): TemplateResult {
    const rgb = computeRgbColor(
      this._config?.icon_color ?? wanStateColor(link)
    );
    return html`
      <mushroom-shape-icon
        slot="icon"
        .disabled=${link.state === "offline"}
        style=${styleMap({
          "--icon-color": `rgb(${rgb})`,
          "--shape-color": `rgba(${rgb}, 0.2)`,
        })}
      >
        <ha-icon .icon=${this._config?.icon ?? DEFAULT_ISP_ICON}></ha-icon>
      </mushroom-shape-icon>
    `;
  }

  private renderLinkBadge(link: WanLink) {
    if (link.state === "offline") {
      return html`
        <mushroom-badge-icon
          slot="badge"
          class="offline"
          icon="mdi:lan-disconnect"
        ></mushroom-badge-icon>
      `;
    }
    if (link.state === "connecting" || link.state === "disconnecting") {
      return html`
        <mushroom-badge-icon
          slot="badge"
          class="pending"
          icon="mdi:sync"
        ></mushroom-badge-icon>
      `;
    }
    if (link.onu && !link.onu.online) {
      return html`
        <mushroom-badge-icon
          slot="badge"
          class="pending"
          icon="mdi:alert"
        ></mushroom-badge-icon>
      `;
    }
    return nothing;
  }

  private renderStats(
    link: WanLink,
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
          const stat = computeStat(link, key);
          return html`
            <div class=${classMap({ stat: true, [stat.tone]: true })}>
              <span class="stat-label"
                >${customLocalize(`card.isp.stats.${key}`)}</span
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
