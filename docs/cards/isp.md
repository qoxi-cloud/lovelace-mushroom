# ISP card (qoxi)

One card per ISP / WAN link of an Omada gateway, read from the MQTT entities
published by [OmadaBridge](https://github.com/qoxi-cloud/omadabridge-addon)
(`sensor.<gateway>_wan_*_port_<port>_<slug>`). Virtual WANs (VLAN sub-interfaces
on a trunk port) are supported. Everything Omada exposes for a WAN fits on the
card, so there is no detail sheet; tap opens more-info of the WAN status sensor.
Note that Omada reports no RX/TX rates for virtual WANs (always 0), so the card
takes throughput from sensors measured elsewhere, e.g. the ISP-facing port of
the aggregation switch (Mikrotik Router integration, SNMP, anything in bit/s or
B/s). **Discovery is by name, not by entity id**: name the two sensors
`<ISP> download` and `<ISP> upload`, where `<ISP>` is the first word of the WAN
name in Omada (`Kopiyka_sfp3` → `Kopiyka`; case-insensitive, a device-name
prefix like `CRS305 Kopiyka download` is fine). Swap the measuring device, name
the new sensors the same way, and no dashboard changes. `rx_entity` /
`tx_entity` override the lookup. They feed the ↓/↑ in the header and the
`rx_rate` / `tx_rate` tiles, which open the sensor's history.

## Configuration variables

| Name                                                                  | Type   | Default                               | Description                                                                                                                                         |
| :-------------------------------------------------------------------- | :----- | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wan`                                                                 | string | first discovered link                 | `slug` (e.g. `linkcom_sfp2`), WAN port number, `gateway:port` or the name                                                                           |
| `name`                                                                | string | WAN description                       | Custom name                                                                                                                                         |
| `icon`                                                                | string | `mdi:web`                             | Custom icon                                                                                                                                         |
| `icon_color`                                                          | string | green / orange / red by state         | Custom icon color                                                                                                                                   |
| `stats`                                                               | list   | `[latency, link_speed, port, proto]`  | Tiles under the header; `[]` hides the row. See values below. |
| `rx_entity` / `tx_entity`                                             | string | `<ISP> download` / `<ISP> upload` by name, else gateway `wan_rx_rate` / `wan_tx_rate` | Throughput sensors in bit/s or B/s (unit attribute honoured); set only to override the name lookup |
| `show_traffic`                                                        | bool   | on when rates exist                   | Live `↓ … ↑ …` at the right end of the header; tap opens the rx history                                                                             |
| `layout` `fill_container` `primary_info` `secondary_info` `icon_type` |        |                                       | Same as the other Mushroom cards (state = `Online · <ip>`)                                                                                          |
| `tap_action`                                                          | action | ISP detail sheet                      | Any configured action overrides the sheet                                                                                                           |
| `hold_action`                                                         | action | `more-info`                           | more-info of the WAN status sensor                                                                                                                  |

### `stats` values

`latency` `link_speed` `port` `proto` `ip` `isp_enabled` `max_bandwidth` `rx_rate` `tx_rate`

Latency turns orange at ≥ 40 ms and red at ≥ 100 ms.

## Example

```yaml
# sensors named "Kopiyka download" / "Kopiyka upload" are picked up automatically
type: custom:mushroom-isp-card
wan: kopiyka_sfp3
stats: [latency, rx_rate, tx_rate, link_speed]
```
