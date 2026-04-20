+++
title = "Lua Runtime"
description = "Lua runtime guide for HomeCmdr scenes, automations, and scripts: ctx API, trigger types, conditions, execution modes, and scripting patterns."
weight = 2
template = "page.html"
+++

Lua is the primary user-authored orchestration layer in HomeCmdr. Scenes, automations, and shared script modules are all written in Lua 5.4 (vendored via `mlua` — no system Lua dependency required).

**Asset roots:**

| Directory | Purpose |
|---|---|
| `config/scenes/` | Manual user-invoked flows |
| `config/automations/` | Trigger-driven decisions |
| `config/scripts/` | Reusable helper modules |

---

## Shared Host API (`ctx`)

Both scenes and automations receive the same host API through a `ctx` object passed to their `execute` function.

### `ctx:command(device_id, command_table)`

Sends one canonical command to one device.

```lua
ctx:command("elgato_lights:light:0", {
  capability = "brightness",
  action = "set",
  value = 50,
})
```

The command table maps to the same shape used by `POST /devices/{id}/command`.

### `ctx:command_group(group_id, command_table)`

Fans out one command to every device in a group, in membership order.

```lua
ctx:command_group("bedroom_lamps", {
  capability = "power",
  action = "off",
})
```

Returns a Lua error immediately if the group does not exist. Empty groups are a silent no-op.

### `ctx:invoke(target, payload_table)`

Dispatches a service-style call to the adapter that owns the `target` prefix. Returns a Lua value.

```lua
local result = ctx:invoke("ollama:chat", {
  messages = {
    { role = "user", content = "Give me a short home summary." },
  },
})
local reply = result.message.content
```

Invoke targets are adapter-defined. See [Ollama](/developers/plugins/ollama/) for available `ollama:*` targets.

### State read helpers

Lua assets can inspect the live registry without going through HTTP:

| Method | Returns |
|---|---|
| `ctx:get_device(device_id)` | Device table or `nil` |
| `ctx:list_devices()` | Array of device tables |
| `ctx:get_room(room_id)` | Room table or `nil` |
| `ctx:list_rooms()` | Array of room tables |
| `ctx:list_room_devices(room_id)` | Devices assigned to a room |
| `ctx:get_group(group_id)` | Group table or `nil` |
| `ctx:list_groups()` | Array of group tables |
| `ctx:list_group_devices(group_id)` | Devices in a group |

Device tables include: `id`, `room_id`, `kind`, `attributes`, `metadata`, `updated_at`, `last_seen`.

Group tables include: `id`, `name`, `members` (array of device IDs).

### `ctx:log(level, message, fields?)`

Emits a structured log line from within a scene or automation.

```lua
ctx:log("info", "rain automation fired", {
  automation_id = "rain_reminder",
  device_id = event.device_id,
})
```

### `ctx:sleep(secs)`

Pauses Lua execution for the given number of seconds without blocking the async executor.

```lua
ctx:command_group("bedroom_lamps", { capability = "power", action = "off" })
ctx:sleep(5)
ctx:command("roku_tv:tv", { capability = "power", action = "off" })
```

- Valid range: `0..=3600`. Values outside this range produce a Lua error.
- Sleep is not interruptible by `restart` mode — the cancellation takes effect after the sleep returns.
- For scheduling that does not require in-script delays, prefer trigger-level primitives (`interval`, `wall_clock`, `cron`, `debounce_secs`) over `ctx:sleep`.

---

## Scenes

Scenes are manually invoked by users or external clients via `POST /scenes/{id}/execute`.

**Location:** `config/scenes/*.lua`

**Minimum contract:**

```lua
return {
  id = "video",
  name = "Video",
  description = "Prepare devices for a video call",
  execute = function(ctx)
    ctx:command("roku_tv:tv", {
      capability = "power",
      action = "off",
    })
    ctx:command("elgato_lights:light:0", {
      capability = "power",
      action = "on",
    })
  end
}
```

| Field | Required | Description |
|---|---|---|
| `id` | yes | Stable unique identifier |
| `name` | yes | Display name |
| `description` | no | Optional description |
| `execute` | yes | `function(ctx)` — the scene body |
| `mode` | no | Execution mode (see below) |

