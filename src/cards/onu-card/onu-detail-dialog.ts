import { css, CSSResultGroup, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { fireEvent } from "../../ha";
import setupCustomlocalize from "../../localize";
import "../../shared/shape-icon";
import { MushroomBaseElement } from "../../utils/base-element";
import { computeRgbColor } from "../../utils/colors";
import { DEFAULT_ONU_ICON } from "./const";
import {
  findOnu,
  formatBytes,
  formatDuration,
  formatRate,
  OnuDevice,
  shortPonState,
} from "./onu-model";

export const ONU_DETAIL_DIALOG_NAME = "mushroom-onu-detail-dialog";

export interface OnuDetailDialogParams {
  serial?: string;
  prefix?: string;
  name?: string;
  icon?: string;
  icon_color?: string;
}

declare global {
  interface HASSDomEvents {
    "show-dialog": {
      dialogTag: string;
      dialogImport: () => Promise<unknown>;
      dialogParams: unknown;
      addHistory?: boolean;
    };
    "dialog-closed": { dialog: string };
  }
}

export function showOnuDetailDialog(
  element: HTMLElement,
  params: OnuDetailDialogParams
) {
  fireEvent(element, "show-dialog", {
    dialogTag: ONU_DETAIL_DIALOG_NAME,
    dialogImport: () => Promise.resolve(),
    dialogParams: params,
  });
}

type Tone = "normal" | "warning" | "danger";

interface Row {
  label: string;
  value: string;
  tone?: Tone;
}

@customElement(ONU_DETAIL_DIALOG_NAME)
export class OnuDetailDialog extends MushroomBaseElement {
  @state() private _params?: OnuDetailDialogParams;

  public showDialog(params: OnuDetailDialogParams): void {
    this._params = params;
    this.toggleAttribute("open", true);
    document.addEventListener("keydown", this._onKeyDown);
  }

  public closeDialog(): void {
    if (!this._params) return;
    this._params = undefined;
    // The dialog manager keeps the element mounted; never leave a full-screen overlay behind.
    this.toggleAttribute("open", false);
    document.removeEventListener("keydown", this._onKeyDown);
    fireEvent(this, "dialog-closed", { dialog: this.localName });
  }

  private _onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") this.closeDialog();
  };

  protected render() {
    if (!this._params || !this.hass) return nothing;
    const onu = findOnu(this.hass, this._params.prefix, this._params.serial);
    const localize = setupCustomlocalize(this.hass);
    const t = (key: string) => localize(`card.onu.detail.${key}`);
    const name = this._params.name || onu?.name || this._params.serial || "";

    return html`
      <div class="backdrop" @click=${this.closeDialog}></div>
      <div class="sheet" role="dialog" aria-label=${name}>
        <ha-icon-button class="close" @click=${this.closeDialog}>
          <ha-icon icon="mdi:close"></ha-icon>
        </ha-icon-button>
        ${onu
          ? this.renderBody(onu, name, t)
          : html`<p>${localize("card.not_found")}</p>`}
      </div>
    `;
  }

  private renderBody(onu: OnuDevice, name: string, t: (k: string) => string) {
    const m = onu.metrics;
    const status = onu.online
      ? setupCustomlocalize(this.hass)("card.onu.online")
      : setupCustomlocalize(this.hass)("card.onu.offline");
    const rgb = computeRgbColor(
      this._params?.icon_color ?? (onu.online ? "green" : "grey")
    );

    const hero: Row[] = [
      {
        label: t("rx_power"),
        value: `${m.rx_power.toFixed(2)} dBm`,
        tone:
          m.rx_power <= -27
            ? "danger"
            : m.rx_power <= -24
              ? "warning"
              : "normal",
      },
      { label: t("tx_power"), value: `${m.tx_power.toFixed(2)} dBm` },
      { label: t("uptime"), value: formatDuration(m.uptime) },
      { label: t("time_in_state"), value: formatDuration(m.time_in_state) },
      {
        label: t("optic_temp"),
        value: `${m.optic_temp.toFixed(1)} °C`,
        tone:
          m.optic_temp >= 70
            ? "danger"
            : m.optic_temp >= 60
              ? "warning"
              : "normal",
      },
      {
        label: t("cpu_temp"),
        value: `${m.cpu_temp.toFixed(1)} °C`,
        tone:
          m.cpu_temp >= 85 ? "danger" : m.cpu_temp >= 75 ? "warning" : "normal",
      },
      { label: t("down_rate"), value: formatRate(m.down_rate) },
      { label: t("up_rate"), value: formatRate(m.up_rate) },
    ];

    const link: Row[] = [
      { label: t("vendor"), value: onu.vendor || "—" },
      { label: t("pon_state"), value: onu.ponState || "—" },
      { label: t("pon_previous_state"), value: onu.ponPreviousState || "—" },
      { label: t("pon_mode"), value: onu.ponMode || "—" },
      { label: t("gpon_serial"), value: onu.gponSerial || "—" },
      { label: t("sfp_serial"), value: onu.serial.toUpperCase() },
      { label: t("voltage"), value: `${m.voltage.toFixed(3)} V` },
      { label: t("tx_bias"), value: `${m.tx_bias.toFixed(2)} mA` },
      { label: t("memory"), value: `${m.memory.toFixed(0)} %` },
      { label: t("load_1m"), value: m.load_1m.toFixed(2) },
      {
        label: t("ethernet_speed"),
        value: m.ethernet_speed ? `${m.ethernet_speed} Mbit/s` : "—",
      },
    ];

    const traffic: Row[] = [
      { label: t("down_total"), value: formatBytes(m.down_total) },
      { label: t("up_total"), value: formatBytes(m.up_total) },
      {
        label: t("gem_key_errors"),
        value: String(m.gem_key_errors),
        tone: m.gem_key_errors > 0 ? "warning" : "normal",
      },
      { label: t("fec_corrected"), value: String(m.fec_corrected) },
      {
        label: t("fec_uncorrected"),
        value: String(m.fec_uncorrected),
        tone: m.fec_uncorrected > 0 ? "warning" : "normal",
      },
      {
        label: t("bip_errors"),
        value: String(m.bip_errors),
        tone: m.bip_errors > 0 ? "warning" : "normal",
      },
      {
        label: t("lods_events"),
        value: String(m.lods_events),
        tone: m.lods_events > 0 ? "warning" : "normal",
      },
      {
        label: t("alarm"),
        value: onu.alarm ? t("alarm_active") : t("alarm_none"),
        tone: onu.alarm ? "danger" : "normal",
      },
    ];

    return html`
      <div class="header">
        <mushroom-shape-icon
          .disabled=${!onu.online}
          style="--icon-color: rgb(${rgb}); --shape-color: rgba(${rgb}, 0.2)"
        >
          <ha-icon .icon=${this._params?.icon ?? DEFAULT_ONU_ICON}></ha-icon>
        </mushroom-shape-icon>
        <div class="title">
          <span class="name">${name}</span>
          <span class="subtitle"
            >${status}${onu.ponState
              ? ` · ${shortPonState(onu.ponState)}`
              : ""}${onu.model ? ` · ${onu.model}` : ""}</span
          >
        </div>
      </div>
      <div class="hero">${hero.map((r) => this.renderStat(r))}</div>
      <div class="columns">
        ${this.renderSection(t("pon_link"), onu.oltVendor || "OLT", link)}
        ${this.renderSection(t("traffic"), "GEM", traffic)}
      </div>
    `;
  }

  private renderStat(row: Row) {
    return html`
      <div class=${classMap({ stat: true, [row.tone ?? "normal"]: true })}>
        <span class="stat-label">${row.label}</span>
        <span class="stat-value">${row.value}</span>
      </div>
    `;
  }

  private renderSection(title: string, tag: string, rows: Row[]) {
    return html`
      <section>
        <div class="section-title">
          <span>${title}</span>
          <span class="tag">${tag}</span>
        </div>
        <div class="rows">
          ${rows.map(
            (r) => html`
              <div class=${classMap({ row: true, [r.tone ?? "normal"]: true })}>
                <span class="row-label">${r.label}</span>
                <span class="row-value">${r.value}</span>
              </div>
            `
          )}
        </div>
      </section>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      css`
        :host(:not([open])) {
          display: none;
        }
        :host {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--paper-font-body1_-_font-family, inherit);
        }
        .backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .sheet {
          position: relative;
          width: min(780px, calc(100vw - 32px));
          max-height: calc(100vh - 32px);
          overflow: auto;
          box-sizing: border-box;
          padding: 20px;
          background: var(
            --ha-card-background,
            var(--card-background-color, white)
          );
          border-radius: calc(var(--ha-card-border-radius, 12px) + 4px);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
          color: var(--primary-text-color);
        }
        .close {
          position: absolute;
          top: 8px;
          right: 8px;
          color: var(--secondary-text-color);
          --mdc-icon-button-size: 40px;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding-right: 40px;
        }
        .title {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .name {
          font-size: 18px;
          line-height: 24px;
          font-weight: 600;
          letter-spacing: -0.2px;
        }
        .subtitle {
          font-size: 13px;
          line-height: 18px;
          color: var(--secondary-text-color);
        }
        .hero {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        }
        .stat {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          height: 52px;
          box-sizing: border-box;
          padding: 0 12px;
          border-radius: var(--control-border-radius);
          background: rgba(var(--rgb-primary-text-color), 0.05);
          --stat-color: var(--primary-text-color);
        }
        .stat.warning,
        .row.warning {
          background: rgba(var(--rgb-warning), 0.15);
          --stat-color: rgb(var(--rgb-warning));
        }
        .stat.danger,
        .row.danger {
          background: rgba(var(--rgb-danger), 0.15);
          --stat-color: rgb(var(--rgb-danger));
        }
        .stat-label,
        .row-label {
          font-size: 10px;
          line-height: 12px;
          font-weight: 500;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: var(--secondary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .stat-value {
          font-size: 14px;
          line-height: 18px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--stat-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .columns {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .section-title {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 14px;
          font-weight: 600;
          margin: 0 4px 8px;
        }
        .tag {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: var(--secondary-text-color);
        }
        .rows {
          display: flex;
          flex-direction: column;
          gap: 2px;
          border-radius: var(--control-border-radius);
          overflow: hidden;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 9px 12px;
          background: rgba(var(--rgb-primary-text-color), 0.04);
          --stat-color: var(--primary-text-color);
        }
        .row-value {
          font-size: 13px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          color: var(--stat-color);
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 640px) {
          .hero {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .columns {
            grid-template-columns: 1fr;
          }
          .sheet {
            padding: 16px;
          }
        }
      `,
    ];
  }
}
