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
import { DEFAULT_ISP_ICON, ISP_CARD_EDITOR_NAME, ISP_CARD_NAME } from "./const";
import { showMoreInfo } from "../../shared/qoxi-sheet";
import {
  DEFAULT_ISP_STATS,
  IspCardConfig,
  IspStat,
} from "./isp-card-config";
import {
  collectWanLinks,
  findWanLink,
  formatBitRate,
  splitBitRate,
  formatLatency,
  formatMbps,
  isLocalIp,
  ispStatEntityId,
  latencyTone,
  WanLink,
  wanStateColor,
  withTrafficEntities,
} from "./isp-model";

registerCustomCard({
  type: ISP_CARD_NAME,
  name: "Mushroom ISP Card",
  description: "Card for an ISP / WAN link (OmadaBridge, optional 8311 ONU)",
});

type StatTone = "normal" | "warning" | "danger" | "success";

/** public WAN address = green, private / CGNAT / unset = orange (like the PoE icon) */
function ipTone(ip: string): StatTone {
  if (!ip) return "normal";
  return isLocalIp(ip) ? "warning" : "success";
}

interface StatView {
  key: IspStat;
  value: string;
  tone: StatTone;
}

function computeStat(
  link: WanLink,
  key: IspStat,
  t: (k: string) => string
): StatView {
  let value = "—";
  let tone: StatTone = "normal";
  switch (key) {
    case "latency":
      value = formatLatency(link.latency);
      tone = latencyTone(link.latency);
      break;
    case "link_speed":
      value = formatMbps(link.linkSpeedMbps);
      break;
    case "port":
      value = String(link.port);
      break;
    case "proto":
      value = link.proto ? link.proto.toUpperCase() : "—";
      break;
    case "ip":
      value = link.ip || "—";
      tone = ipTone(link.ip);
      break;
    case "isp_enabled":
      value = link.ispEnabled ? t("yes") : t("no");
      if (!link.ispEnabled) tone = "warning";
      break;
    case "max_bandwidth":
      value = formatMbps(link.maxBandwidthMbps);
      break;
    case "rx_rate":
      value = formatBitRate(link.rxRate);
      break;
    case "tx_rate":
      value = formatBitRate(link.txRate);
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

  private get _link(): WanLink | undefined {
    if (!this.hass || !this._config) return undefined;
    const link = findWanLink(this.hass, this._config.wan);
    if (!link) return undefined;
    return withTrafficEntities(
      link,
      this.hass,
      this._config.rx_entity,
      this._config.tx_entity
    );
  }

  private get _hasTrafficSource(): boolean {
    return !!(this._config?.rx_entity || this._config?.tx_entity);
  }

  protected get _stateObj(): HassEntity | undefined {
    const link = this._link;
    if (!link) return undefined;
    // latency is the entity people want history for; it also carries the WAN attributes
    return (
      this.hass.states[link.latencyEntityId] ??
      this.hass.states[link.statusEntityId]
    );
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

  /** tiles behave like a tap on the card: latency history */
  private _handleTap = () => {
    handleAction(
      this,
      this.hass!,
      { ...this._config!, entity: this._link?.latencyEntityId },
      "tap"
    );
  };

  private _handleAction(ev: ActionHandlerEvent) {
    handleAction(
      this,
      this.hass!,
      { ...this._config!, entity: this._link?.latencyEntityId },
      ev.detail.action!
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
    const showIp = !!link.ip && link.ip !== "0.0.0.0";
    const stateText = [
      customLocalize(`card.isp.state.${link.state}`),
      showIp ? link.ip : undefined,
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
    let secondary: string | TemplateResult | undefined = stateObj
      ? computeInfoDisplay(
          appearance.secondary_info,
          name,
          stateText,
          stateObj,
          this.hass
        )
      : stateText;
    if (secondary === stateText && showIp && link.ip) {
      // public address green, private / CGNAT orange (same rule as the IP tile)
      const tone = ipTone(link.ip);
      secondary = html`${customLocalize(`card.isp.state.${link.state}`)} ·
        <span style="color: rgb(var(--rgb-${tone}))">${link.ip}</span>`;
    }

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
                ? this.renderLinkIcon(link)
                : nothing}
              ${this.renderLinkBadge(link)}
              <mushroom-state-info
                slot="info"
                .primary=${primary}
                .secondary=${secondary}
              ></mushroom-state-info>
            </mushroom-state-item>
            ${this.renderTrafficTrail(link, appearance.layout, customLocalize)}
          </div>
          ${this.renderStats(link, customLocalize)}
        </mushroom-card>
      </ha-card>
    `;
  }

  /** live ↓/↑ at the right end of the header, like the ONU card's PON mode;
   *  one value per line so a phone-width card keeps room for the IP */
  private renderTrafficTrail(
    link: WanLink,
    layout: string,
    customLocalize: ReturnType<typeof setupCustomlocalize>
  ) {
    if (this._config?.show_traffic === false || layout === "vertical")
      return nothing;
    const show =
      this._config?.show_traffic === true ||
      this._hasTrafficSource ||
      link.rxRate > 0 ||
      link.txRate > 0;
    if (!show) return nothing;
    const rxId = ispStatEntityId(link, "rx_rate");
    return html`
      <div
        class=${classMap({ trail: true, linked: !!rxId })}
        title=${customLocalize("card.isp.traffic")}
        @click=${rxId
          ? (ev: Event) => {
              ev.stopPropagation();
              showMoreInfo(this, rxId);
            }
          : undefined}
      >
        ${this.renderTrailLine("rx", "↓", link.rxRate)}
        ${this.renderTrailLine("tx", "↑", link.txRate)}
      </div>
    `;
  }

  /** arrow + value, left-aligned: the arrows line up across the cards and
   *  the value hugs its arrow whatever the number of digits */
  private renderTrailLine(dir: "rx" | "tx", arrow: string, bps: number) {
    const { value, unit } = splitBitRate(bps);
    return html`
      <span class=${classMap({ "trail-line": true, [dir]: true })}>
        <span class="arrow">${arrow}</span>
        <span class="num">${value} ${unit}</span>
      </span>
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
        @click=${this._handleTap}
      >
        ${stats.map((key) => {
          const stat = computeStat(link, key, (k) =>
            customLocalize(`card.isp.${k}`)
          );
          // rx/tx open their own sensor (throughput history); the rest keep the card tap
          const entityId =
            key === "rx_rate" || key === "tx_rate"
              ? ispStatEntityId(link, key)
              : undefined;
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
        .head {
          display: flex;
          align-items: flex-start;
          flex: 1;
          min-width: 0;
        }
        .head > mushroom-state-item {
          flex: 1;
          min-width: 0;
        }
        .trail {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex: none;
          /* fits "↓ 999 kbit/s" (~79px at 13px); a fixed box keeps the arrows
             in one column across the cards whatever the digits */
          box-sizing: content-box;
          min-width: 6.2em;
          /* same top padding as the state item, so the two lines sit on the
             name (20px) and state (16px) lines of mushroom-state-info */
          padding: calc(var(--spacing) + 4px) var(--spacing) 0 4px;
          color: var(--secondary-text-color);
          white-space: nowrap;
        }
        .trail.linked {
          cursor: pointer;
        }
        /* both lines share the name-line style; only the arrows carry colour */
        .trail-line {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          font-size: 13px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .trail-line.rx {
          line-height: 20px;
        }
        .trail-line.tx {
          line-height: 16px;
        }
        .trail-line .arrow {
          font-weight: 700;
        }
        .trail-line.rx .arrow {
          color: rgb(var(--rgb-blue));
        }
        .trail-line.tx .arrow {
          color: rgb(var(--rgb-green));
        }
        .offline {
          --main-color: rgb(var(--rgb-danger));
        }
        .pending {
          --main-color: rgb(var(--rgb-warning));
        }
        .stats {
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
        .stats {
          cursor: pointer;
        }
        .stat.success {
          --stat-color: rgb(var(--rgb-success));
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
