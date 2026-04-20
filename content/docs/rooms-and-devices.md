+++
title = "Rooms and devices"
description = "How HomeCmdr models devices and rooms, and how to organise your setup using the HTTP API."
weight = 3
template = "page.html"
+++

HomeCmdr maintains an in-memory registry of devices and rooms. Devices come from adapters; rooms are user-defined.

---

## Devices

A device is the atomic unit of state in HomeCmdr. Each device has:

| Field | Description |
|---|---|
| `id` | Stable string like `elgato_lights:light:0` or `roku_tv:tv` |
| `kind` | Device category (e.g. `Light`, `Switch`, `Sensor`) |
| `attributes` | Current state, keyed by capability name |
| `room_id` | Assigned room, or `null` if unassigned |
| `metadata` | Adapter-specific descriptive data |
| `updated_at` | When meaningful state last changed |
| `last_seen` | When the adapter last observed the device |

Device IDs are namespaced by adapter — `{adapter_name}:{vendor_id}`. They are stable across restarts.

### List all devices

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/devices
```

### Get one device

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/devices/roku_tv:tv
```

### Get specific devices by ID

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/devices?ids=open_meteo:temperature_outdoor&ids=open_meteo:wind_speed"
```

---

## Sending commands

Commands use a canonical shape across all adapters:

```json
{
  "capability": "power",
  "action": "on"
}
```

For capabilities with a value:

```json
{
  "capability": "brightness",
  "action": "set",
  "value": 75
}
```

### Send a command to one device

```bash
curl -X POST http://localhost:3001/devices/elgato_lights:light:0/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"capability":"power","action":"toggle"}'
```

### Set brightness

```bash
curl -X POST http://localhost:3001/devices/elgato_lights:light:0/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"capability":"brightness","action":"set","value":80}'
```

### Set colour temperature

```bash
curl -X POST http://localhost:3001/devices/elgato_lights:light:0/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"capability":"color_temperature","action":"set","value":{"value":4000,"unit":"kelvin"}}'
```

See the full [API reference](/developers/api-reference/) for all command shapes and response codes.

---

## Rooms

Rooms are user-defined. Devices start with no room assignment.

### Create a room

```bash
curl -X POST http://localhost:3001/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"living_room","name":"Living Room"}'
```

### List rooms

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/rooms
```

### Get one room

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/rooms/living_room
```

### Get devices in a room

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/rooms/living_room/devices
```

---

## Assigning devices to rooms

Room assignment is independent of adapter refreshes — polling a device does not overwrite its room.

### Assign a device

```bash
curl -X POST http://localhost:3001/devices/roku_tv:tv/room \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"room_id":"living_room"}'
```

### Clear room assignment

```bash
curl -X POST http://localhost:3001/devices/roku_tv:tv/room \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"room_id":null}'
```

---

## Sending commands to a whole room

Fan out one command to every device assigned to a room:

```bash
curl -X POST http://localhost:3001/rooms/living_room/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"capability":"power","action":"off"}'
```

Response includes a per-device result for each device:

```json
[
  { "device_id": "roku_tv:tv", "status": "ok", "message": null },
  { "device_id": "open_meteo:wind_speed", "status": "unsupported", "message": "device commands are not implemented" }
]
```

Devices that do not support the capability return `"unsupported"` — the command still runs on any that do.

---

## Groups

Groups are explicit user-defined device collections. Unlike rooms (which organise by location), groups are useful for functional groupings — all the lights in a lighting rig, all the speakers in a multi-room audio setup, etc.

### Create a group

```bash
curl -X POST http://localhost:3001/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"bedroom_lamps","name":"Bedroom Lamps","members":["zigbee2mqtt:bedside_left","zigbee2mqtt:bedside_right"]}'
```

### Command a whole group

```bash
curl -X POST http://localhost:3001/groups/bedroom_lamps/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"capability":"power","action":"off"}'
```

Groups can also be targeted from Lua scenes and automations using `ctx:command_group(group_id, command_table)`.

---

## Live event stream

Connect to the WebSocket endpoint to receive device state changes in real time:

```bash
wscat -c "ws://localhost:3001/events?token=$TOKEN"
```

Example events:

```json
{ "type": "device.state_changed", "id": "roku_tv:tv", "state": { "power": "off" } }
{ "type": "device.room_changed", "id": "elgato_lights:light:0", "room_id": "office" }
{ "type": "adapter.started", "adapter": "zigbee2mqtt" }
```

---

## Persistence

Device and room state is persisted to SQLite (or PostgreSQL) automatically. When the server restarts, devices and their room assignments are restored from storage before adapters begin polling.

History is stored too — use `/devices/{id}` to see `updated_at` and `last_seen` timestamps, or explore the database directly for full attribute history and command audit logs.
