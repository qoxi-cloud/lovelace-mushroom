import { css, CSSResultGroup, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  computeRTL,
  HomeAssistant,
  LovelaceCard,
  LovelaceCardEditor,
  LovelaceGridOptions,
} from "../../ha";
import setupCustomlocalize from "../../localize";
import "../../shared/card";
import "../../shared/shape-icon";
import "../../shared/state-info";
import "../../shared/state-item";
import { formatRateBits } from "../../shared/network/format";
import { normalizeMacKey } from "../../shared/network/model";
import { computeAppearance } from "../../utils/appearance";
import { MushroomBaseCard } from "../../utils/base-card";
import { cardStyle } from "../../utils/card-styles";
import { computeRgbColor } from "../../utils/colors";
import { registerCustomCard } from "../../utils/custom-cards";
import {
  ClientRecord,
  clientRate,
  clientVia,
  listClients,
} from "../omada-device-card/device-model";
import {
  DEFAULT_CLIENTS_ICON,
  OMADA_CLIENTS_CARD_EDITOR_NAME,
  OMADA_CLIENTS_CARD_NAME,
} from "./const";
import "./omada-client-detail-dialog";
import {
  clientIcon,
  showOmadaClientDetailDialog,
  signalTone,
} from "./omada-client-detail-dialog";
import {
  ClientFilter,
  OmadaClientsCardConfig,
} from "./omada-clients-card-config";

registerCustomCard({
  type: OMADA_CLIENTS_CARD_NAME,
  name: "Mushroom Omada Clients Card",
  description: "List of Omada clients with filters and a detail sheet",
});

function deviceMatches(client: ClientRecord, device: string): boolean {
  const wanted = device.trim().toLowerCase();
  const mac = normalizeMacKey(device);
  const names = [client.apName, client.switchName, client.gatewayName].map(
    (n) => n.toLowerCase()
  );
  const macs = [client.apMac, client.switchMac, client.gatewayMac].map(
    normalizeMacKey
  );
  return names.includes(wanted) || (!!mac && macs.includes(mac));
}

