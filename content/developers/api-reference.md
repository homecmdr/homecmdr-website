+++
title = "HTTP API Reference"
description = "Complete reference for the HomeCmdr HTTP and WebSocket API: endpoints, request/response shapes, authentication, and event types."
weight = 1
template = "page.html"
+++

The HomeCmdr API is a JSON HTTP + WebSocket server exposed by the `api` binary.

Default base URL: `http://127.0.0.1:3000`

The bind address is configured via `api.bind_address` in `config/default.toml`.

---

## Authentication

All routes except `GET /health` and `GET /ready` require a Bearer token:

```
Authorization: Bearer <token>
```

**Roles:** `read`, `write`, `admin`, `automation`

| Role | Satisfies |
|---|---|
| `read` | Read endpoints (all GETs + WebSocket) |
| `write` | Mutation endpoints |
| `admin` | Diagnostics, reload, key management |
| `automation` | Admin + Automation |

The master key (configured via `auth.master_key` or `HOMECMDR_MASTER_KEY`) always grants `admin`. API keys are created and scoped through the `/auth/keys` endpoints.

See [Authentication](/docs/authentication/) for full setup details.

---

## Rate Limiting

Write endpoints are subject to an optional token-bucket rate limiter. When a request exceeds the configured rate:

```
HTTP 429 Too Many Requests
```

Configured in `config/default.toml`:

```toml
[api.rate_limit]
enabled = false
requests_per_second = 100
burst_size = 20
```

Rate limiting is disabled by default.

---

## Conventions

