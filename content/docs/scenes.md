+++
title = "Scenes"
description = "Write Lua scenes to orchestrate devices with one API call or one dashboard button press."
weight = 4
template = "page.html"
+++

Scenes are manually-invoked Lua scripts. Each scene encapsulates a set of device commands — a "video call setup", a "goodnight routine", a "movie mode" — and executes them in sequence when triggered.

---

## Scene files

Scenes live in `config/scenes/` (configurable via `[scenes].directory`). Each scene is a single `.lua` file that returns a Lua table.

### Minimal example

```lua
-- config/scenes/video.lua
return {
  id      = "video",
  name    = "Video",
  execute = function(ctx)
    ctx:command("roku_tv:tv", {
      capability = "power",
      action     = "off",
    })
    ctx:command("elgato_lights:light:0", {
      capability = "power",
      action     = "on",
    })
  end,
}
```

### Required fields

| Field | Description |
|---|---|
| `id` | Unique string identifier — used in API calls and dashboard |
| `name` | Human-readable name |
| `execute` | Lua function `function(ctx)` that performs the scene |

### Optional fields

| Field | Description |
|---|---|
| `description` | Short description (shown in dashboards) |
| `mode` | Concurrency mode (see below) |

---

## Available `ctx` methods

Inside `execute(ctx)`, the following methods are available:

### `ctx:command(device_id, command)`

Send one canonical command to one device.

```lua
ctx:command("elgato_lights:light:0", {
  capability = "brightness",
  action     = "set",
  value      = 75,
})
```

### `ctx:command_group(group_id, command)`

Fan out one command to every device in a group.

```lua
ctx:command_group("bedroom_lamps", {
  capability = "power",
  action     = "off",
})
```

### `ctx:invoke(target, payload)`

Dispatch a service-style request to an adapter. Used mainly with the Ollama adapter.

```lua
local result = ctx:invoke("ollama:chat", {
  messages = {
    { role = "user", content = "Summarise my home status." },
  },
})
local reply = result.message.content
```

### `ctx:get_device(id)` / `ctx:list_devices()`

Read current device state from the registry without an HTTP call.

```lua
local tv = ctx:get_device("roku_tv:tv")
if tv and tv.attributes.power == "off" then
  -- ...
end
```

### `ctx:get_room(id)` / `ctx:list_rooms()` / `ctx:list_room_devices(room_id)`

Read room state.

### `ctx:get_group(id)` / `ctx:list_groups()` / `ctx:list_group_devices(group_id)`

Read group state.

### `ctx:log(level, message, fields?)`

Emit a structured log entry.

```lua
ctx:log("info", "scene executed", { scene_id = "video" })
```

Level values: `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`.

### `ctx:sleep(secs)`

Pause execution without blocking the async runtime. Useful for sequenced delays.

```lua
ctx:command_group("living_room_lights", { capability = "power", action = "off" })
ctx:sleep(2)
ctx:command("roku_tv:tv", { capability = "power", action = "off" })
```

`secs` must be between `0` and `3600`.

---

## Executing a scene via the API

```bash
curl -X POST http://localhost:3001/scenes/video/execute \
  -H "Authorization: Bearer $TOKEN"
```

Success response:

```json
{
  "status": "ok",
  "results": [
    { "target": "roku_tv:tv",            "status": "ok",          "message": null },
    { "target": "elgato_lights:light:0", "status": "ok",          "message": null }
  ]
}
```

### Response codes

| Status | Meaning |
|---|---|
| `200 OK` | Scene completed |
| `202 Accepted` | Scene queued (`queued` mode) |
| `404 Not Found` | Scene ID does not exist |
| `423 Locked` | Scene dropped due to concurrency limit |

---

## Listing scenes

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/scenes
```

---

## Reloading scenes

After editing scene files, reload without restarting the server:

```bash
curl -X POST http://localhost:3001/scenes/reload \
  -H "Authorization: Bearer $TOKEN"
```

On success, the new catalog is swapped in atomically. If any file fails validation, the previous catalog remains active and the error is returned:

```json
{
  "status": "error",
  "errors": [
    { "file": "config/scenes/broken.lua", "message": "missing field 'execute'" }
  ]
}
```

Reload events are emitted on the WebSocket `/events` stream (`scene.catalog_reload_started`, `scene.catalog_reloaded`, `scene.catalog_reload_failed`).

---

## Execution mode

By default, multiple invocations of the same scene can run concurrently (up to the global `default_max_concurrent` limit). Control this with the optional `mode` field:

| Mode | Behaviour |
|---|---|
| `"parallel"` (default) | Concurrent executions up to the configured max |
| `"single"` | Only one execution at a time; extras are dropped |
| `"queued"` | One at a time; extras are queued |
| `"restart"` | Cancels running execution and starts fresh |

```lua
return {
  id   = "slow_scene",
  name = "Slow Scene",
  mode = "single",     -- string shorthand
  execute = function(ctx)
    -- ...
  end,
}
```

With an explicit max:

```lua
mode = { type = "parallel", max = 2 }
mode = { type = "queued",   max = 5 }
```

---

## Shared helper scripts

Place reusable Lua modules in `config/scripts/` and load them with `require`:

```lua
-- config/scripts/devices.lua
local M = {}
function M.all_off(ctx)
  ctx:command_group("all_lights", { capability = "power", action = "off" })
  ctx:command("roku_tv:tv",       { capability = "power", action = "off" })
end
return M
```

```lua
-- config/scenes/goodnight.lua
local devices = require("devices")
return {
  id      = "goodnight",
  name    = "Goodnight",
  execute = function(ctx)
    devices.all_off(ctx)
  end,
}
```

Subdirectories work too: `require("lighting.helpers")` loads `config/scripts/lighting/helpers.lua`.

---

## Tips

- Duplicate scene IDs across files cause startup to fail — keep IDs unique.
- `ctx:sleep()` is appropriate for short in-scene delays; for recurring time-based logic, use [automations](/docs/automations/).
- Commands are validated against the canonical capability catalog before reaching the adapter. An invalid capability or action returns an error immediately.
