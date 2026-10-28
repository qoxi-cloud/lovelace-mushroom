// qoxi: shared bottom-sheet / dialog base for the network cards (ONU, ISP…).
// Opened through HA's dialog manager (`show-dialog`), so hass keeps flowing in.
import { css, CSSResultGroup, html, nothing, TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { fireEvent } from "../ha";
import "./shape-icon";
import { MushroomBaseElement } from "../utils/base-element";

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

export function showSheet(element: HTMLElement, tag: string, params: unknown) {
  fireEvent(element, "show-dialog", {
    dialogTag: tag,
    dialogImport: () => Promise.resolve(),
    dialogParams: params,
  });
}

export type Tone = "normal" | "warning" | "danger" | "success";

export interface SheetRow {
  label: string;
  value: string;
  tone?: Tone;
}

export interface TableCell {
  text: string;
  tone?: Tone;
  /** status dot before the text */
  dot?: Tone;
  /** mdi icon before the text */
  icon?: string;
  muted?: boolean;
}

export interface SheetTable {
  title: string;
  tag: string;
  /** CSS grid-template-columns, e.g. "56px 1fr 90px 70px" */
  columns: string;
  headers: string[];
  rows: TableCell[][];
  /** Below this width the table scrolls horizontally instead of squeezing (e.g. "520px") */
  minWidth?: string;
  /** grid-template-columns on narrow screens (≤ 640px); hidden columns must be dropped here */
  columnsMobile?: string;
  /** column indexes hidden on narrow screens */
  hideOnMobile?: number[];
  /** row keys (same order as rows) to make rows selectable */
  rowKeys?: string[];
  /** keys of rows to highlight */
  activeKeys?: string[];
  onRow?: (key: string) => void;
}

export abstract class QoxiSheet<P> extends MushroomBaseElement {
  @state() protected _params?: P;

  public showDialog(params: P): void {
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

  // Scroll only inside .body; the page behind the sheet stays put.
  private _onScrollIntent = (ev: Event) => {
    const body = this.renderRoot.querySelector(".body");
    if (body && ev.composedPath().includes(body)) return;
    ev.preventDefault();
  };

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("wheel", this._onScrollIntent, { passive: false });
    this.addEventListener("touchmove", this._onScrollIntent, {
      passive: false,
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("wheel", this._onScrollIntent);
    this.removeEventListener("touchmove", this._onScrollIntent);
  }

  protected abstract renderHeader(): TemplateResult | typeof nothing;
  protected abstract renderBody(): TemplateResult | typeof nothing;

  protected render() {
    if (!this._params || !this.hass) return nothing;
    return html`
      <div class="backdrop" @click=${this.closeDialog}></div>
      <div class="sheet" role="dialog">
        <div class="handle" @click=${this.closeDialog}></div>
        ${this.renderHeader()}
        <ha-icon-button class="close" @click=${this.closeDialog}>
          <ha-icon icon="mdi:close"></ha-icon>
        </ha-icon-button>
        <div class="body">${this.renderBody()}</div>
      </div>
    `;
  }

  protected renderTitle(
    icon: string,
    rgb: string,
    disabled: boolean,
    name: string,
    subtitle: string
  ) {
    return html`
      <div class="header">
        <mushroom-shape-icon
          .disabled=${disabled}
          style="--icon-color: rgb(${rgb}); --shape-color: rgba(${rgb}, 0.2)"
        >
          <ha-icon .icon=${icon}></ha-icon>
        </mushroom-shape-icon>
        <div class="title">
          <span class="name">${name}</span>
          <span class="subtitle">${subtitle}</span>
        </div>
      </div>
    `;
  }

  protected renderStat(row: SheetRow) {
    return html`
      <div class=${classMap({ stat: true, [row.tone ?? "normal"]: true })}>
        <span class="stat-label">${row.label}</span>
        <span class="stat-value">${row.value}</span>
      </div>
    `;
  }

  protected renderSection(title: string, tag: string, rows: SheetRow[]) {
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

  protected renderTable(table: SheetTable) {
    const style = `--table-columns: ${table.columns}; --table-columns-mobile: ${table.columnsMobile ?? table.columns}; --table-min-width: ${table.minWidth ?? "0"}`;
    const hidden = new Set(table.hideOnMobile ?? []);
    const active = new Set(table.activeKeys ?? []);
    return html`
      <section>
        <div class="section-title">
          <span>${table.title}</span>
          <span class="tag">${table.tag}</span>
        </div>
        <div class="table" style=${style}>
          <div class="table-head">
            ${table.headers.map(
              (h, i) =>
                html`<span class=${classMap({ "m-hide": hidden.has(i) })}
                  >${h}</span
                >`
            )}
          </div>
          ${table.rows.map((cells, rowIndex) => {
            const key = table.rowKeys?.[rowIndex];
            return html`
              <div
                class=${classMap({
                  "table-row": true,
                  selectable: !!table.onRow && key !== undefined,
                  active: key !== undefined && active.has(key),
                })}
                @click=${key !== undefined && table.onRow
                  ? () => table.onRow!(key)
                  : undefined}
              >
                ${cells.map(
                  (c, i) => html`
                    <span
                      class=${classMap({
                        cell: true,
                        muted: !!c.muted,
                        "m-hide": hidden.has(i),
                        [c.tone ?? "normal"]: true,
                      })}
                    >
                      ${c.dot ? html`<i class="dot ${c.dot}"></i>` : nothing}
                      ${c.icon
                        ? html`<ha-icon
                            class="cell-icon"
                            .icon=${c.icon}
                          ></ha-icon>`
                        : nothing}
                      <span class="cell-text">${c.text}</span>
                    </span>
                  `
                )}
              </div>
            `;
          })}
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
          box-sizing: border-box;
          padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
            env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
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
          display: flex;
          flex-direction: column;
          width: min(780px, calc(100vw - 32px));
          max-height: calc(
            100dvh - env(safe-area-inset-top, 0px) - env(
                safe-area-inset-bottom,
                0px
              ) -
              32px
          );
          overflow: hidden;
          box-sizing: border-box;
          background: var(
            --ha-card-background,
            var(--card-background-color, white)
          );
          border-radius: calc(var(--ha-card-border-radius, 12px) + 4px);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
          color: var(--primary-text-color);
        }
        .handle {
          display: none;
        }
        .close {
          position: absolute;
          top: 10px;
          right: 10px;
          color: var(--secondary-text-color);
          --mdc-icon-button-size: 44px;
          z-index: 1;
        }
        .header {
          flex: none;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 64px 12px 20px;
        }
        .body {
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          padding: 4px 20px 20px;
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
        .stat.success,
        .row.success {
          --stat-color: rgb(var(--rgb-success));
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
        .columns.single {
          grid-template-columns: 1fr;
        }
        .tables {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 16px;
        }
        .tables:empty {
          display: none;
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
        .table {
          border-radius: var(--control-border-radius);
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          background: rgba(var(--rgb-primary-text-color), 0.04);
        }
        .table::-webkit-scrollbar {
          display: none;
        }
        .table-head,
        .table-row {
          display: grid;
          grid-template-columns: var(--table-columns);
          gap: 8px;
          align-items: center;
          padding: 8px 12px;
          box-sizing: border-box;
          min-width: var(--table-min-width, 0);
        }
        .table-head {
          font-size: 10px;
          line-height: 12px;
          font-weight: 500;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: var(--secondary-text-color);
          background: rgba(var(--rgb-primary-text-color), 0.04);
        }
        .table-row + .table-row {
          border-top: 1px solid rgba(var(--rgb-primary-text-color), 0.06);
        }
        .table-row.selectable {
          cursor: pointer;
        }
        .table-row.selectable:hover {
          background: rgba(var(--rgb-primary-text-color), 0.06);
        }
        .table-row.active {
          background: rgba(var(--rgb-primary), 0.18);
          box-shadow: inset 3px 0 0 rgb(var(--rgb-primary));
        }
        .cell {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          font-size: 13px;
          line-height: 18px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          color: var(--primary-text-color);
        }
        .cell-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cell.muted {
          color: var(--secondary-text-color);
          font-weight: 400;
        }
        .cell.success {
          color: rgb(var(--rgb-success));
        }
        .cell.warning {
          color: rgb(var(--rgb-warning));
        }
        .cell.danger {
          color: rgb(var(--rgb-danger));
        }
        .cell-icon {
          --mdc-icon-size: 14px;
          color: rgb(var(--rgb-warning));
          flex: none;
        }
        .dot {
          flex: none;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgb(var(--rgb-disabled));
        }
        .dot.success {
          background: rgb(var(--rgb-success));
          box-shadow: 0 0 6px rgba(var(--rgb-success), 0.7);
        }
        .dot.danger {
          background: rgb(var(--rgb-danger));
          box-shadow: 0 0 6px rgba(var(--rgb-danger), 0.7);
        }
        .dot.warning {
          background: rgb(var(--rgb-warning));
          box-shadow: 0 0 6px rgba(var(--rgb-warning), 0.7);
        }
        @media (max-width: 640px) {
          :host {
            align-items: flex-end;
            padding: 0;
          }
          .sheet {
            width: 100vw;
            max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 40px);
            border-radius: 20px 20px 0 0;
            box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.35);
          }
          .handle {
            display: block;
            flex: none;
            width: 40px;
            height: 5px;
            margin: 8px auto 0;
            border-radius: 3px;
            background: rgba(var(--rgb-primary-text-color), 0.25);
          }
          .header {
            padding: 10px 60px 10px 16px;
          }
          .close {
            top: 12px;
          }
          .body {
            padding: 0 16px calc(16px + env(safe-area-inset-bottom, 0px));
          }
          .hero {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .columns {
            grid-template-columns: 1fr;
          }
          .table-head,
          .table-row {
            grid-template-columns: var(--table-columns-mobile);
            min-width: 0;
          }
          .m-hide {
            display: none;
          }
        }
      `,
    ];
  }
}