@customElement(OMADA_CLIENTS_CARD_NAME)
export class OmadaClientsCard
  extends MushroomBaseCard<OmadaClientsCardConfig>
  implements LovelaceCard
{
  @state() private _filter?: ClientFilter;

  @state() private _expanded = false;

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./omada-clients-card-editor");
    return document.createElement(
      OMADA_CLIENTS_CARD_EDITOR_NAME
    ) as LovelaceCardEditor;
  }

  public static async getStubConfig(
    _hass: HomeAssistant
  ): Promise<OmadaClientsCardConfig> {
    return { type: `custom:${OMADA_CLIENTS_CARD_NAME}` };
  }

  setConfig(config: OmadaClientsCardConfig): void {
    this._config = config;
    this._filter = undefined;
    this._expanded = false;
  }

  public getGridOptions(): LovelaceGridOptions {
    // HA accepts rows: "auto" for content-sized cards; the local type only knows numbers.
    return {
      columns: 12,
      rows: "auto" as unknown as number,
      min_columns: 6,
      min_rows: 2,
    };
  }

  public getCardSize(): number {
    return 4;
  }

  private get _activeFilter(): ClientFilter {
    return this._filter ?? this._config?.filter ?? "all";
  }

  private _clients(): { all: ClientRecord[]; shown: ClientRecord[] } {
    let all = listClients(this.hass, this._config?.site);
    if (this._config?.device) {
      all = all.filter((c) => deviceMatches(c, this._config!.device!));
    }
    const filter = this._activeFilter;
    let shown = all.filter((c) =>
      filter === "all" ? true : filter === "wired" ? !c.wireless : c.wireless
    );
    const sort = this._config?.sort ?? "rate";
    shown = shown.slice().sort((a, b) => {
      if (sort === "name")
        return (a.name || a.hostName).localeCompare(b.name || b.hostName);
      if (sort === "ip")
        return a.ip.localeCompare(b.ip, undefined, { numeric: true });
      return (
        clientRate(b) - clientRate(a) ||
        (a.name || "").localeCompare(b.name || "")
      );
    });
    return { all, shown };
  }

  private _toggleExpanded = () => {
    this._expanded = !this._expanded;
  };

  private _setFilter(filter: ClientFilter) {
    this._filter = filter;
  }

  private _openClient(client: ClientRecord) {
    showOmadaClientDetailDialog(this, {
      client: client.mac || client.ip || client.name,
      site: this._config?.site,
    });
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const customLocalize = setupCustomlocalize(this.hass);
    const t = (key: string) => customLocalize(`card.net_clients.${key}`);
    const appearance = computeAppearance(this._config);
    const rtl = computeRTL(this.hass);
    const { all, shown } = this._clients();
    const wired = all.filter((c) => !c.wireless).length;
    const wireless = all.length - wired;
    const limit = this._config.limit ?? 20;
    const visible =
      limit > 0 && !this._expanded ? shown.slice(0, limit) : shown;
    const hidden = shown.length - visible.length;
    const rgb = computeRgbColor(this._config.icon_color ?? "blue");
    const name = this._config.name || t("title");
    const fixedFilter =
      this._config.show_filters === false &&
      this._config.filter &&
      this._config.filter !== "all"
        ? this._config.filter
        : undefined;
    // a card pinned to one type only reports its own count
    const summary = fixedFilter
      ? `${shown.length} ${t(fixedFilter)}`
      : `${all.length} ${t("clients")} · ${wired} ${t("wired")} · ${wireless} ${t("wireless")}`;

    return html`
      <ha-card
        class=${classMap({ "fill-container": appearance.fill_container })}
      >
        <mushroom-card .appearance=${appearance} ?rtl=${rtl}>
          <mushroom-state-item ?rtl=${rtl} .appearance=${appearance}>
            ${appearance.icon_type !== "none"
              ? html`
                  <mushroom-shape-icon
                    slot="icon"
                    style=${styleMap({
                      "--icon-color": `rgb(${rgb})`,
                      "--shape-color": `rgba(${rgb}, 0.2)`,
                    })}
                  >
                    <ha-icon
                      .icon=${this._config.icon ?? DEFAULT_CLIENTS_ICON}
                    ></ha-icon>
                  </mushroom-shape-icon>
                `
              : nothing}
            <mushroom-state-info
              slot="info"
              .primary=${name}
              .secondary=${summary}
            ></mushroom-state-info>
          </mushroom-state-item>
          ${this._config.show_filters !== false
            ? this.renderFilters(all, t)
            : nothing}
          <div class="list">
            ${visible.map((client) => this.renderRow(client, t))}
            ${hidden > 0
              ? html`<button class="more" @click=${this._toggleExpanded}>
                  ${customLocalize("card.net_clients.more", { n: hidden })}
                </button>`
              : this._expanded && limit > 0 && shown.length > limit
                ? html`<button class="more" @click=${this._toggleExpanded}>
                    ${t("less")}
                  </button>`
                : nothing}
            ${visible.length === 0
              ? html`<div class="more">${t("empty")}</div>`
              : nothing}
          </div>
        </mushroom-card>
      </ha-card>
    `;
  }

  private renderFilters(all: ClientRecord[], t: (k: string) => string) {
    const active = this._activeFilter;
    const counts: Record<ClientFilter, number> = {
      all: all.length,
      wired: all.filter((c) => !c.wireless).length,
      wireless: all.filter((c) => c.wireless).length,
    };
    return html`
      <div class="filters">
        ${(["all", "wired", "wireless"] as ClientFilter[]).map(
          (f) => html`
            <button
              class=${classMap({ chip: true, active: active === f })}
              @click=${() => this._setFilter(f)}
            >
              ${t(f)} <span class="count">${counts[f]}</span>
            </button>
          `
        )}
      </div>
    `;
  }

  private renderRow(client: ClientRecord, t: (k: string) => string) {
    const rate = clientRate(client);
    const signal = client.metrics.net_client_signal_pct ?? 0;
    const tone = client.wireless ? signalTone(signal) : "normal";
    return html`
      <div class="row" @click=${() => this._openClient(client)}>
        <ha-icon class="row-icon" .icon=${clientIcon(client)}></ha-icon>
        <div class="row-main">
          <span class="row-name"
            >${client.name || client.hostName || client.mac}</span
          >
          <span class="row-sub">${clientVia(client, true) || "—"}</span>
        </div>
        <span class="row-ip">${client.ip || "—"}</span>
        <span class=${classMap({ "row-rate": true, muted: rate <= 0 })}>
          ${rate > 0 ? formatRateBits(rate) : t("idle")}
        </span>
        <span
          class=${classMap({ "row-signal": true, [tone ?? "normal"]: true })}
        >
          ${client.wireless
            ? this.renderBars(signal)
            : html`<ha-icon class="wired" icon="mdi:ethernet"></ha-icon>`}
        </span>
      </div>
    `;
  }

  private renderBars(pct: number) {
    const lit = pct >= 80 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : pct > 0 ? 1 : 0;
    return html`
      <span class="bars" title="${pct.toFixed(0)} %">
        ${[1, 2, 3, 4].map(
          (i) => html`<i class=${classMap({ on: i <= lit })}></i>`
        )}
      </span>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      cardStyle,
      css`
        .filters {
          display: flex;
          gap: 6px;
          padding: 0 var(--spacing) 8px;
        }
        .chip {
          appearance: none;
          border: none;
          font: inherit;
          font-size: 11px;
          font-weight: 500;
          line-height: 16px;
          padding: 4px 10px;
          border-radius: 999px;
          cursor: pointer;
          color: var(--secondary-text-color);
          background: rgba(var(--rgb-primary-text-color), 0.05);
        }
        .chip.active {
          color: rgb(var(--rgb-primary-color, var(--rgb-blue)));
          background: rgba(var(--rgb-primary-color, var(--rgb-blue)), 0.15);
        }
        .chip .count {
          opacity: 0.7;
          margin-left: 2px;
        }
        .list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 var(--spacing) var(--spacing);
        }
        .row {
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto auto 28px;
          gap: 10px;
          align-items: center;
          padding: 6px 10px;
          border-radius: var(--control-border-radius);
          background: rgba(var(--rgb-primary-text-color), 0.04);
          cursor: pointer;
        }
        .row:hover {
          background: rgba(var(--rgb-primary-text-color), 0.08);
        }
        .row-icon {
          --mdc-icon-size: 18px;
          color: var(--secondary-text-color);
        }
        .row-main {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .row-name {
          font-size: 13px;
          line-height: 17px;
          font-weight: 500;
          color: var(--primary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .row-sub {
          font-size: 11px;
          line-height: 14px;
          color: var(--secondary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .row-ip {
          font-size: 12px;
          font-variant-numeric: tabular-nums;
          color: var(--secondary-text-color);
          white-space: nowrap;
        }
        .row-rate {
          font-size: 12px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--primary-text-color);
          white-space: nowrap;
          min-width: 64px;
          text-align: right;
        }
        .row-rate.muted {
          color: var(--secondary-text-color);
          font-weight: 400;
        }
        .row-signal {
          display: flex;
          justify-content: flex-end;
          color: rgb(var(--rgb-success));
        }
        .row-signal.warning {
          color: rgb(var(--rgb-warning));
        }
        .row-signal.danger {
          color: rgb(var(--rgb-danger));
        }
        .row-signal .wired {
          --mdc-icon-size: 16px;
          color: var(--secondary-text-color);
        }
        .bars {
          display: inline-flex;
          align-items: flex-end;
          gap: 2px;
          height: 14px;
        }
        .bars i {
          display: block;
          width: 3px;
          border-radius: 1px;
          background: currentColor;
          opacity: 0.25;
        }
        .bars i:nth-child(1) {
          height: 5px;
        }
        .bars i:nth-child(2) {
          height: 8px;
        }
        .bars i:nth-child(3) {
          height: 11px;
        }
        .bars i:nth-child(4) {
          height: 14px;
        }
        .bars i.on {
          opacity: 1;
        }
        .more {
          appearance: none;
          border: none;
          background: none;
          font: inherit;
          cursor: pointer;
          text-align: center;
          font-size: 11px;
          font-weight: 500;
          color: rgb(var(--rgb-primary-color, var(--rgb-blue)));
          padding: 8px 0 2px;
        }
        .more:hover {
          text-decoration: underline;
        }
        @media (max-width: 480px) {
          .row-ip {
            display: none;
          }
        }
      `,
    ];
  }
}
