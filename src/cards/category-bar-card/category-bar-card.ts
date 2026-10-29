// qoxi: Apple-Home-style page header — big title, a horizontally scrollable
// row of category pills (label + live status, the current page highlighted)
// and an optional floating "Home" button on category pages.
import { css, CSSResultGroup, html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { assert } from "superstruct";
import { HomeAssistant, LovelaceCard } from "../../ha";
import { MushroomBaseElement } from "../../utils/base-element";
import { computeRgbColor } from "../../utils/colors";
import { registerCustomCard } from "../../utils/custom-cards";
import { CATEGORY_BAR_CARD_NAME } from "./const";
import {
  CategoryBarCardConfig,
  categoryBarCardConfigStruct,
  CategoryItem,
  CategoryStatus,
} from "./category-bar-card-config";

registerCustomCard({
  type: CATEGORY_BAR_CARD_NAME,
  name: "Mushroom Category Bar Card (qoxi)",
  description:
    "Page title with Apple-Home-style category pills and a floating Home button",
});

function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(
    new CustomEvent("location-changed", { detail: { replace: false } })
  );
}

function isOn(state: string) {
  return ![
    "off",
    "unavailable",
    "unknown",
    "idle",
    "standby",
    "closed",
    "disarmed",
    "not_home",
  ].includes(state);
}

