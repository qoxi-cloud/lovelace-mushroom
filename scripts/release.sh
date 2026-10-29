#!/usr/bin/env bash
# Release the qoxi Mushroom fork to HACS.
#   scripts/release.sh 5.2.3-qoxi.3
# Needs: gh (logged in), HA_MCP_URL for the optional HACS update step.
set -euo pipefail
v="${1:?version, e.g. 5.2.3-qoxi.3}"
cd "$(dirname "$0")/.."
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$v\"/" package.json
npm run build
git add package.json
git commit -m "$v" || true
git tag "v$v"
git push origin HEAD "v$v"
# gh resolves a fork to its upstream by default, so name our repo explicitly
repo="$(git remote get-url origin | sed -E 's#.*github.com[:/]##; s#\.git$##')"
gh release create "v$v" dist/mushroom.js -R "$repo" --title "$v" --notes "qoxi fork release $v (asset: mushroom.js)"
if [ -n "${HA_MCP_URL:-}" ]; then
  python3 scripts/hamcp.py ha_call_write_tool '{"name":"ha_manage_hacs","arguments":{"action":"update_information","repository_id":"1437330511"}}' >/dev/null
  python3 scripts/hamcp.py ha_call_write_tool '{"name":"ha_manage_hacs","arguments":{"action":"download","repository_id":"1437330511"}}'
  echo "HACS updated; hard-refresh the dashboard."
else
  echo "Now: HACS → Mushroom (qoxi) → Update."
fi
