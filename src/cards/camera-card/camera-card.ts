// qoxi: Apple-Home-style camera tile. Live stream (HA's own picture-entity in
// `live` mode: WebRTC/HLS, no play button) with the name on a soft bottom band
// and, like Apple Home, a counter of seconds since playback started. Falls
// back to a self-refreshing snapshot when the camera has no stream.
import { css, CSSResultGroup, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
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
import "./camera-viewer-dialog";
import { showCameraViewer } from "./camera-viewer-dialog";

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<{
      createCardElement: (config: Record<string, unknown>) => LovelaceCard;
    }>;
  }
}

const STREAM = 2; // CameraEntityFeature.STREAM

function deepVideo(root: Element | ShadowRoot | null): HTMLVideoElement | null {
  if (!root) return null;
  const direct = root.querySelector("video");
  if (direct) return direct;
  for (const el of root.querySelectorAll("*")) {
    if (el.shadowRoot) {
      const v = deepVideo(el.shadowRoot);
      if (v) return v;
    }
  }
  return null;
}

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
  @state() private _playStart = 0;
  @state() private _player?: LovelaceCard;
  private _timer?: number;
  private _clock?: number;
  private _liveWanted = false;

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
    this._clock = window.setInterval(() => {
      this._now = Date.now();
      this._watchPlayback();
    }, 1000);
  }

  /** seconds since the live picture started playing (Apple Home style) */
  private _watchPlayback() {
    if (!this._player) return;
    const video = deepVideo(this._player.shadowRoot ?? this._player);
    const playing = !!video && !video.paused && video.readyState >= 2;
    if (playing && !this._playStart) this._playStart = Date.now();
    if (!playing && this._playStart) this._playStart = 0;
  }

  private _isLive(): boolean {
    if (this._config?.live === false) return false;
    const stateObj = this.hass?.states[this._config?.entity ?? ""];
    return (
      !!stateObj &&
      (Number(stateObj.attributes.supported_features) & STREAM) !== 0
    );
  }

  private async _ensurePlayer() {
    if (!this._config || !this.hass || this._player || this._liveWanted) return;
    this._liveWanted = true;
    try {
      const helpers = await window.loadCardHelpers?.();
      if (!helpers) return;
      const el = helpers.createCardElement({
        type: "picture-entity",
        entity: this._config.entity,
        camera_view: "live",
        show_name: false,
        show_state: false,
        tap_action: { action: "none" },
        hold_action: { action: "none" },
      });
      el.hass = this.hass;
      this._player = el;
    } catch (e) {
      this._liveWanted = false;
    }
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    super.updated(changed);
    if (this._isLive()) this._ensurePlayer();
    if (this._player && changed.has("hass")) this._player.hass = this.hass;
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
    if (ev.detail.action === "tap" && this._config?.viewer !== false) {
      showCameraViewer(this, { entity: this._config!.entity });
      return;
    }
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
    const live = this._isLive() && !!this._player;
    const src = this._src();
    const since = live ? this._playStart : this._loadedAt;
    const age =
      since && this._config.show_age !== false
        ? `${Math.max(0, Math.round((this._now - since) / 1000))}s`
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
        ${live
          ? html`<div
              class=${classMap({ player: true, ready: !!this._playStart })}
            >
              ${this._player}
            </div>`
          : nothing}
        ${live && !this._playStart
          ? html`<div class="loading"><span class="spinner"></span></div>`
          : nothing}
        ${this._config.show_band !== false
          ? html`<div class="band">
              <span class="name">${name}</span>
              ${age ? html`<span class="age">${age}</span>` : nothing}
            </div>`
          : nothing}
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
        .player {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 300ms ease;
        }
        .player.ready {
          opacity: 1;
        }
        .loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.25);
        }
        .spinner {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          animation: qoxi-spin 0.9s linear infinite;
        }
        @keyframes qoxi-spin {
          to {
            transform: rotate(360deg);
          }
        }
          --ha-card-border-radius: 0;
          --ha-card-border-width: 0;
          --ha-card-background: transparent;
        }
        .player > * {
          width: 100%;
          height: 100%;
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
