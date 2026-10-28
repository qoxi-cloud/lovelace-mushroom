import { html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import memoizeOne from "memoize-one";
import { assert } from "superstruct";
import { fireEvent, HomeAssistant, LovelaceCardEditor } from "../../ha";
import setupCustomlocalize from "../../localize";
import { computeActionsFormSchema } from "../../shared/config/actions-config";
import { computeAppearanceFormSchema } from "../../shared/config/appearance-config";
import { MushroomBaseElement } from "../../utils/base-element";
import { GENERIC_LABELS } from "../../utils/form/generic-fields";
import { HaFormSchema } from "../../utils/form/ha-form";
import { loadHaComponents } from "../../utils/loader";
import { OMADA_DEVICE_CARD_EDITOR_NAME } from "./const";
import { listDevices } from "./device-model";
import {
  DEVICE_STATS,
  OmadaDeviceCardConfig,
  omadaDeviceCardConfigStruct,
} from "./omada-device-card-config";

const DEVICE_LABELS = ["device", "stats", "show_health"];

const computeSchema = memoizeOne(
  (
    hass: HomeAssistant,
    customLocalize: ReturnType<typeof setupCustomlocalize>,
    site: string | undefined
  ): HaFormSchema[] => [
    {
      name: "device",
      selector: {
        select: {
          mode: "dropdown",
          options: listDevices(hass, site).map((d) => ({
            value: d.mac || d.name,
            label: `${d.name} (${d.model || d.type})`,
          })),
        },
      },
    },
    { name: "name", selector: { text: {} } },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "icon", selector: { icon: {} } },
        { name: "icon_color", selector: { ui_color: {} } },
      ],
    },
    ...computeAppearanceFormSchema(customLocalize),
    {
      name: "stats",
      selector: {
        select: {
          mode: "dropdown",
          multiple: true,
          options: DEVICE_STATS.map((key) => ({
            value: key,
            label: customLocalize(`card.net_device.stats.${key}`),
          })),
        },
      },
    },
    { name: "show_health", selector: { boolean: {} } },
    ...computeActionsFormSchema(),
  ]
);

@customElement(OMADA_DEVICE_CARD_EDITOR_NAME)
export class OmadaDeviceCardEditor
  extends MushroomBaseElement
  implements LovelaceCardEditor
{
  @state() private _config?: OmadaDeviceCardConfig;

  connectedCallback() {
    super.connectedCallback();
    void loadHaComponents();
  }

  public setConfig(config: OmadaDeviceCardConfig): void {
    assert(config, omadaDeviceCardConfigStruct);
    this._config = config;
  }

  private _computeLabel = (schema: HaFormSchema) => {
    const customLocalize = setupCustomlocalize(this.hass!);
    if (DEVICE_LABELS.includes(schema.name)) {
      return customLocalize(`editor.card.net_device.${schema.name}`);
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
