+++
title = "Roku TV"
description = "HomeCmdr adapter for Roku TVs: power control over the Roku ECP HTTP API."
weight = 3
template = "page.html"
+++

The `adapter-roku-tv` adapter exposes one Roku TV as a single `Switch` device and supports power control via the [Roku ECP](https://developer.roku.com/docs/developer-program/debugging/external-control-api.md) HTTP API on port `8060`.

## Installation

```bash
# From your homecmdr-api workspace root
homecmdr pull adapter-roku-tv
cargo build
```

Then add to `crates/adapters/src/lib.rs`:

```rust
use adapter_roku_tv as _;
```

## Configuration

```toml
[adapters.roku_tv]
enabled = true
ip_address = "192.168.1.114"
poll_interval_secs = 30
```

| Field | Description |
|---|---|
| `enabled` | Enable or disable the adapter |
| `ip_address` | LAN IP address of the Roku device |
| `poll_interval_secs` | How often to poll for state (minimum 1) |

## Device ID

The adapter exposes one stable device:

- `roku_tv:tv`

Device kind: `DeviceKind::Switch`.

## Capabilities

| Capability | Read | Write | Notes |
|---|---|---|---|
| `power` | yes | yes | `on`, `off`, `toggle` |
| `state` | yes | — | `online` / `offline` |

Vendor metadata (`power_mode`, `friendly_name`, `model_name`) is stored in `metadata.vendor_specific`.

## Commands

```bash
# Toggle power
curl -X POST http://127.0.0.1:3000/devices/roku_tv:tv/command \
  -H 'Content-Type: application/json' \
  -d '{"capability":"power","action":"toggle"}'

# Turn off
curl -X POST http://127.0.0.1:3000/devices/roku_tv:tv/command \
  -H 'Content-Type: application/json' \
  -d '{"capability":"power","action":"off"}'
```

## Vendor Mapping

| HomeCmdr command | Roku ECP endpoint |
|---|---|
| `power:on` | `POST /keypress/PowerOn` |
| `power:off` | `POST /keypress/PowerOff` |
| `power:toggle` | `POST /keypress/Power` |

Polling uses `GET http://<ip>:8060/query/device-info`.

## Lua Example

```lua
-- Turn off the TV as part of a scene
ctx:command("roku_tv:tv", {
  capability = "power",
  action = "off",
})
```

## Implementation Notes

- The adapter re-reads device info after commands and updates canonical state.
- Room assignment is preserved across refreshes.
- The current implementation uses a static configured IP address. Auto-discovery is not implemented.