@customElement(CATEGORY_BAR_CARD_NAME)
export class CategoryBarCard
  extends MushroomBaseElement
  implements LovelaceCard
{
  public static async getStubConfig(
    _hass: HomeAssistant
  ): Promise<CategoryBarCardConfig> {
    return {
      type: `custom:${CATEGORY_BAR_CARD_NAME}`,
      title: "Home",
      items: [
        {
          label: "Lights",
          icon: "mdi:lightbulb",
          color: "amber",
          path: "/lovelace/lights",
          status: { kind: "count_on", domain: "light", suffix: "On" },
        },
      ],
    };
  }

  @state() private _config?: CategoryBarCardConfig;
  @state() private _path = location.pathname;

  private _onLocation = () => {
    this._path = location.pathname;
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("location-changed", this._onLocation);
    window.addEventListener("popstate", this._onLocation);
    this._path = location.pathname;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("location-changed", this._onLocation);
    window.removeEventListener("popstate", this._onLocation);
  }

  getCardSize(): number {
    return 2;
  }

  setConfig(config: CategoryBarCardConfig): void {
    assert(config, categoryBarCardConfigStruct);
    this._config = config;
  }

  private _entities(status: CategoryStatus): string[] {
    if (status.entities?.length) return status.entities;
    if (status.domain) {
      const prefix = status.domain + ".";
      return Object.keys(this.hass.states).filter((id) =>
        id.startsWith(prefix)
      );
    }
    return status.entity ? [status.entity] : [];
  }

  private _status(status?: CategoryStatus): string {
    if (!status || !this.hass) return "";
    const ids = this._entities(status);
    const states = ids.map((id) => this.hass.states[id]).filter(Boolean);
    const suffix = status.suffix ? ` ${status.suffix}` : "";
    switch (status.kind) {
      case "count":
        return `${states.length}${suffix}`;
      case "count_on":
        return `${states.filter((s) => isOn(s.state)).length}${suffix || " On"}`;
      case "attribute_equals": {
        const n = states.filter(
          (s) => String(s.attributes[status.attribute ?? ""]) === status.equals
        ).length;
        return `${n}${suffix}`;
      }
      case "temperature": {
        const temps = states
          .map((s) => Number(s.attributes.current_temperature))
          .filter((t) => Number.isFinite(t));
        if (!temps.length) return "—";
        const mean = temps.reduce((a, b) => a + b, 0) / temps.length;
        return `${mean.toFixed(1)}°`;
      }
      case "state": {
        const s = states[0];
        if (!s) return "—";
        const mapped = status.map?.[s.state];
        return (
          mapped ??
          s.state.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
        );
      }
    }
    return "";
  }

  private _active(item: CategoryItem) {
    return this._path === item.path;
  }

  /** pills behave like filters: tapping the active one clears the filter
   *  (back to home_path), tapping another one switches */
  private _toggle(item: CategoryItem) {
    const home = this._config?.home_path;
    if (this._active(item) && home) navigate(home);
    else navigate(item.path);
  }

  private _renderPill(item: CategoryItem): TemplateResult {
    const active = this._active(item);
    const rgb = computeRgbColor(item.color ?? "blue");
    return html`
      <button
        class=${classMap({ pill: true, active })}
        style=${styleMap({ "--pill-icon-color": `rgb(${rgb})` })}
        @click=${() => this._toggle(item)}
      >
        <ha-icon .icon=${item.icon}></ha-icon>
        <span class="text">
          <span class="label">${item.label}</span>
          ${item.status
            ? html`<span class="status">${this._status(item.status)}</span>`
            : nothing}
        </span>
      </button>
    `;
  }

  private _pathSince = Date.now();

  protected updated(changed: Map<PropertyKey, unknown>) {
    super.updated(changed);
    if (changed.has("_path")) this._pathSince = Date.now();
    // keep the active pill in view when the row is wider than the screen;
    // re-check for a moment because icons/fonts settle after first paint
    if (Date.now() - this._pathSince > 2500) return;
    const row = this.renderRoot?.querySelector<HTMLElement>(".pills");
    const active = this.renderRoot?.querySelector<HTMLElement>(".pill.active");
    if (!row || !active) return;
    const target = Math.max(
      0,
      Math.min(
        row.scrollWidth - row.clientWidth,
        active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2
      )
    );
    if (Math.abs(row.scrollLeft - target) > 2) row.scrollLeft = target;
    window.setTimeout(() => this.requestUpdate(), 400);
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const home = this._config.home_path;
    const showHome =
      this._config.show_home_button !== false && !!home && this._path !== home;
    return html`
      <div class="bar">
        ${this._config.title
          ? html`<h1 class="title">${this._config.title}</h1>`
          : nothing}
        <div class="pills">
          ${this._config.items.map((item) => this._renderPill(item))}
        </div>
      </div>
      ${showHome
        ? html`<button class="home" @click=${() => navigate(home!)}>
            <ha-icon icon="mdi:home"></ha-icon><span>Home</span>
          </button>`
        : nothing}
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      css`
        :host {
          display: block;
        }
        .title {
          margin: 8px 0 14px 4px;
          font-size: 34px;
          line-height: 40px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--primary-text-color);
        }
        .pills {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 2px 2px 6px;
          margin: 0 -2px;
          -webkit-overflow-scrolling: touch;
        }
        .pills::-webkit-scrollbar {
          display: none;
        }
        .pill {
          flex: none;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 18px 8px 12px;
          border: none;
          border-radius: 999px;
          background: var(
            --qoxi-pill-background,
            rgba(var(--rgb-primary-text-color), 0.1)
          );
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          color: var(--primary-text-color);
          font: inherit;
          cursor: pointer;
          text-align: left;
          transition:
            background 150ms ease,
            color 150ms ease;
        }
        .pill ha-icon {
          --mdc-icon-size: 22px;
          color: var(--pill-icon-color);
        }
        .pill .text {
          display: flex;
          flex-direction: column;
          line-height: 18px;
        }
        .pill .label {
          font-size: 15px;
          font-weight: 600;
        }
        .pill .status {
          font-size: 13px;
          color: var(--secondary-text-color);
        }
        .pill.active {
          background: #ffffff;
          color: #1c1c1e;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
        }
        .pill.active .status {
          color: #1c1c1e;
          opacity: 0.6;
        }
        .home {
          position: fixed;
          left: 50%;
          bottom: calc(18px + env(safe-area-inset-bottom, 0px));
          transform: translateX(-50%);
          z-index: 5;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 10px 34px;
          border: none;
          border-radius: 999px;
          background: rgba(var(--rgb-card-background-color, 30, 34, 50), 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
          color: rgb(var(--rgb-amber, 255, 193, 7));
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .home ha-icon {
          --mdc-icon-size: 26px;
        }
      `,
    ];
  }
}
