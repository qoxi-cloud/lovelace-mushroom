# Omada devices card (qoxi)

Auto list: one [Omada device card](omada-device.md) per device the controller
knows (gateway, switches, access points, controller), with type chips. New
devices adopted in Omada appear here without touching the dashboard.

## Configuration variables

| Name                                                                  | Type    | Default                             | Description                                                     |
| :-------------------------------------------------------------------- | :------ | :---------------------------------- | :-------------------------------------------------------------- |
| `name`                                                                | string  | `Devices`                           | Header title                                                    |
| `site`                                                                | string  | all sites                           | Restrict to one Omada site                                      |
| `types`                                                               | list    | `[gateway, switch, ap, controller]` | Device types to include                                         |
| `exclude`                                                             | list    | `[]`                                | Device names or MACs to hide                                    |
| `stats`                                                               | list    | device card default                 | Tiles under each device header (same values as the device card) |
| `sort`                                                                | string  | `type`                              | `type` `name` `status` (offline first)                          |
| `show_header`                                                         | boolean | `true`                              | Title + online count                                            |
| `show_filters`                                                        | boolean | `true`                              | Type chips (shown when ≥ 2 types present)                       |
| `layout` `fill_container` `primary_info` `secondary_info` `icon_type` |         |                                     | Passed to every device card                                     |

## Example

```yaml
type: custom:mushroom-omada-devices-card
types: [switch, ap]
stats: [cpu, mem, clients, ports_up]
exclude: [Omada Controller 220]
```
