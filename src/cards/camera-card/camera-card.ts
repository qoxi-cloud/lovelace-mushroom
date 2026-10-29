// qoxi: Apple-Home-style camera tile — snapshot that refreshes itself, the
// name on a soft bottom band, the age of the frame in the corner, no play
// button. Tap opens more-info (the live view) unless configured otherwise.
import { css, CSSResultGroup, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { assert } from "superstruct";
import {
  actionHandler,
  ActionHandlerEvent,
  handleAction,
  hasAction,
  HomeAssistant,
  LovelaceCard,
} from "../../ha";
import { MushroomBaseElement } from "../../utils/base-element";
import { registerCustomCard } from "../../utils/custom-cards";
import { CAMERA_CARD_NAME } from "./const";
import { CameraCardConfig, cameraCardConfigStruct } from "./camera-card-config";

registerCustomCard({
  type: CAMERA_CARD_NAME,
  name: "Mushroom Camera Card (qoxi)",
  description:
    "Self-refreshing camera snapshot with a name band, no play button",
});

@customElement(CAMERA_CARD_NAME)
export class CameraCard extends MushroomBaseElement implements LovelaceCard {
  public static async getStubConfig(
    hass: HomeAssistant
  ): Promise<CameraCardConfig> {
    const entity = Object.keys(hass.states).find((id) =>
      id.startsWith("camera.")
    );
    return { type: `custom:${CAMERA_CARD_NAME}`, entity: entity ?? "" };
  }

  @state() private _config?: CameraCardConfig;
  @state() private _tick = 0;
  @state() private _loadedAt = 0;
  @state() private _now = Date.now();
  private _timer?: number;
  private _clock?: number;

  getCardSize(): number {
    return 4;
  }

  setConfig(config: CameraCardConfig): void {
    assert(config, cameraCardConfigStruct);
    this._config = {
      tap_action: { action: "more-info" },
      hold_action: { action: "none" },
      double_tap_action: { action: "none" },
      ...config,
    };
    this._restart();
  }

  connectedCallback() {
    super.connectedCallback();
    this._restart();
    this._clock = window.setInterval(() => (this._now = Date.now()), 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._timer) window.clearInterval(this._timer);
    if (this._clock) window.clearInterval(this._clock);
    this._timer = undefined;
    this._clock = undefined;
  }

  private _restart() {
    if (this._timer) window.clearInterval(this._timer);
    const period = Math.max(2, this._config?.refresh ?? 10) * 1000;
    this._timer = window.setInterval(() => this._tick++, period);
  }

  private _handleAction(ev: ActionHandlerEvent) {
    handleAction(this, this.hass!, this._config!, ev.detail.action!);
  }

  private _src(): string | undefined {
    const stateObj = this.hass?.states[this._config?.entity ?? ""];
    const picture = stateObj?.attributes.entity_picture as string | undefined;
    if (!picture) return undefined;
    // the access token in entity_picture is rotated by HA; `t` only busts the cache
    const sep = picture.includes("?") ? "&" : "?";
    return `${this.hass.hassUrl(picture)}${sep}t=${this._tick}`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const stateObj = this.hass.states[this._config.entity];
    const name =
      this._config.name ??
      (stateObj?.attributes.friendly_name as string | undefined) ??
      this._config.entity;
    const src = this._src();
    const age =
      this._loadedAt && this._config.show_age !== false
        ? `${Math.max(0, Math.round((this._now - this._loadedAt) / 1000))}s`
        : "";
    return html`
      <ha-card
        style=${styleMap({
          "--camera-ratio": this._config.aspect_ratio ?? "16 / 9",
        })}
        @action=${this._handleAction}
        .actionHandler=${actionHandler({
          hasHold: hasAction(this._config.hold_action),
          hasDoubleClick: hasAction(this._config.double_tap_action),
        })}
      >
        ${src
          ? html`<img
              src=${src}
              alt=${name}
              @load=${() => (this._loadedAt = Date.now())}
            />`
          : html`<div class="empty">
              <ha-icon icon="mdi:cctv-off"></ha-icon>
            </div>`}
        <div class="band">
          <span class="name">${name}</span>
          ${age ? html`<span class="age">${age}</span>` : nothing}
        </div>
      </ha-card>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      css`
        ha-card {
          position: relative;
          overflow: hidden;
          aspect-ratio: var(--camera-ratio);
          background: rgba(var(--rgb-primary-text-color), 0.08);
          cursor: pointer;
          padding: 0;
        }
        img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--secondary-text-color);
          --mdc-icon-size: 32px;
        }
        .band {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: 28px 12px 10px;
          background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.55));
          color: #fff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
        }
        .name {
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .age {
          font-size: 12px;
          font-weight: 600;
          opacity: 0.85;
          font-variant-numeric: tabular-nums;
        }
      `,
    ];
  }
}
