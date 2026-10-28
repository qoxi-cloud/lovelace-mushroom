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
import { DEVICE_STATS } from "../omada-device-card/omada-device-card-config";
import { OMADA_DEVICES_CARD_EDITOR_NAME } from "./const";
import {
  DEVICE_SORTS,
  DEVICE_TYPES,
  OmadaDevicesCardConfig,
  omadaDevicesCardConfigStruct,
} from "./omada-devices-card-config";

const LABELS = [
  "types",
  "exclude",
  "stats",
  "show_filters",
  "show_header",
  "sort",
];

const computeSchema = memoizeOne(
  (
    hass: HomeAssistant,
    customLocalize: ReturnType<typeof setupCustomlocalize>,
    site: string | undefined
  ): HaFormSchema[] => [
    { name: "name", selector: { text: {} } },
    {
      name: "types",
      selector: {
        select: {
          mode: "list",
          multiple: true,
          options: DEVICE_TYPES.map((type) => ({
            value: type,
            label: customLocalize(`card.net_devices.${type}`),
          })),
        },
      },
    },
    {
      name: "exclude",
      selector: {
        select: {
          mode: "dropdown",
          multiple: true,
          custom_value: true,
          options: listDevices(hass, site).map((d) => ({
            value: d.name,
            label: `${d.name} (${d.model || d.type})`,
          })),
        },
      },
    },
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
    {
      type: "grid",
      name: "",
      schema: [
        {
          name: "sort",
          selector: {
            select: {
              mode: "dropdown",
              options: DEVICE_SORTS.map((s) => ({
                value: s,
                label: customLocalize(`editor.card.net_devices.sort_${s}`),
              })),
            },
          },
        },
        { name: "show_filters", selector: { boolean: {} } },
        { name: "show_header", selector: { boolean: {} } },
      ],
    },
    ...computeAppearanceFormSchema(customLocalize),
  ]
);

@customElement(OMADA_DEVICES_CARD_EDITOR_NAME)
export class OmadaDevicesCardEditor
  extends MushroomBaseElement
  implements LovelaceCardEditor
{
  @state() private _config?: OmadaDevicesCardConfig;

  connectedCallback() {
    super.connectedCallback();
    void loadHaComponents();
  }

  public setConfig(config: OmadaDevicesCardConfig): void {
    assert(config, omadaDevicesCardConfigStruct);
    this._config = config;
  }

  private _computeLabel = (schema: HaFormSchema) => {
    const customLocalize = setupCustomlocalize(this.hass!);
    if (LABELS.includes(schema.name)) {
      return customLocalize(`editor.card.net_devices.${schema.name}`);
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
