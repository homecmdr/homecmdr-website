+++
title = "Elgato Lights"
description = "HomeCmdr adapter for Elgato Key Light and Light Strip devices: installation, config, capabilities, and command support."
weight = 1
template = "page.html"
+++

The `adapter-elgato-lights` adapter polls the Elgato Light HTTP API and exposes one HomeCmdr `Light` device per Elgato light index.

## Installation

```bash
# From your homecmdr-api workspace root
homecmdr pull adapter-elgato-lights
cargo build
```

Then add to `crates/adapters/src/lib.rs`:

```rust
use adapter_elgato_lights as _;
```

## Configuration

```toml
[adapters.elgato_lights]
enabled = true
base_url = "http://127.0.0.1:9123"
poll_interval_secs = 30
```

| Field | Description |
|---|---|
| `enabled` | Enable or disable the adapter |
| `base_url` | HTTP base URL of the Elgato Light API |
| `poll_interval_secs` | How often to poll for state (minimum 1) |

## Device IDs

Devices are indexed from `0`:

- `elgato_lights:light:0`
- `elgato_lights:light:1`

All devices are `DeviceKind::Light`.

## Capabilities

| Capability | Read | Write | Notes |
|---|---|---|---|
| `power` | yes | yes | `on`, `off`, `toggle` |
| `state` | yes | — | `online` / `offline` |
| `brightness` | yes | yes | `set` (percentage 0–100) |
| `color_temperature` | yes | yes | `set` (kelvin, 2900–7000) |

`color_temperature` is normalized to canonical kelvin values. The vendor-supported range is `2900..=7000` — values outside this range are rejected at the adapter level even though the canonical schema accepts a broader range.

## Commands

```bash
# Turn on
curl -X POST http://127.0.0.1:3000/devices/elgato_lights:light:0/command \
  -H 'Content-Type: application/json' \
  -d '{"capability":"power","action":"on"}'

# Set brightness to 75%
curl -X POST http://127.0.0.1:3000/devices/elgato_lights:light:0/command \
  -H 'Content-Type: application/json' \
  -d '{"capability":"brightness","action":"set","value":75}'

# Set color temperature
curl -X POST http://127.0.0.1:3000/devices/elgato_lights:light:0/command \
  -H 'Content-Type: application/json' \
  -d '{"capability":"color_temperature","action":"set","value":{"value":4000,"unit":"kelvin"}}'
```

## Lua Example

```lua
-- Turn on a specific light at 60% brightness
ctx:command("elgato_lights:light:0", {
  capability = "power",
  action = "on",
})

ctx:command("elgato_lights:light:0", {
  capability = "brightness",
  action = "set",
  value = 60,
})
```

## Implementation Notes

- Stale upstream lights are removed from the registry.
- `light_index` is stored in `metadata.vendor_specific`.
- Room assignment is preserved across refreshes.
- Post-command state is confirmed before the registry is updated.
