import { html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import memoizeOne from "memoize-one";
import { assert } from "superstruct";
import { fireEvent, HomeAssistant, LovelaceCardEditor } from "../../ha";
import setupCustomlocalize from "../../localize";
import { computeAppearanceFormSchema } from "../../shared/config/appearance-config";
import { MushroomBaseElement } from "../../utils/base-element";
import { GENERIC_LABELS } from "../../utils/form/generic-fields";
import { HaFormSchema } from "../../utils/form/ha-form";
import { loadHaComponents } from "../../utils/loader";
import { listDevices } from "../omada-device-card/device-model";
import { OMADA_CLIENTS_CARD_EDITOR_NAME } from "./const";
import {
  CLIENT_FILTERS,
  CLIENT_SORTS,
  OmadaClientsCardConfig,
  omadaClientsCardConfigStruct,
} from "./omada-clients-card-config";

const CLIENTS_LABELS = ["device", "filter", "show_filters", "sort", "limit"];

const computeSchema = memoizeOne(
  (
    hass: HomeAssistant,
    customLocalize: ReturnType<typeof setupCustomlocalize>,
    site: string | undefined
  ): HaFormSchema[] => [
    { name: "name", selector: { text: {} } },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "icon", selector: { icon: {} } },
        { name: "icon_color", selector: { ui_color: {} } },
      ],
    },
    {
      name: "device",
      selector: {
        select: {
          mode: "dropdown",
          options: listDevices(hass, site).map((d) => ({
            value: d.name,
            label: `${d.name} (${d.model || d.type})`,
          })),
        },
      },
    },
    {
      type: "grid",
      name: "",
      schema: [
        {
          name: "filter",
          selector: {
            select: {
              mode: "dropdown",
              options: CLIENT_FILTERS.map((f) => ({
                value: f,
                label: customLocalize(`card.net_clients.${f}`),
              })),
            },
          },
        },
        {
          name: "sort",
          selector: {
            select: {
              mode: "dropdown",
              options: CLIENT_SORTS.map((f) => ({
                value: f,
                label: customLocalize(`editor.card.net_clients.sort_${f}`),
              })),
            },
          },
        },
        {
          name: "limit",
          selector: { number: { min: 0, max: 500, mode: "box" } },
        },
        { name: "show_filters", selector: { boolean: {} } },
      ],
    },
    ...computeAppearanceFormSchema(customLocalize),
  ]
);

@customElement(OMADA_CLIENTS_CARD_EDITOR_NAME)
export class OmadaClientsCardEditor
  extends MushroomBaseElement
  implements LovelaceCardEditor
{
  @state() private _config?: OmadaClientsCardConfig;

  connectedCallback() {
    super.connectedCallback();
    void loadHaComponents();
  }

  public setConfig(config: OmadaClientsCardConfig): void {
    assert(config, omadaClientsCardConfigStruct);
    this._config = config;
  }

  private _computeLabel = (schema: HaFormSchema) => {
    const customLocalize = setupCustomlocalize(this.hass!);
    if (CLIENTS_LABELS.includes(schema.name)) {
      return customLocalize(`editor.card.net_clients.${schema.name}`);
    }
    if (GENERIC_LABELS.includes(schema.name)) {
      return customLocalize(`editor.card.generic.${schema.name}`);
    }
    return this.hass!.localize(
      `ui.panel.lovelace.editor.card.generic.${schema.name}`
    );
  };

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const customLocalize = setupCustomlocalize(this.hass);
    const schema = computeSchema(this.hass, customLocalize, this._config.site);
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${schema}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    fireEvent(this, "config-changed", { config: ev.detail.value });
  }
}
