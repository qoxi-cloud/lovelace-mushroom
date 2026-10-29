// qoxi: Apple-Home-style camera tile. Live stream (HA's own picture-entity in
// `live` mode: WebRTC/HLS, no play button) with the name on a soft bottom band
// and a status dot: green while the picture is playing, red while it is not.
// Falls back to a self-refreshing snapshot when the camera has no stream.
// Kept deliberately light: no per-second re-renders, the video element is
// located once and then watched through its own events.
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

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<{
      createCardElement: (config: Record<string, unknown>) => LovelaceCard;
    }>;
  }
}

const STREAM = 2; // CameraEntityFeature.STREAM

function deepVideos(
  root: Element | ShadowRoot | null,
  out: HTMLVideoElement[] = []
): HTMLVideoElement[] {
  if (!root) return out;
  root.querySelectorAll("video").forEach((v) => out.push(v));
  for (const el of root.querySelectorAll("*")) {
    if (el.shadowRoot) deepVideos(el.shadowRoot, out);
  }
  return out;
}

registerCustomCard({
  type: CAMERA_CARD_NAME,
  name: "Mushroom Camera Card (qoxi)",
  description: "Live camera tile with a name band and a status dot",
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
  @state() private _snapshotOk = false;
  @state() private _playing = false;
  @state() private _player?: LovelaceCard;
  private _snapshotTimer?: number;
  private _findTimer?: number;
  private _video?: HTMLVideoElement;
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
    this._restartSnapshots();
  }

  connectedCallback() {
    super.connectedCallback();
    this._restartSnapshots();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopSnapshots();
    this._stopFinding();
    this._unwatch();
  }

  // --- snapshot (poster / fallback) -------------------------------------

  private _restartSnapshots() {
    this._stopSnapshots();
    const period = Math.max(2, this._config?.refresh ?? 10) * 1000;
    this._snapshotTimer = window.setInterval(() => {
      // once the live picture plays there is no point refreshing the poster
      if (!this._playing) this._tick++;
    }, period);
  }

  private _stopSnapshots() {
    if (this._snapshotTimer) window.clearInterval(this._snapshotTimer);
    this._snapshotTimer = undefined;
  }

  private _src(): string | undefined {
    const stateObj = this.hass?.states[this._config?.entity ?? ""];
    const picture = stateObj?.attributes.entity_picture as string | undefined;
    if (!picture) return undefined;
    const sep = picture.includes("?") ? "&" : "?";
    return `${this.hass.hassUrl(picture)}${sep}t=${this._tick}`;
  }

  // --- live player ------------------------------------------------------

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
      this._startFinding();
    } catch (e) {
      this._liveWanted = false;
    }
  }

  /** locate the <video> once (it appears asynchronously), then watch its events */
  private _startFinding() {
    this._stopFinding();
    let attempts = 0;
    this._findTimer = window.setInterval(() => {
      attempts++;
      const video = deepVideos(
        this._player?.shadowRoot ?? this._player ?? null
      ).find((v) => v.srcObject || v.src);
      if (video) {
        this._stopFinding();
        this._watch(video);
      } else if (attempts > 60) {
        this._stopFinding();
      }
    }, 500);
  }

  private _stopFinding() {
    if (this._findTimer) window.clearInterval(this._findTimer);
    this._findTimer = undefined;
  }

  private _onPlaying = () => {
    this._playing = true;
  };
  private _onStalled = () => {
    this._playing = false;
    // the player may replace its <video> on reconnect
    this._startFinding();
  };

  private _watch(video: HTMLVideoElement) {
    this._unwatch();
    this._video = video;
    video.addEventListener("playing", this._onPlaying);
    video.addEventListener("pause", this._onStalled);
    video.addEventListener("ended", this._onStalled);
    video.addEventListener("error", this._onStalled);
    video.addEventListener("emptied", this._onStalled);
    this._playing = !video.paused && video.readyState >= 2;
  }

  private _unwatch() {
    const v = this._video;
    if (!v) return;
    v.removeEventListener("playing", this._onPlaying);
    v.removeEventListener("pause", this._onStalled);
    v.removeEventListener("ended", this._onStalled);
    v.removeEventListener("error", this._onStalled);
    v.removeEventListener("emptied", this._onStalled);
    this._video = undefined;
  }

  /** audio of the live stream; browsers only allow this from a user gesture */
  public setMuted(muted: boolean) {
    const videos = deepVideos(this._player?.shadowRoot ?? this._player ?? null);
    for (const video of videos) {
      video.muted = muted;
      if (!muted) video.volume = 1;
    }
    return videos.length > 0;
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    super.updated(changed);
    if (this._isLive()) this._ensurePlayer();
    if (this._player && changed.has("hass")) this._player.hass = this.hass;
  }

  private _handleAction(ev: ActionHandlerEvent) {
    handleAction(this, this.hass!, this._config!, ev.detail.action!);
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
    const ok = live ? this._playing : this._snapshotOk;
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
              @load=${() => (this._snapshotOk = true)}
              @error=${() => (this._snapshotOk = false)}
            />`
          : html`<div class="empty">
              <ha-icon icon="mdi:cctv-off"></ha-icon>
            </div>`}
        ${live
          ? html`<div class=${classMap({ player: true, ready: this._playing })}>
              ${this._player}
            </div>`
          : nothing}
        ${live && !this._playing
          ? html`<div class="loading"><span class="spinner"></span></div>`
          : nothing}
        ${this._config.show_band !== false
          ? html`<div class="band">
              <span class="name">${name}</span>
              ${this._config.show_age !== false
                ? html`<span class=${classMap({ dot: true, ok })}></span>`
                : nothing}
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
          /* video under a blurred surface is expensive on phones */
          --ha-card-backdrop-filter: none;
          backdrop-filter: none;
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
          --ha-card-border-radius: 0;
          --ha-card-border-width: 0;
          --ha-card-background: transparent;
          --ha-card-backdrop-filter: none;
        }
        .player.ready {
          opacity: 1;
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
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          margin-bottom: 4px;
          background: rgb(var(--rgb-danger, 244, 67, 54));
          box-shadow: 0 0 6px rgba(var(--rgb-danger, 244, 67, 54), 0.8);
        }
        .dot.ok {
          background: rgb(var(--rgb-success, 76, 175, 80));
          box-shadow: 0 0 6px rgba(var(--rgb-success, 76, 175, 80), 0.8);
        }
      `,
    ];
  }
}
