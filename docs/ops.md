# Ops runbook (qoxi network stack)

What runs where, and how to change it without losing anything.

## Pieces

| piece | where | how it gets to Home Assistant |
| --- | --- | --- |
| Cards + sheet + theme (this repo) | `qoxi-cloud/lovelace-mushroom`, branch `qoxi` | HACS custom repository (type Dashboard, "Mushroom (qoxi)"), resource `/hacsfiles/lovelace-mushroom/mushroom.js` |
| Bridge Omada → MQTT (`net_*`) + its add-on | `qoxi-cloud/omada_exporter`, branch `qoxi`, add-on in `addon/omadabridge` | Supervisor add-on repository `https://github.com/qoxi-cloud/omada_exporter`, add-on "OmadaBridge" |
| ONU sticks | HACS integration `pentafive/8311-ha-bridge` (not ours) | entities `sensor.8311_onu_<serial>_*`, matched by the ONU contract |
| ISP throughput | HACS integration `tomaae/homeassistant-mikrotik_router` (not ours), entry "CRS305" → 172.21.0.1:8728, read-only user `ha` (allowed from 172.21.0.254, the address HA is seen with behind the ER8411 WAN1) | Omada reports 0 for virtual-WAN rates, so the ISP cards take throughput from sensors **found by name**: `<ISP> download` / `<ISP> upload`, ISP = first word of the Omada WAN name (`Kopiyka_sfp3` → `Kopiyka`). Today those are `sensor.crs305_sfp_sfpplus<N>_rx/_tx` renamed in the registry (sfp2 LinkCom, sfp3 Kopiyka, sfp4 Astra; sfp1 = trunk, rate kept, totals disabled), units Mbit/s and GB. No entity ids live in any dashboard. Options: 15 s poll, port traffic only; everything else off (environment sensors need script rights). Junk port switches/ether1/lo/vlan999, the zero `er8411_wan_rx/tx_rate` and `er8411_isp_download/upload_speed` sensors are disabled in the registry. Swap procedure below |
| Theme | `themes/qoxi-ios.yaml` here | copied to HA `themes/qoxi-ios.yaml`, then `frontend.reload_themes` |
| Network dashboard | `docs/dashboards/apple-network.json` here (copy of the live config) | HA dashboard `dashboard-apple`, view `network`; header hidden by HACS `kiosk-mode` (`kiosk_mode.hide_header`), `?disable_km` shows it again |

Contracts the cards rely on: `docs/contract.md` (`net_*` for the bridge, `onu_*` / `8311_onu_` for ONUs). No vendor prefixes anywhere else.

## Replacing the switch that measures ISP throughput

Dashboards need no change; the cards look the sensors up by name.

1. **New device**: a read-only API user for HA. RouterOS: `/user add name=ha group=read address=172.21.0.254/32 password=…` (HA arrives SNATed as the ER8411 WAN1 address, not as 172.21.9.2) and `/ip service enable api` (8728). Not MikroTik: any per-port rate source works (HA SNMP, an Omada switch, ESPHome…) as long as the sensors are in bit/s or B/s.
2. **HA**: add the integration for the new device (MikroTik: the same Mikrotik Router from HACS, options as above: 15 s, port traffic only, environment OFF or a read-only user fails). Delete the old "CRS305" entry; its entities go with it.
3. **Names**: rename the six ISP-port rate sensors to `LinkCom download` / `LinkCom upload`, `Kopiyka …`, `Astra …` (Settings → Entities, or `ha_set_entity` name=…), unit Mbit/s. The cards pick them up within 30 s, no page reload. Disable what you don't need (port switches, totals of the trunk…).
4. **Optional, unbroken history**: new sensors get new entity ids, so the graphs restart. Before step 3 set the new sensors' entity ids to the old ones (`sensor.crs305_sfp_sfpplus2_rx` …); once the old entry is deleted the ids are free.
5. If the ISP names in Omada change instead (new provider), the sensor names follow the first word of the new WAN name; nothing else.

## Release the cards

```
scripts/release.sh 5.2.3-qoxi.<n>
```

bumps `package.json`, builds, tags `v<version>`, creates the GitHub release with `dist/mushroom.js` (HACS needs exactly that asset name, see `hacs.json`), and, when `HA_MCP_URL` is set, tells HACS to update. Without it: HACS → Mushroom (qoxi) → Update, then hard-refresh.

The upstream GitHub Action `release.yaml` only produces drafts; leave it or fix it with a token that has the `workflow` scope.

## Release the bridge / add-on

1. change code under `bridge/`, run tests: `docker run --rm -v "$PWD":/src -w /src golang:1.27-alpine sh -c "go test ./..."` (in `bridge/`)
2. bump `version` in `addon/omadabridge/config.yaml`, add a line to `addon/omadabridge/CHANGELOG.md`
3. `git commit && git tag v<version> && git push origin qoxi v<version>` — the add-on Dockerfile clones the repo at tag `v<version>`
4. HA: Settings → Add-ons → store ⋮ → Check for updates → OmadaBridge → Update (or via HA-MCP: `supervisor/api POST /store/reload`, then `ha_manage_app action=update slug=dd13aab4_omadabridge`)

Add-on options hold the Omada local user + Open API client; HA-MCP returns them redacted, so copy them from the HA UI if the add-on ever has to be re-installed. MQTT host/user/pass left empty = Supervisor-provided Mosquitto.

## Theme

Edit `themes/qoxi-ios.yaml` (three themes: `qoxi iOS` = default, `qoxi iOS Gradient`, `qoxi iOS Graphite`; keys must not repeat inside a block, HA logs a warning), upload to HA `themes/qoxi-ios.yaml`, call `frontend.reload_themes`.

## Dashboard

Edit in the HA UI (`…/dashboard-apple/network?disable_km` to get the ⋮ menu back) and copy the raw config into `docs/dashboards/apple-network.json`, or push `docs/dashboards/apple-network.json` with `ha_config_set_dashboard url_path=dashboard-apple`. New switches/APs/clients appear by themselves; ONU cards are listed per serial.

## Helper

`scripts/hamcp.py <tool> '<json>'` talks to HA-MCP over its webhook (`HA_MCP_URL`), meta-tools `ha_call_read_tool` / `ha_call_write_tool` / `ha_call_delete_tool` with `{"name":…, "arguments":…}`. Quirks: `ha_write_file` needs `overwrite:true`; `ha_delete_file` needs `confirm:true`; `ha_config_set_dashboard` needs the hourly `BestPracticeKey` (from `ha_get_skill_guide file=references/helper-selection.md`) plus `MandatoryBPS:false`.
