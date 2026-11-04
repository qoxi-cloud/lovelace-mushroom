// qoxi: wraps a camera card (the Scrypted NVR card) and draws the camera name
// and how the camera is attached to the network (wired, or Wi-Fi bars from
// the Omada client) on top of it. The overlay never takes pointer events, so
// the wrapped card keeps its own click → popup behaviour.
import { css, CSSResultGroup, html, nothing, PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { PREFIX_NAME } from "../../const";
import { HomeAssistant, LovelaceCard, LovelaceCardConfig } from "../../ha";
import { normalizeMacKey } from "../../shared/network/model";
import { MushroomBaseElement } from "../../utils/base-element";
import { registerCustomCard } from "../../utils/custom-cards";
import { clientVia, findClient } from "../omada-device-card/device-model";
import { signalTone } from "../omada-clients-card/omada-client-detail-dialog";

export const CAMERA_OVERLAY_CARD_NAME = `${PREFIX_NAME}-camera-overlay-card`;

export interface CameraOverlayCardConfig extends LovelaceCardConfig {
  card: LovelaceCardConfig;
  name?: string;
  /** Omada client MAC (any separator), IP or name */
  client?: string;
  site?: string;
}

type Connection =
  | { kind: "wired"; title: string }
  | { kind: "wifi"; title: string; pct: number }
  | { kind: "offline"; title: string };

registerCustomCard({
  type: CAMERA_OVERLAY_CARD_NAME,
  name: "Mushroom Camera Overlay Card (qoxi)",
  description: "Camera name and network link drawn over another camera card",
});

@customElement(CAMERA_OVERLAY_CARD_NAME)
export class CameraOverlayCard extends MushroomBaseElement {
  @state() private _config?: CameraOverlayCardConfig;
  @state() private _child?: LovelaceCard;

  private _childKey = "";
  private _build = 0;

  public static getStubConfig(): CameraOverlayCardConfig {
    return {
      type: `custom:${CAMERA_OVERLAY_CARD_NAME}`,
      name: "Camera",
      card: { type: "custom:scrypted-nvr-camera", id: 0, live: true },
    };
  }

  setConfig(config: CameraOverlayCardConfig) {
    if (!config?.card?.type) throw new Error("card is required");
    this._config = config;
    // rebuilding the wrapped card restarts its stream: only on a real change
    const key = JSON.stringify(config.card);
    if (key !== this._childKey) {
      this._childKey = key;
      this._createChild(config.card);
    }
  }

  getCardSize() {
    return this._child?.getCardSize?.() ?? 4;
  }

  private async _createChild(cardConfig: LovelaceCardConfig) {
    const build = ++this._build;
    const helpers = await (window as any).loadCardHelpers();
    if (build !== this._build) return;
    const element = helpers.createCardElement(cardConfig) as LovelaceCard;
    if (this.hass) element.hass = this.hass;
    // HA fires ll-rebuild once a not-yet-defined custom card gets defined
    element.addEventListener(
      "ll-rebuild",
      (ev) => {
        ev.stopPropagation();
        if (build === this._build) this._createChild(cardConfig);
      },
      { once: true }
    );
    this._child = element;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    super.willUpdate(changedProps);
    if (
      this._child &&
      this.hass &&
      (changedProps.has("hass") || changedProps.has("_child"))
    ) {
      this._child.hass = this.hass;
    }
  }

  private _connection(
    hass: HomeAssistant,
    client: string
  ): Connection | undefined {
    const record = findClient(hass, client, this._config?.site);
    if (record) {
      if (!record.wireless) return { kind: "wired", title: clientVia(record) };
      const pct = record.metrics.net_client_signal_pct ?? 0;
      return {
        kind: "wifi",
        title: `${clientVia(record)} · ${pct.toFixed(0)} %`,
        pct,
      };
    }
    // the model drops away clients, so tell "offline" from "no data" by the tracker
    const mac = normalizeMacKey(client);
    if (!mac) return undefined;
    const tracker = Object.values(hass.states).find(
      (s) =>
        s.entity_id.startsWith("device_tracker.") &&
        normalizeMacKey(String(s.attributes.mac ?? "")) === mac
    );
    if (!tracker || ["unavailable", "unknown"].includes(tracker.state))
      return undefined;
    return { kind: "offline", title: "Offline" };
  }

  private _renderConnection(conn: Connection) {
    if (conn.kind === "wired") {
      return html`<ha-icon icon="mdi:ethernet"></ha-icon>`;
    }
    if (conn.kind === "offline") {
      return html`<ha-icon icon="mdi:lan-disconnect"></ha-icon>`;
    }
    const lit =
      conn.pct >= 80
        ? 4
        : conn.pct >= 60
          ? 3
          : conn.pct >= 40
            ? 2
            : conn.pct > 0
              ? 1
              : 0;
    return html`
      <span class="bars">
        ${[1, 2, 3, 4].map(
          (i) => html`<i class=${classMap({ on: i <= lit })}></i>`
        )}
      </span>
    `;
  }

  protected render() {
    if (!this._config) return nothing;
    const { name, client } = this._config;
    const conn =
      client && this.hass ? this._connection(this.hass, client) : undefined;
    const tone =
      conn?.kind === "offline"
        ? "danger"
        : conn?.kind === "wifi"
          ? signalTone(conn.pct)
          : "normal";
    return html`
      <div class="frame">
        ${this._child ?? nothing}
        <div class="overlay">
          ${name ? html`<span class="pill name">${name}</span>` : nothing}
          ${conn
            ? html`<span
                class=${classMap({
                  pill: true,
                  link: true,
                  [conn.kind]: true,
                  [tone ?? "normal"]: true,
                })}
                title=${conn.title}
                >${this._renderConnection(conn)}</span
              >`
            : nothing}
        </div>
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
        /* no transform/filter/contain here: the wrapped card opens its
           popup with position: fixed and would be trapped inside the tile */
        .frame {
          position: relative;
          overflow: hidden;
          border-radius: var(--ha-card-border-radius, 12px);
          border: var(--ha-card-border-width, 1px) solid
            var(--ha-card-border-color, var(--divider-color));
          background: #000;
        }
        .overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
        }
        .pill {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.55);
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
          color: #fff;
        }
        .name {
          top: 10px;
          left: 10px;
          max-width: calc(100% - 20px);
          padding: 4px 9px;
          font-size: 13px;
          font-weight: 600;
          line-height: 18px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .link {
          right: 10px;
          bottom: 10px;
          width: 28px;
          height: 28px;
          --mdc-icon-size: 18px;
          color: rgb(var(--rgb-success));
        }
        .link.wired {
          color: rgba(255, 255, 255, 0.85);
        }
        .link.warning {
          color: rgb(var(--rgb-warning));
        }
        .link.danger {
          color: rgb(var(--rgb-danger));
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
          opacity: 0.3;
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
      `,
    ];
  }
}
