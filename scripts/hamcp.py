#!/usr/bin/env python3
"""Minimal MCP streamable-HTTP client for HA-MCP. Usage: hamcp.py <tool> '<json-args>'  |  hamcp.py --list"""
import json, sys, urllib.request, itertools
import os
URL = os.environ.get("HA_MCP_URL") or sys.exit("set HA_MCP_URL=http://<ha>:8123/api/webhook/mcp_<id> (HA-MCP webhook)")
_id = itertools.count(1)
def rpc(method, params=None):
    body = json.dumps({"jsonrpc": "2.0", "id": next(_id), "method": method, "params": params or {}}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode()
    out = None
    for line in raw.splitlines():
        if line.startswith("data:"):
            out = json.loads(line[5:].strip())
    if out is None:
        try: out = json.loads(raw)
        except Exception: out = {"raw": raw}
    return out
rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "claude-curl", "version": "1"}})
if sys.argv[1] == "--list":
    res = rpc("tools/list")
    for t in res.get("result", {}).get("tools", []):
        print(f"- {t['name']}: {t.get('description','')[:140].replace(chr(10),' ')}")
    sys.exit()
res = rpc("tools/call", {"name": sys.argv[1], "arguments": json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}})
r = res.get("result", res)
for c in r.get("content", []):
    if c.get("type") == "text": print(c["text"])
    else: print(json.dumps(c)[:2000])
if r.get("isError"): print("ISERROR", file=sys.stderr)
