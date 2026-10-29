// qoxi: a card that immediately sends the browser to another path. Used to
// put HA's built-in Home panel (which HA hides from the sidebar once another
// dashboard is the default) back into the sidebar as a plain dashboard entry.
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { PREFIX_NAME } from "../../const";
import { registerCustomCard } from "../../utils/custom-cards";

export const REDIRECT_CARD_NAME = `${PREFIX_NAME}-redirect-card`;

interface RedirectCardConfig {
  type: string;
  path: string;
}

registerCustomCard({
  type: REDIRECT_CARD_NAME,
  name: "Mushroom Redirect Card (qoxi)",
  description: "Opens another path as soon as the view is shown",
});

@customElement(REDIRECT_CARD_NAME)
export class RedirectCard extends LitElement {
  @state() private _config?: RedirectCardConfig;

  public static getStubConfig(): RedirectCardConfig {
    return { type: `custom:${REDIRECT_CARD_NAME}`, path: "/home" };
  }

  setConfig(config: RedirectCardConfig) {
    if (!config.path) throw new Error("path is required");
    this._config = config;
  }

  getCardSize() {
    return 1;
  }

  connectedCallback() {
    super.connectedCallback();
    this._go();
  }

  private _go() {
    const path = this._config?.path;
    if (!path || location.pathname.startsWith(path)) return;
    // replace, so "back" does not bounce through this page again
    history.replaceState(null, "", path);
    window.dispatchEvent(
      new CustomEvent("location-changed", { detail: { replace: true } })
    );
  }

  protected render() {
    return this._config ? html`` : nothing;
  }
}
