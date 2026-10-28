import { css, CSSResultGroup, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardEditor,
  LovelaceGridOptions,
} from "../../ha";
import setupCustomlocalize from "../../localize";
import { normalizeMacKey } from "../../shared/omada/model";
import { MushroomBaseCard } from "../../utils/base-card";
import { registerCustomCard } from "../../utils/custom-cards";
import {
  DeviceRecord,
  deviceOnline,
  listDevices,
} from "../omada-device-card/device-model";
import "../omada-device-card/omada-device-card";
import { OMADA_DEVICE_CARD_NAME } from "../omada-device-card/const";
import { OmadaDeviceCardConfig } from "../omada-device-card/omada-device-card-config";
import {
  OMADA_DEVICES_CARD_EDITOR_NAME,
  OMADA_DEVICES_CARD_NAME,
} from "./const";
import {
  DeviceType,
  OmadaDevicesCardConfig,
} from "./omada-devices-card-config";

registerCustomCard({
  type: OMADA_DEVICES_CARD_NAME,
  name: "Mushroom Omada Devices Card",
  description: "Auto list of all Omada devices (one device card each)",
});

const TYPE_ORDER: Record<string, number> = {
  gateway: 0,
  switch: 1,
  ap: 2,
  controller: 3,
};

@customElement(OMADA_DEVICES_CARD_NAME)
export class OmadaDevicesCard
  extends MushroomBaseCard<OmadaDevicesCardConfig>
  implements LovelaceCard
{
  @state() private _typeFilter?: DeviceType | "all";

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./omada-devices-card-editor");
    return document.createElement(
      OMADA_DEVICES_CARD_EDITOR_NAME
    ) as LovelaceCardEditor;
  }

  public static async getStubConfig(
    _hass: HomeAssistant
  ): Promise<OmadaDevicesCardConfig> {
    return { type: `custom:${OMADA_DEVICES_CARD_NAME}` };
  }

  setConfig(config: OmadaDevicesCardConfig): void {
    this._config = config;
    this._typeFilter = undefined;
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
    return 6;
  }

  /** devices after `types` and `exclude`, before the chip filter */
  private _pool(): DeviceRecord[] {
    const cfg = this._config!;
    const allowedTypes = new Set<string>(
      cfg.types ?? ["gateway", "switch", "ap", "controller"]
    );
    const excluded = (cfg.exclude ?? []).map((e) => e.trim().toLowerCase());
    const excludedMacs = excluded.map(normalizeMacKey).filter(Boolean);
    return listDevices(this.hass, cfg.site).filter(
      (d) =>
        allowedTypes.has(d.type) &&
        !excluded.includes(d.name.toLowerCase()) &&
        !excludedMacs.includes(normalizeMacKey(d.mac))
    );
  }

  private _devices(): DeviceRecord[] {
    const cfg = this._config!;
    let devices = this._pool();
    const filter = this._typeFilter ?? "all";
    if (filter !== "all") devices = devices.filter((d) => d.type === filter);
    const sort = cfg.sort ?? "type";
    return devices.slice().sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "status") {
        const d = Number(deviceOnline(a)) - Number(deviceOnline(b));
        if (d) return d;
      }
      const t = (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
      return t || a.name.localeCompare(b.name);
    });
  }

  private _childConfig(device: DeviceRecord): OmadaDeviceCardConfig {
    const cfg = this._config!;
    return {
      type: `custom:${OMADA_DEVICE_CARD_NAME}`,
      device: device.mac || device.name,
      site: cfg.site,
      stats: cfg.stats,
      show_health: cfg.show_health,
      layout: cfg.layout,
      fill_container: cfg.fill_container,
      primary_info: cfg.primary_info,
      secondary_info: cfg.secondary_info,
      icon_type: cfg.icon_type,
    };
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const customLocalize = setupCustomlocalize(this.hass);
    const t = (key: string) => customLocalize(`card.omada_devices.${key}`);
    const devices = this._devices();
    const all = this._pool();
    const online = all.filter(deviceOnline).length;

    return html`
      ${this._config.show_header !== false
        ? html`
            <div class="header">
              <span class="title">${this._config.name || t("title")}</span>
              <span class="summary"
                >${online} / ${all.length} ${t("online")}</span
              >
            </div>
          `
        : nothing}
      ${this._config.show_filters !== false
        ? this.renderFilters(all, t)
        : nothing}
      <div class="stack">
        ${repeat(
          devices,
          (d) => d.key,
          (d) => html`
            <mushroom-omada-device-card
              .hass=${this.hass}
              .config=${this._childConfig(d)}
            ></mushroom-omada-device-card>
          `
        )}
        ${devices.length === 0
          ? html`<div class="empty">${t("empty")}</div>`
          : nothing}
      </div>
    `;
  }

  private renderFilters(all: DeviceRecord[], t: (k: string) => string) {
    const allowed = this._config?.types ?? [
      "gateway",
      "switch",
      "ap",
      "controller",
    ];
    const present = (
      ["gateway", "switch", "ap", "controller"] as DeviceType[]
    ).filter(
      (type) => allowed.includes(type) && all.some((d) => d.type === type)
    );
    if (present.length < 2) return nothing;
    const active = this._typeFilter ?? "all";
    const chip = (
      value: DeviceType | "all",
      label: string,
      count: number
    ) => html`
      <button
        class=${classMap({ chip: true, active: active === value })}
        @click=${() => (this._typeFilter = value)}
      >
        ${label} <span class="count">${count}</span>
      </button>
    `;
    return html`
      <div class="filters">
        ${chip("all", t("all"), all.length)}
        ${present.map((type) =>
          chip(type, t(type), all.filter((d) => d.type === type).length)
        )}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      css`
        :host {
          display: block;
        }
        .header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 4px 8px;
        }
        .title {
          font-size: var(--card-primary-font-size);
          font-weight: var(--card-primary-font-weight);
          color: var(--primary-text-color);
        }
        .summary {
          font-size: var(--card-secondary-font-size);
          color: var(--secondary-text-color);
        }
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 0 0 8px;
        }
        .chip {
          white-space: nowrap;
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
        .stack {
          display: flex;
          flex-direction: column;
          gap: var(--ha-section-grid-row-gap, 8px);
        }
        .empty {
          text-align: center;
          font-size: 12px;
          color: var(--secondary-text-color);
          padding: 12px;
        }
      `,
    ];
  }
}
