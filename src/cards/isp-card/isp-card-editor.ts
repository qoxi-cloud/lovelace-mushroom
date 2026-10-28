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
import { ISP_CARD_EDITOR_NAME } from "./const";
import {
  ISP_STATS,
  IspCardConfig,
  ispCardConfigStruct,
} from "./isp-card-config";
import { collectWanLinks } from "./isp-model";

const ISP_LABELS = ["wan", "stats"];

const computeSchema = memoizeOne(
  (
    hass: HomeAssistant,
    customLocalize: ReturnType<typeof setupCustomlocalize>,
    onuPrefix: string | undefined
  ): HaFormSchema[] => [
    {
      name: "wan",
      selector: {
        select: {
          mode: "dropdown",
          options: collectWanLinks(hass, onuPrefix).map((link) => ({
            value: link.slug,
            label: `${link.name} (${link.gatewayName} · WAN ${link.port})`,
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
          options: ISP_STATS.map((key) => ({
            value: key,
            label: customLocalize(`card.isp.stats.${key}`),
          })),
        },
      },
    },
    ...computeActionsFormSchema(),
  ]
);

@customElement(ISP_CARD_EDITOR_NAME)
export class IspCardEditor
  extends MushroomBaseElement
  implements LovelaceCardEditor
{
  @state() private _config?: IspCardConfig;

  connectedCallback() {
    super.connectedCallback();
    void loadHaComponents();
  }

  public setConfig(config: IspCardConfig): void {
    assert(config, ispCardConfigStruct);
    this._config = config;
  }

  private _computeLabel = (schema: HaFormSchema) => {
    const customLocalize = setupCustomlocalize(this.hass!);
    if (ISP_LABELS.includes(schema.name)) {
      return customLocalize(`editor.card.isp.${schema.name}`);
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
    const schema = computeSchema(
      this.hass,
      customLocalize,
      this._config.onu_prefix
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
