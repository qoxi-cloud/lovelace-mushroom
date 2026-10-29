# Ops runbook (qoxi network stack)

What runs where, and how to change it without losing anything.

## Pieces

| piece | where | how it gets to Home Assistant |
| --- | --- | --- |
| Cards + sheet + theme (this repo) | `qoxi-cloud/lovelace-mushroom`, branch `qoxi` | HACS custom repository (type Dashboard, "Mushroom (qoxi)"), resource `/hacsfiles/lovelace-mushroom/mushroom.js` |
| Bridge Omada → MQTT (`net_*`) + its add-on | `qoxi-cloud/omada_exporter`, branch `qoxi`, add-on in `addon/omadabridge` | Supervisor add-on repository `https://github.com/qoxi-cloud/omada_exporter`, add-on "OmadaBridge" |
| ONU sticks | HACS integration `pentafive/8311-ha-bridge` (not ours) | entities `sensor.8311_onu_<serial>_*`, matched by the ONU contract |
| Theme | `themes/qoxi-ios.yaml` here | copied to HA `themes/qoxi-ios.yaml`, then `frontend.reload_themes` |
| Network dashboard | `docs/dashboards/apple-network.json` here (copy of the live config) | HA dashboard `dashboard-apple`, view `network`; header hidden by HACS `kiosk-mode` (`kiosk_mode.hide_header`), `?disable_km` shows it again |

Contracts the cards rely on: `docs/contract.md` (`net_*` for the bridge, `onu_*` / `8311_onu_` for ONUs). No vendor prefixes anywhere else.

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
