# ISP card (qoxi)

One card per ISP / WAN link of an Omada gateway, read from the MQTT entities
published by [OmadaBridge](https://github.com/qoxi-cloud/omadabridge-addon)
(`sensor.<gateway>_wan_*_port_<port>_<slug>`). Virtual WANs (VLAN sub-interfaces
on a trunk port) are supported. Everything Omada exposes for a WAN fits on the
card, so there is no detail sheet; tap opens more-info of the WAN status sensor.
Note that Omada reports no RX/TX rates for virtual WANs (always 0): point
`rx_entity` / `tx_entity` at throughput sensors measured elsewhere, e.g. the
ISP-facing port of the aggregation switch (`sensor.crs305_sfp_sfpplus2_rx` from
the Mikrotik Router integration). They feed the ↓/↑ in the header and the
`rx_rate` / `tx_rate` tiles, which open the sensor's history.

## Configuration variables

| Name                                                                  | Type   | Default                               | Description                                                                                                                                         |
| :-------------------------------------------------------------------- | :----- | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wan`                                                                 | string | first discovered link                 | `slug` (e.g. `linkcom_sfp2`), WAN port number, `gateway:port` or the name                                                                           |
| `name`                                                                | string | WAN description                       | Custom name                                                                                                                                         |
| `icon`                                                                | string | `mdi:web`                             | Custom icon                                                                                                                                         |
| `icon_color`                                                          | string | green / orange / red by state         | Custom icon color                                                                                                                                   |
| `stats`                                                               | list   | `[latency, link_speed, port, proto]`  | Tiles under the header; `[]` hides the row. See values below. With `rx_entity`/`tx_entity` the default is `[latency, rx_rate, tx_rate, link_speed]` |
| `rx_entity` / `tx_entity`                                             | string | gateway `wan_rx_rate` / `wan_tx_rate` | Throughput sensors in bit/s or B/s (unit attribute honoured)                                                                                        |
| `show_traffic`                                                        | bool   | on when rates exist                   | Live `↓ … ↑ …` at the right end of the header; tap opens the rx history                                                                             |
| `layout` `fill_container` `primary_info` `secondary_info` `icon_type` |        |                                       | Same as the other Mushroom cards (state = `Online · <ip>`)                                                                                          |
| `tap_action`                                                          | action | ISP detail sheet                      | Any configured action overrides the sheet                                                                                                           |
| `hold_action`                                                         | action | `more-info`                           | more-info of the WAN status sensor                                                                                                                  |

### `stats` values

`latency` `link_speed` `port` `proto` `ip` `isp_enabled` `max_bandwidth` `rx_rate` `tx_rate`

Latency turns orange at ≥ 40 ms and red at ≥ 100 ms.

## Example

```yaml
type: custom:mushroom-isp-card
wan: kopiyka_sfp3
rx_entity: sensor.crs305_sfp_sfpplus3_rx
tx_entity: sensor.crs305_sfp_sfpplus3_tx
stats: [latency, rx_rate, tx_rate, link_speed]
```
