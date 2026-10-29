// qoxi: restyle Home Assistant's own camera more-info dialog (which plays the
// stream with sound and controls perfectly) into an Apple-Home-like black
// full-bleed viewer. Opt-in by theme: only when --qoxi-camera-dialog-background
// is defined; nothing else changes, HA's dialog keeps all its behaviour.
const STYLE_ID = "qoxi-camera-more-info";

const CSS = `
  :host([qoxi-camera]) {
    --ha-color-surface-default: var(--qoxi-camera-dialog-background);
    --card-background-color: var(--qoxi-camera-dialog-background);
    --ha-dialog-surface-background: var(--qoxi-camera-dialog-background);
    --primary-text-color: #ffffff;
    --secondary-text-color: rgba(255, 255, 255, 0.6);
    --rgb-primary-text-color: 255, 255, 255;
    --rgb-secondary-text-color: 255, 255, 255;
    --dialog-content-padding: 0;
  }
  :host([qoxi-camera]) ha-icon-button[slot="headerActionItems"],
  :host([qoxi-camera]) ha-dropdown[slot="headerActionItems"] {
    display: none;
  }
  :host([qoxi-camera]) span[slot="headerTitle"] p.main {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  :host([qoxi-camera]) .content-wrapper .content {
    padding: 0;
  }
  :host([qoxi-camera]) .content-wrapper .fade-top,
  :host([qoxi-camera]) .content-wrapper .fade-bottom {
    display: none;
  }
`;

function tick() {
  const ha = document.querySelector("home-assistant");
  const root = ha?.shadowRoot;
  if (!ha || !root) return;
  const dlg = root.querySelector("ha-more-info-dialog") as
    | (HTMLElement & { entityId?: string; _entityId?: string })
    | null;
  if (!dlg) return;
  const enabled = !!getComputedStyle(ha)
    .getPropertyValue("--qoxi-camera-dialog-background")
    .trim();
  const id = dlg.entityId ?? dlg._entityId ?? "";
  const on = enabled && typeof id === "string" && id.startsWith("camera.");
  dlg.toggleAttribute("qoxi-camera", on);
  if (on && dlg.shadowRoot && !dlg.shadowRoot.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    dlg.shadowRoot.appendChild(style);
  }
}

if (typeof window !== "undefined") {
  window.setInterval(tick, 400);
}