Duplicate scene IDs fail startup. Scene files must return a Lua table.

---

## Automations

Automations are triggered by runtime events and optionally filtered by conditions.

**Location:** `config/automations/*.lua`

**Minimum contract:**

```lua
return {
  id = "rain_check",
  name = "Rain Check",
  trigger = {
    type = "device_state_change",
    device_id = "weather:outside",
    attribute = "rain",
    equals = true,
  },
  execute = function(ctx, event)
    ctx:log("info", "it's raining", { device_id = event.device_id })
  end,
}
```

| Field | Required | Description |
|---|---|---|
| `id` | yes | Stable unique identifier |
| `name` | yes | Display name |
| `trigger` | yes | Trigger definition (see below) |
| `execute` | yes | `function(ctx, event)` — the automation body |
| `description` | no | Optional description |
| `conditions` | no | Optional list of AND conditions |
| `state` | no | Cooldown / dedupe / resumable schedule |
| `mode` | no | Execution mode |

---

## Trigger Types

### `device_state_change`

Fires when a device attribute changes.

```lua
trigger = {
  type = "device_state_change",
  device_id = "weather:outside",
  attribute = "rain",
  equals = true,
}
```

| Field | Description |
|---|---|
| `device_id` | Required |
| `attribute` | Optional — filter to one attribute |
| `equals` | Optional exact-match value |
| `above` / `below` | Optional numeric thresholds; fire when the value crosses into range |
| `debounce_secs` | Optional — wait for value to remain stable before firing |
| `duration_secs` | Optional — wait for value to remain true for the full duration |

### `weather_state`

Same matching rules as `device_state_change`, but semantically scoped to weather/environmental devices.

Fields: `device_id` (required), `attribute` (required), `equals`, `above`, `below`, `debounce_secs`, `duration_secs`.

### `adapter_lifecycle`

Fires when an adapter starts.

```lua
trigger = {
  type = "adapter_lifecycle",
  adapter = "elgato_lights",   -- omit to match any adapter
  event = "started",
}
```

### `system_error`

Fires on a runtime error.

```lua
trigger = {
  type = "system_error",
  contains = "poll failed",   -- optional substring match
}
```

### `wall_clock`

Fires once per day at a specific local time (uses `locale.timezone`).

```lua
trigger = {
  type = "wall_clock",
  hour = 6,
  minute = 30,
}
```

### `cron`

Fires on a UTC seven-field cron schedule (seconds supported).

```lua
trigger = {
  type = "cron",
  expression = "0 */5 * * * * *",
}
```

### `sunrise` / `sunset`

Fires at sunrise or sunset for the configured location (`locale.latitude`, `locale.longitude`).

```lua
trigger = {
  type = "sunset",
  offset_mins = -15,  -- 15 minutes before sunset
}
```

### `interval`

Fires on a repeating interval.

```lua
trigger = {
  type = "interval",
  every_secs = 3600,
}
```

`every_secs` must be greater than zero.

---

## Conditions

Conditions are optional filters evaluated after the trigger matches. All conditions use AND logic.

```lua
conditions = {
  {
    type = "time_window",
    start = "18:00",
    end = "23:00",
  },
  {
    type = "sun_position",
    after = "sunset",
  },
  {
    type = "device_state",
    device_id = "roku_tv:tv",
    attribute = "power",
    equals = false,
  },
},
```

### `device_state`

Fields: `device_id` (required), `attribute` (required), `equals`, `above`, `below`.

### `presence`

Fields: `device_id` (required), `attribute` (default: `presence`), `equals` (default: `true`).

### `time_window`

Fields: `start` and `end` in `HH:MM` format. Evaluated in `locale.timezone`. Supports overnight ranges (e.g. `22:00` to `06:00`).

### `room_state`

Fields: `room_id` (required), `min_devices` (optional), `max_devices` (optional).

### `sun_position`

Fields: `after` (`sunrise` or `sunset`), `before` (`sunrise` or `sunset`), `after_offset_mins`, `before_offset_mins`. Uses configured latitude/longitude.

---

## Execution Modes

