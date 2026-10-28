# Omada device card (qoxi)

One card per Omada device (gateway, switch, access point, controller) built on
the OmadaBridge MQTT entities. The card reuses the dashboard model of
`omada-network-card`, so ports, radios and connected clients are already linked
to the device.

Tap opens a detail sheet: hero tiles (CPU, RAM, clients, uptime, RX/TX, temp,
PoE budget, ports up), a _Device_ table (status, model, IP, MAC, firmware,
upgrade, totals), _Radios_ for APs (per-band RX/TX utilisation, interference,
uplink packet counters), _Ports_ for switches/gateways (speed, PoE watts, the
client behind the port) and _Clients_ (IP and current rate).

## Configuration variables

| Name                                                                  | Type   | Default                          | Description                                                          |
| :-------------------------------------------------------------------- | :----- | :------------------------------- | :------------------------------------------------------------------- |
| `device`                                                              | string | first device                     | Device MAC (any format) or device name as shown in Omada             |
| `site`                                                                | string | all sites                        | Restrict discovery to one Omada site                                 |
| `name`                                                                | string | device name                      | Custom name                                                          |
| `icon`                                                                | string | by type                          | `mdi:router-network` / `mdi:lan` / `mdi:access-point` / `mdi:server` |
| `icon_color`                                                          | string | `blue` online / disabled offline | Custom icon color                                                    |
| `stats`                                                               | list   | `[cpu, mem, clients, uptime]`    | Tiles under the header; `[]` hides the row                           |
| `layout` `fill_container` `primary_info` `secondary_info` `icon_type` |        |                                  | Same as the other Mushroom cards (state = `Connected · <ip>`)        |
| `tap_action`                                                          | action | detail sheet                     | Any configured action overrides the sheet                            |
| `hold_action`                                                         | action | `more-info`                      | more-info of the device uptime sensor                                |

### `stats` values

`cpu` `mem` `clients` `uptime` `rx_rate` `tx_rate` `ports_up` `temp` `poe_remain`
`util_2g` `util_5g` `download` `upload` `model` `firmware`

CPU/RAM tiles turn orange at ≥ 75 % and red at ≥ 90 %. A firmware upgrade shows
as an orange badge on the icon, an offline device as a red one.

## Example

```yaml
type: custom:mushroom-omada-device-card
device: SG3218XP
stats: [cpu, mem, clients, ports_up, poe_remain]
```
