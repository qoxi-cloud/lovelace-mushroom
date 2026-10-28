# ONU card (qoxi)

A card for XGS-PON / GPON ONU sticks running the 8311 firmware, read through the
[8311 ONU Monitor](https://github.com/pentafive/8311-ha-bridge) Home Assistant
integration. The card discovers every `sensor.<prefix><serial>_*` entity itself,
so a new stick shows up in the editor as soon as the integration creates it.

## Configuration variables

| Name                | Type    | Default                                    | Description                                                                        |
| :------------------ | :------ | :----------------------------------------- | :--------------------------------------------------------------------------------- |
| `serial`            | string  | first discovered ONU                       | ONU serial as it appears in the entity id (e.g. `sc26220140007`)                   |
| `prefix`            | string  | `8311_onu_`                                | Entity id prefix used by the integration                                           |
| `name`              | string  | friendly name of the PON Link sensor       | Custom name                                                                        |
| `icon`              | string  | `mdi:lan-connect`                          | Custom icon                                                                        |
| `icon_color`        | string  | `green` online / disabled offline          | Custom icon color                                                                  |
| `stats`             | list    | `[rx_power, tx_power, down_rate, up_rate]` | Tiles under the header, `[]` hides the row. See values below                       |
| `layout`            | string  | Optional                                   | Layout of the card. Vertical, horizontal and default layout are supported          |
| `fill_container`    | boolean | `false`                                    | Fill container or not                                                              |
| `primary_info`      | string  | `name`                                     | `name` `state` `last-changed` `last-updated` `none` (state of the PON Link sensor) |
| `secondary_info`    | string  | `state`                                    | Same values; `state` renders `Online · O5 Operation`                               |
| `icon_type`         | string  | `icon`                                     | `icon` `none`                                                                      |
| `tap_action`        | action  | `more-info`                                | Opens more-info of the PON Link sensor                                             |
| `hold_action`       | action  | `more-info`                                |                                                                                    |
| `double_tap_action` | action  | `more-info`                                |                                                                                    |

### `stats` values

`rx_power` `tx_power` `down_rate` `up_rate` `down_total` `up_total` `optic_temp`
`cpu_temp` `voltage` `tx_bias` `uptime` `time_in_state` `fec_corrected`
`fec_uncorrected` `bip_errors` `lods_events` `memory` `load_1m` `ethernet_speed`

`down_rate` / `up_rate` are derived from the GEM byte counters between two
updates of the integration (bit/s). Tiles turn orange/red on weak RX power
(≤ -24 / ≤ -27 dBm), hot optics, uncorrectable FEC, BIP or LoDS events.

## Example

```yaml
type: custom:mushroom-onu-card
serial: sc26220140007
stats:
  - rx_power
  - tx_power
  - down_rate
  - up_rate
```