Both scenes and automations support an optional `mode` field that controls concurrent execution behavior.

| Mode | Behaviour |
|---|---|
| `parallel` (default) | Up to `max` concurrent executions; additional triggers are dropped |
| `single` | At most one execution at a time; concurrent triggers are dropped |
| `queued` | One at a time; up to `max` pending triggers queued in order |
| `restart` | Cancels the running execution and starts fresh immediately |

The default `max` for parallel mode is `automations.runner.default_max_concurrent` in `config/default.toml` (defaults to `8`).

**String shorthand** (for modes without a meaningful `max`):

```lua
mode = "single"
mode = "restart"
```

**Table form** with optional `max`:

```lua
mode = { type = "parallel", max = 3 }
mode = { type = "queued", max = 10 }
```

---

## Scripts

Scripts are reusable Lua helper modules loaded with `require(...)` from scenes and automations.

**Location:** `config/scripts/*.lua`

```lua
-- config/scripts/ollama.lua
local M = {}

function M.vision_bool(ctx, prompt, image_base64)
  local result = ctx:invoke("ollama:vision", {
    prompt = prompt,
    image_base64 = image_base64,
  })
  return result.boolean == true
end

return M
```

Usage in a scene or automation:

```lua
local ollama = require("ollama")

if ollama.vision_bool(ctx, "Reply only true or false. Are clothes on the line?", snapshot) then
  ctx:command("elgato_lights:light:0", { capability = "power", action = "on" })
end
```

Namespaced modules are also supported:

```lua
require("lighting.helpers")  -- loads config/scripts/lighting/helpers.lua
```

Rules:
- Module names must stay within `config/scripts/`.
- Modules are cached within a single execution via Lua's built-in `require` cache.
- Each new scene/automation execution uses a fresh Lua state, so script edits take effect on the next execution.

---

## Persisted Runtime State

Automations can declare runtime state policy with a top-level `state` table:

```lua
state = {
  cooldown_secs = 300,
  dedupe_window_secs = 60,
  resumable_schedule = true,
}
```

| Field | Description |
|---|---|
| `cooldown_secs` | Suppress re-trigger for this many seconds after a successful execution |
| `dedupe_window_secs` | Suppress identical trigger payloads within this window |
| `resumable_schedule` | Persist the last scheduled fire time so the next occurrence resumes after a restart |

---

## Reload Workflow

Scenes and automations support manual catalog reload without restarting the process:

```bash
curl -X POST http://127.0.0.1:3000/scenes/reload
curl -X POST http://127.0.0.1:3000/automations/reload
curl -X POST http://127.0.0.1:3000/scripts/reload
```

Behavior:
- Validates all files before activation.
- Atomically swaps the active catalog on success.
- Keeps the previous catalog if any file fails validation.
- In-flight executions continue on their current Lua context.

Use reload when you change catalog-level fields: IDs, names, `mode`, `trigger`, or `conditions`.

## Optional Watch Mode

`config/default.toml` supports optional file-watch flags:

```toml
[scenes]
watch = false

[automations]
watch = false

[scripts]
watch = false
```

When enabled, saving `.lua` files in the relevant directory triggers a debounced reload using the same validation pipeline.

Recommended: keep `watch = false` in production and use manual reload endpoints as the default operational flow.

---

## Event Object

The `event` table passed to `execute(ctx, event)` includes:

| Field | Description |
|---|---|
| `event.type` | Trigger type string |
| `event.device_id` | Set for device and weather triggers |
| `event.attribute` | Set when filtered by attribute |
| `event.value` | Current attribute value |
| `event.previous_value` | Previous attribute value |
| `event.attributes` | Full attribute snapshot |
| `event.scheduled_at` | Set for time-based triggers |

---

## Configuration Reference

```toml
[locale]
timezone = "Europe/London"
latitude = 51.5
longitude = -0.1

[scenes]
enabled = true
directory = "config/scenes"
watch = false

[automations]
enabled = true
directory = "config/automations"
watch = false

[automations.runner]
default_max_concurrent = 8
backstop_timeout_secs = 3600

[scripts]
enabled = true
directory = "config/scripts"
watch = false
```