- Request and response bodies are JSON.
- Device IDs are stable namespaced strings: `elgato_lights:light:0`, `roku_tv:tv`.
- Room IDs are user-defined strings: `living_room`, `outside`.
- Commands use canonical capability/action pairs (see [Command Shape](#canonical-command-shape)).

---

## Health

### `GET /health`

Returns a simple liveness response. **No authentication required.**

```bash
curl http://127.0.0.1:3000/health
```

```json
{ "status": "ok" }
```

### `GET /diagnostics/reload_watch`

Returns current reload-watch configuration for scenes, automations, and scripts.

```json
{
  "status": "ok",
  "watches": [
    { "target": "scenes", "enabled": true, "directory": "config/scenes" },
    { "target": "automations", "enabled": false, "directory": "config/automations" },
    { "target": "scripts", "enabled": false, "directory": "config/scripts" }
  ]
}
```

---

## Adapters

### `GET /adapters`

Returns all configured adapters that were successfully built and enabled.

```bash
curl http://127.0.0.1:3000/adapters \
  -H 'Authorization: Bearer <token>'
```

```json
[
  { "name": "open_meteo", "status": "running" },
  { "name": "roku_tv", "status": "running" }
]
```

---

## Devices

### `GET /devices`

Returns all devices in the in-memory registry (including devices restored from persistence).

Optional query param `ids` filters to specific device IDs in the requested order:

```bash
curl "http://127.0.0.1:3000/devices?ids=open_meteo:temperature_outdoor&ids=open_meteo:wind_speed"
```

Unmatched IDs are silently omitted.

### `GET /devices/{id}`

Returns one device by ID.

```bash
curl http://127.0.0.1:3000/devices/roku_tv:tv
```

Returns `404` with `{ "error": "device 'nonexistent' not found" }` if not found.

### `POST /devices/{id}/room`

Assigns a device to a room or clears its room assignment.

```json
{ "room_id": "living_room" }
```

Clear assignment:

```json
{ "room_id": null }
```

Returns `404` if the device does not exist. Returns `400` if the referenced room does not exist.

### `POST /devices/{id}/command`

Sends one canonical command to one device.

```bash
curl -X POST http://127.0.0.1:3000/devices/roku_tv:tv/command \
  -H 'Content-Type: application/json' \
  -d '{"capability":"power","action":"toggle"}'
```

With a value:

```bash
curl -X POST http://127.0.0.1:3000/devices/elgato_lights:light:0/command \
  -H 'Content-Type: application/json' \
  -d '{"capability":"brightness","action":"set","value":50}'
```

Success:

```json
{ "status": "ok" }
```

Error responses:

| Code | Meaning |
|---|---|
| `404` | Device does not exist |
| `400` | Invalid command or adapter rejected it |
| `501` | Commands not implemented for this device |

---

## Rooms

### `GET /rooms`

Returns all rooms.

### `POST /rooms`

Creates or updates a room.

```json
{ "id": "living_room", "name": "Living Room" }
```

Both `id` and `name` must be non-empty.

### `GET /rooms/{id}`

Returns one room by ID.

### `GET /rooms/{id}/devices`

Returns all devices assigned to a room.

```bash
curl http://127.0.0.1:3000/rooms/living_room/devices
```

### `POST /rooms/{id}/command`

Fans out one canonical command to every device in the room.

```bash
curl -X POST http://127.0.0.1:3000/rooms/living_room/command \
  -H 'Content-Type: application/json' \
  -d '{"capability":"power","action":"off"}'
```

```json
[
  { "device_id": "roku_tv:tv", "status": "ok", "message": null },
  { "device_id": "open_meteo:wind_speed", "status": "unsupported", "message": "device commands are not implemented" }
]
```

Per-device statuses: `ok`, `unsupported`, `error`.

---

## Groups

Groups are explicit user-defined collections of devices. Membership is static and managed directly.

### `GET /groups`

Returns all groups.

```json
[
  {
    "id": "bedroom_lamps",
    "name": "Bedroom Lamps",
    "members": ["zigbee2mqtt:bedside_left", "zigbee2mqtt:bedside_right"]
  }
]
```

### `POST /groups`

Creates or updates a group.

```json
{
  "id": "bedroom_lamps",
  "name": "Bedroom Lamps",
  "members": ["zigbee2mqtt:bedside_left", "zigbee2mqtt:bedside_right"]
}
```

Validation: non-empty `id` and `name`; all `members` must refer to existing devices.

### `GET /groups/{id}`

Returns one group by ID.

### `DELETE /groups/{id}`

Deletes a group.

### `POST /groups/{id}/members`

Replaces group membership with an explicit device list.

```json
{ "members": ["zigbee2mqtt:bedside_left", "zigbee2mqtt:bedside_right"] }
```

Returns `400` if any member device does not exist. Duplicate IDs are deduplicated (first-seen order preserved).

### `GET /groups/{id}/devices`

Returns all devices currently in the group.

### `POST /groups/{id}/command`

Fans out one canonical command to every device in the group.

```bash
curl -X POST http://127.0.0.1:3000/groups/bedroom_lamps/command \
  -H 'Content-Type: application/json' \
  -d '{"capability":"power","action":"off"}'
```

Response shape matches `POST /rooms/{id}/command`.

---

## Scenes

### `GET /scenes`

Returns all loaded scenes.

```json
[
  { "id": "video", "name": "Video", "description": "Prepare devices for a video call" }
]
```

### `POST /scenes/reload`

Reloads the scene catalog from disk. Validates all files first; atomically swaps on success; keeps the previous catalog if any file fails.

```json
{
  "status": "ok",
  "target": "scenes",
  "loaded_count": 12,
  "errors": [],
  "duration_ms": 9
}
```

WebSocket events emitted: `scene.catalog_reload_started`, `scene.catalog_reloaded`, `scene.catalog_reload_failed`.

### `POST /scenes/{id}/execute`

Executes one scene by ID.

```bash
curl -X POST http://127.0.0.1:3000/scenes/video/execute
```

```json
{
  "status": "ok",
  "results": [
    { "target": "roku_tv:tv", "status": "ok", "message": null },
    { "target": "elgato_lights:light:0", "status": "ok", "message": null }
  ]
}
```

| Code | Meaning |
|---|---|
| `200` | Completed |
| `202` | Queued (scene uses `queued` mode) |
| `404` | Scene not found |
| `423` | Dropped (scene uses `single` mode and is already running) |

---

## Automations

### `POST /automations/reload`

Reloads the automation catalog. Validates, atomically swaps, restarts trigger loops, preserves enabled/disabled toggles for unchanged IDs.

Response shape is the same as `POST /scenes/reload` with `target: "automations"`.

WebSocket events emitted: `automation.catalog_reload_started`, `automation.catalog_reloaded`, `automation.catalog_reload_failed`.

---

## Scripts

### `POST /scripts/reload`

Acknowledges script directory changes and emits lifecycle events. Does not interrupt in-flight scene or automation executions.

Response shape is the same as other reload endpoints with `target: "scripts"`.

---

## Capabilities

### `GET /capabilities`

Returns the canonical capability catalog used for device and command validation.

```json
{
  "capabilities": [
    {
      "domain": "lighting",
      "key": "brightness",
      "schema": { "type": "percentage", "values": [] },
      "read_only": false,
      "actions": ["set", "increase", "decrease"],
      "description": "Brightness level as a percentage (0-100)."
    }
  ],
  "ownership": { ... }
}
```

Current domains include: `weather`, `lighting`, `sensor`, `climate`, `energy`, `media`, `access-control`.

---

## Authentication Keys

### `POST /auth/keys`

Creates a new API key.

### `GET /auth/keys`

Lists all API keys (hashed; plaintext is only shown at creation time).

### `DELETE /auth/keys/{id}`

Revokes an API key.

---

## WebSocket Events

### `GET /events`

Upgrade to a WebSocket connection to receive live runtime events.

```bash
wscat -c ws://127.0.0.1:3000/events -H 'Authorization: Bearer <token>'
```

Current event types:

| Event type | Description |
|---|---|
| `device.state_changed` | Device attribute state updated |
| `device.removed` | Device removed from registry |
| `device.room_changed` | Device assigned to or removed from a room |
| `room.added` | Room created |
| `room.updated` | Room name changed |
| `room.removed` | Room deleted |
| `group.added` | Group created |
| `group.updated` | Group name changed |
| `group.removed` | Group deleted |
| `group.members_changed` | Group membership updated |
| `adapter.started` | Adapter completed startup |
| `system.error` | Runtime error from an adapter or internal component |

Example frames:

```json
{ "type": "adapter.started", "adapter": "roku_tv" }
```

```json
{ "type": "device.state_changed", "id": "roku_tv:tv", "state": { "power": "off", "state": "online" } }
```

```json
{ "type": "device.room_changed", "id": "roku_tv:tv", "room_id": "living_room" }
```

```json
{ "type": "system.error", "message": "roku_tv poll failed: ..." }
```

Notes:
- Internal `DeviceSeen` refreshes are filtered out of the public stream.
- If a subscriber lags badly, a `system.error` frame is emitted indicating dropped events.

---

## Device Shape

Important fields on every device object:

| Field | Description |
|---|---|
| `id` | Stable namespaced string, e.g. `elgato_lights:light:0` |
| `room_id` | Assigned room, or `null` |
| `kind` | `Sensor`, `Light`, `Switch`, or `Virtual` |
| `attributes` | Canonical state keyed by capability name |
| `metadata` | Non-canonical adapter data including `vendor_specific` |
| `updated_at` | Changes only when meaningful state changes |
| `last_seen` | Updates on every successful observation |

---

## Canonical Command Shape

```json
{
  "capability": "...",
  "action": "...",
  "value": null
}
```

`value` is omitted for `on`, `off`, and `toggle`. It is required for `set`.

Examples:

```json
{ "capability": "power", "action": "on" }
```

```json
{ "capability": "brightness", "action": "set", "value": 42 }
```

```json
{
  "capability": "color_temperature",
  "action": "set",
  "value": { "value": 3000, "unit": "kelvin" }
}
```

---

## Agent / MCP Usage Notes

When integrating MCP tools or automation agents against a running HomeCmdr instance:

- Use `GET /scenes` to discover available scene assets.
- Use `GET /devices` to discover the live canonical device graph.
- Use `GET /rooms` to discover the room model.
- Use `POST /scenes/{id}/execute` for scene-driven orchestration.
- Use `POST /devices/{id}/room` to attach devices to rooms.
- Use `POST /devices/{id}/command` for direct device control.
- Use `POST /rooms/{id}/command` for room-wide fan-out.
- Connect to `/events` to react to runtime changes.

Treat the HTTP API as the external system contract and adapter crates as the integration contract.
