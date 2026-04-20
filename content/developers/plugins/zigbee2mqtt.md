+++
title = "Zigbee2MQTT"
description = "HomeCmdr adapter for Zigbee2MQTT: MQTT-backed Zigbee device integration for bulbs and smart plugs."
weight = 4
template = "page.html"
+++

The `adapter-zigbee2mqtt` adapter connects HomeCmdr to [Zigbee2MQTT](https://www.zigbee2mqtt.io/) over MQTT. It subscribes to device state topics and publishes commands back to the bridge.

## Installation

```bash
# From your homecmdr-api workspace root
homecmdr pull adapter-zigbee2mqtt
cargo build
```

Then add to `crates/adapters/src/lib.rs`:

```rust
use adapter_zigbee2mqtt as _;
```

## Configuration

```toml
[adapters.zigbee2mqtt]
enabled = true
server = "mqtt://127.0.0.1:1883"
base_topic = "zigbee2mqtt"
client_id = "homecmdr-zigbee2mqtt"
keepalive_secs = 30
command_timeout_secs = 5
```

Optional credentials:

```toml
username = "mqtt-user"
password = "mqtt-password"
```

| Field | Description |
|---|---|
| `enabled` | Enable or disable the adapter |
| `server` | MQTT broker URL |
| `base_topic` | Zigbee2MQTT base topic (default `zigbee2mqtt`) |
| `client_id` | MQTT client identifier |
| `keepalive_secs` | MQTT keepalive interval |
| `command_timeout_secs` | Timeout waiting for command acknowledgment |
| `username` | Optional MQTT username |
| `password` | Optional MQTT password |

## Device IDs

Device IDs use the Zigbee2MQTT friendly name:

- `zigbee2mqtt:bedside_left`
- `zigbee2mqtt:kitchen_plug`

## Supported Device Classes

### Bulbs

Supported state fields: `state`, `brightness`, `color`, `color_mode`, `color_temp`.

Supported commands:

| Capability | Actions |
|---|---|
| `power` | `on`, `off`, `toggle` |
| `brightness` | `set` |
| `color_xy` | `set` |
| `color_temperature` | `set` |

### Smart Plugs

Supported state fields: `state`, `power`, `energy`, `energy_today`, `energy_yesterday`, `energy_month`, `voltage`, `current`.

Supported commands:

| Capability | Actions |
|---|---|
| `power` | `on`, `off`, `toggle` |

## Lua Examples

```lua
-- Turn off all bedroom lamps (assuming a group exists)
ctx:command_group("bedroom_lamps", {
  capability = "power",
  action = "off",
})

-- Set a specific bulb brightness
ctx:command("zigbee2mqtt:bedside_left", {
  capability = "brightness",
  action = "set",
  value = 40,
})

-- Read current power draw from a smart plug
local plug = ctx:get_device("zigbee2mqtt:kitchen_plug")
if plug then
  ctx:log("info", "kitchen plug power", { watts = plug.attributes.power })
end
```

## Notes

> This adapter is at V1 scope. Additional Zigbee device classes, device discovery details, and MQTT topic structure documentation will be expanded in a future release.
