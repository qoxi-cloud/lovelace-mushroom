# Camera overlay card (qoxi)

Wraps another camera card (made for `custom:scrypted-nvr-camera`) and draws on
top of it the camera name (top left) and how the camera is attached to the
network (bottom right): an Ethernet icon for a wired client, Wi-Fi bars from
`net_client_signal_pct` for a wireless one (orange < 65 %, red < 40 %), a red
disconnect icon when the client's tracker is away. No badge when there is no
tracker for the client or it is unavailable. The overlay ignores pointer
events, so taps reach the wrapped card unchanged. The client comes from the
network bridge entities (see [docs/contract.md](../contract.md)).

## Configuration variables

| Name     | Type   | Default  | Description                                     |
| :------- | :----- | :------- | :---------------------------------------------- |
| `card`   | object | required | The wrapped card config                         |
| `name`   | string | —        | Label in the top left corner                    |
| `client` | string | —        | Network client: MAC (any separator), IP or name |
| `site`   | string | —        | Site filter when several sites are bridged      |

```yaml
type: custom:mushroom-camera-overlay-card
name: Hallway
client: AC-B9-2F-6C-99-88
card:
  type: custom:scrypted-nvr-camera
  id: 31
  live: true
  imageClick: popup
  videoClick: popup
```
