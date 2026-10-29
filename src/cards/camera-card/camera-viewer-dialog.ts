// qoxi: Apple-Home-style full-screen camera viewer — black background, big
// live picture, "All Cameras" header, a strip of the other cameras to switch,
// and a grid mode that shows every camera live at once.
import { css, CSSResultGroup, html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { keyed } from "lit/directives/keyed.js";
import { PREFIX_NAME } from "../../const";
import { QoxiSheet, showSheet } from "../../shared/qoxi-sheet";
import { CAMERA_CARD_NAME } from "./const";

export const CAMERA_VIEWER_DIALOG_NAME = `${PREFIX_NAME}-camera-viewer-dialog`;

export interface CameraViewerParams {
  entity: string;
  /** every camera to offer in the strip / grid; defaults to all camera.* */
  cameras?: string[];
}

export function showCameraViewer(el: HTMLElement, params: CameraViewerParams) {
  showSheet(el, CAMERA_VIEWER_DIALOG_NAME, params);
}

@customElement(CAMERA_VIEWER_DIALOG_NAME)
export class CameraViewerDialog extends QoxiSheet<CameraViewerParams> {
  @state() private _current = "";
  @state() private _grid = false;
  @state() private _muted = true;
  private _cards = new Map<string, HTMLElement>();
  private _audioTimer?: number;

  connectedCallback() {
    super.connectedCallback();
    // re-apply the audio choice when a player (re)appears after switching cameras
    this._audioTimer = window.setInterval(() => this._applyAudio(), 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._audioTimer) window.clearInterval(this._audioTimer);
  }

  private _applyAudio() {
    // nothing to do: the main player is re-created with the new `muted`
  }

  private _toggleAudio() {
    this._muted = !this._muted;
  }

  @state() private _streamReady = false;

  private async _ensureStreamElement() {
    if (customElements.get("ha-camera-stream")) {
      this._streamReady = true;
      return;
    }
    // ha-camera-stream is lazy-loaded by picture-entity (live); create one to import it
    try {
      const helpers = await window.loadCardHelpers?.();
      helpers?.createCardElement({
        type: "picture-entity",
        entity: this._current,
        camera_view: "live",
      });
      await customElements.whenDefined("ha-camera-stream");
    } catch (e) {
      /* fall back to the card below */
    }
    this._streamReady = !!customElements.get("ha-camera-stream");
  }

  private _renderMain() {
    const stateObj = this.hass.states[this._current];
    if (!this._streamReady || !stateObj) return this._card(this._current);
    // keyed: toggling sound re-negotiates the stream with the audio track
    return keyed(
      `${this._current}:${this._muted}`,
      html`<ha-camera-stream
        class="stream"
        .hass=${this.hass}
        .stateObj=${stateObj}
        .muted=${this._muted}
        .fitMode=${"contain"}
        .controls=${false}
      ></ha-camera-stream>`
    );
  }

  public showDialog(params: CameraViewerParams): void {
    this._current = params.entity;
    this._grid = false;
    this._muted = true;
    this._ensureStreamElement();
    super.showDialog(params);
  }

  public closeDialog(): void {
    super.closeDialog();
    // drop the players so the streams stop
    this._cards.forEach((c) => c.remove());
    this._cards.clear();
  }

  private get _cameras(): string[] {
    const fromParams = this._params?.cameras;
    if (fromParams?.length) return fromParams;
    return Object.keys(this.hass.states)
      .filter((id) => id.startsWith("camera."))
      .sort();
  }

  private _name(id: string): string {
    return (
      (this.hass.states[id]?.attributes.friendly_name as string | undefined) ??
      id
    );
  }

  private _card(id: string): HTMLElement {
    let el = this._cards.get(id);
    if (!el) {
      el = document.createElement(CAMERA_CARD_NAME) as HTMLElement & {
        setConfig: (c: unknown) => void;
        hass: unknown;
      };
      (el as any).setConfig({
        type: `custom:${CAMERA_CARD_NAME}`,
        entity: id,
        show_band: false,
        viewer: false,
        tap_action: { action: "none" },
      });
      this._cards.set(id, el);
    }
    (el as any).hass = this.hass;
    return el;
  }

  protected renderHeader(): TemplateResult | typeof nothing {
    return nothing;
  }
  protected renderBody(): TemplateResult | typeof nothing {
    return nothing;
  }

  protected render() {
    if (!this._params || !this.hass) return nothing;
    const cams = this._cameras;
    const name = this._name(this._current);
    return html`
      <div class="viewer">
        <div class="top">
          <button class="round" @click=${this.closeDialog} aria-label="Close">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
          <div class="titles">
            <div class="t">All Cameras</div>
            <div class="s">
              ${this._grid ? `${cams.length} cameras` : `${name} • Live`}
            </div>
          </div>
          ${!this._grid
            ? html`<button
                class=${classMap({ round: true, active: !this._muted })}
                @click=${this._toggleAudio}
                aria-label="Sound"
              >
                <ha-icon
                  icon=${this._muted ? "mdi:volume-off" : "mdi:volume-high"}
                ></ha-icon>
              </button>`
            : nothing}
          <button
            class=${classMap({ round: true, active: this._grid })}
            @click=${() => (this._grid = !this._grid)}
            aria-label="Grid"
          >
            <ha-icon
              icon=${this._grid ? "mdi:view-agenda" : "mdi:view-grid"}
            ></ha-icon>
          </button>
        </div>
        ${this._grid
          ? html`<div class="grid">
              ${cams.map(
                (id) =>
                  html`<div
                    class="cell"
                    @click=${() => {
                      this._current = id;
                      this._grid = false;
                    }}
                  >
                    ${this._card(id)}
                    <div class="cell-name">${this._name(id)}</div>
                  </div>`
              )}
            </div>`
          : html`
              <div class="main">${this._renderMain()}</div>
              ${cams.length > 1
                ? html`<div class="strip">
                    ${cams.map(
                      (id) =>
                        html`<button
                          class=${classMap({
                            thumb: true,
                            selected: id === this._current,
                          })}
                          @click=${() => (this._current = id)}
                          title=${this._name(id)}
                        >
                          <img
                            src=${this.hass.hassUrl(
                              String(
                                this.hass.states[id]?.attributes
                                  .entity_picture ?? ""
                              )
                            )}
                            alt=${this._name(id)}
                          />
                        </button>`
                    )}
                  </div>`
                : nothing}
            `}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      css`
        :host {
          background: #000;
          padding: 0;
          align-items: stretch;
          justify-content: stretch;
        }
        .viewer {
          flex: 1;
          display: flex;
          flex-direction: column;
          color: #fff;
          padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px
            calc(env(safe-area-inset-bottom, 0px) + 16px);
          box-sizing: border-box;
          min-height: 100dvh;
        }
        .top {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 8px;
        }
        .titles {
          flex: 1;
          min-width: 0;
        }
        .t {
          font-size: 20px;
          font-weight: 700;
          line-height: 24px;
        }
        .s {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .round {
          flex: none;
          width: 44px;
          height: 44px;
          border: none;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          --mdc-icon-size: 22px;
        }
        .round.active {
          background: #fff;
          color: #000;
        }
        .main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
        }
        .main > * {
          width: 100%;
          max-height: 100%;
          --camera-ratio: 16 / 9;
          --ha-card-border-radius: 0;
        }
        .main {
          margin: 0 -16px;
        }
        .stream {
          width: 100%;
          display: block;
          --video-max-height: 70dvh;
        }
        .strip {
          display: flex;
          gap: 12px;
          justify-content: center;
          padding: 16px 0 0;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .thumb {
          flex: none;
          width: 88px;
          height: 62px;
          padding: 0;
          border: 3px solid transparent;
          border-radius: 16px;
          overflow: hidden;
          background: #222;
          cursor: pointer;
        }
        .thumb.selected {
          border-color: #fff;
        }
        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .grid {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-content: start;
          overflow-y: auto;
        }
        @media (min-width: 700px) {
          .grid {
            grid-template-columns: 1fr 1fr;
          }
          .main > * {
            max-width: min(100%, calc((100dvh - 200px) * 16 / 9));
          }
        }
        .cell {
          position: relative;
          cursor: pointer;
        }
        .cell-name {
          position: absolute;
          left: 12px;
          bottom: 10px;
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
        }
      `,
    ];
  }
}
