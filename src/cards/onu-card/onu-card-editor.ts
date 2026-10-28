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
import { ONU_CARD_EDITOR_NAME } from "./const";
import {
  ONU_STATS,
  OnuCardConfig,
  onuCardConfigStruct,
} from "./onu-card-config";
import { collectOnuDevices } from "./onu-model";

const ONU_LABELS = ["serial", "stats", "show_pon_mode"];

const computeSchema = memoizeOne(
  (
    hass: HomeAssistant,
    customLocalize: ReturnType<typeof setupCustomlocalize>,
    prefix: string | undefined
  ): HaFormSchema[] => [
    {
      name: "serial",
      selector: {
        select: {
          mode: "dropdown",
          options: collectOnuDevices(hass, prefix).map((onu) => ({
            value: onu.serial,
            label: `${onu.name} (${onu.serial.toUpperCase()})`,
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
    { name: "show_pon_mode", selector: { boolean: {} } },
    {
      name: "stats",
      selector: {
        select: {
          mode: "dropdown",
          multiple: true,
          options: ONU_STATS.map((key) => ({
            value: key,
            label: customLocalize(`card.onu.stats.${key}`),
          })),
        },
      },
    },
    ...computeActionsFormSchema(),
  ]
);

@customElement(ONU_CARD_EDITOR_NAME)
export class OnuCardEditor
  extends MushroomBaseElement
  implements LovelaceCardEditor
{
  @state() private _config?: OnuCardConfig;

  connectedCallback() {
    super.connectedCallback();
    void loadHaComponents();
  }

  public setConfig(config: OnuCardConfig): void {
    assert(config, onuCardConfigStruct);
    this._config = config;
  }

  private _computeLabel = (schema: HaFormSchema) => {
    const customLocalize = setupCustomlocalize(this.hass!);

    if (ONU_LABELS.includes(schema.name)) {
      return customLocalize(`editor.card.onu.${schema.name}`);
    }
    if (GENERIC_LABELS.includes(schema.name)) {
      return customLocalize(`editor.card.generic.${schema.name}`);
    }
    return this.hass!.localize(
      `ui.panel.lovelace.editor.card.generic.${schema.name}`
    );
  };

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    const customLocalize = setupCustomlocalize(this.hass);
    const schema = computeSchema(
      this.hass,
      customLocalize,
      this._config.prefix
    );

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
