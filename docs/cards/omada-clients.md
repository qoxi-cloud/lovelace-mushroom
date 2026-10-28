# Omada clients card (qoxi)

A list of the clients known to the Omada controller (OmadaBridge MQTT
entities): wired and wireless, with filter chips, current rate and Wi-Fi signal
bars. Tap a row for the client sheet (identity, connection, signal, traffic).

## Configuration variables

| Name                                  | Type    | Default       | Description                                                       |
| :------------------------------------ | :------ | :------------ | :---------------------------------------------------------------- |
| `name`                                | string  | `Clients`     | Card title                                                        |
| `icon`                                | string  | `mdi:devices` | Icon                                                              |
| `icon_color`                          | string  | `blue`        | Icon color                                                        |
| `site`                                | string  | all sites     | Restrict to one Omada site                                        |
| `device`                              | string  | all           | Only clients attached to this AP / switch / gateway (name or MAC) |
| `filter`                              | string  | `all`         | `all` `wired` `wireless` (initial filter)                         |
| `show_filters`                        | boolean | `true`        | Show the All / Wired / Wireless chips                             |
| `sort`                                | string  | `rate`        | `rate` `name` `ip`                                                |
| `limit`                               | number  | `20`          | Max rows, `0` = all; the rest is summarised as "and N more"       |
| `layout` `fill_container` `icon_type` |         |               | Same as the other Mushroom cards                                  |

The card is content-sized (`rows: auto` in sections view). Signal bars turn
orange below 65 % and red below 40 %.

## Example

```yaml
type: custom:mushroom-omada-clients-card
device: AP-2
show_filters: false
limit: 0
```
