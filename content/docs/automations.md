+++
title = "Automations"
description = "Trigger Lua scripts automatically based on device state changes, schedules, solar events, and more."
weight = 5
template = "page.html"
+++

Automations are trigger-driven Lua scripts. Where [scenes](/docs/scenes/) are manually invoked, automations run in response to events — a device state changing, a cron schedule firing, the sun rising, or an adapter coming online.

---

## Automation files

Automations live in `config/automations/` (configurable via `[automations].directory`). Each automation is a `.lua` file returning a Lua table.

### Minimal example

```lua
-- config/automations/evening_lights.lua
return {
  id      = "evening_lights",
  name    = "Evening Lights",
  trigger = {
    type = "sunset",
  },
  execute = function(ctx, event)
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
| `id` | Unique string identifier |
| `name` | Human-readable name |
| `trigger` | Table describing when the automation fires (see below) |
| `execute` | Lua function `function(ctx, event)` |

### Optional fields

| Field | Description |
|---|---|
| `description` | Short description |
| `conditions` | List of conditions all evaluated after the trigger (AND logic) |
| `state` | Cooldown, dedupe, and scheduling persistence settings |
| `mode` | Concurrency mode |

---

## Trigger types

### `device_state_change`

Fires when a device attribute changes.

```lua
trigger = {
  type      = "device_state_change",
  device_id = "weather:outside",
  attribute = "rain",
  equals    = true,
}
```

| Field | Required | Description |
|---|---|---|
| `device_id` | yes | Device to watch |
| `attribute` | no | Attribute name to filter on |
| `equals` | no | Attribute must equal this value |
| `above` | no | Numeric attribute must be above this threshold |
| `below` | no | Numeric attribute must be below this threshold |
| `debounce_secs` | no | Wait for the value to remain stable for this many seconds before firing |
| `duration_secs` | no | Value must remain matching for this many seconds before firing |

Threshold triggers (`above`, `below`) fire when the value **crosses into** the matching range, not on every update.

---

### `weather_state`

Same fields and behaviour as `device_state_change`, intended for weather sensors as a semantic distinction.

---

### `wall_clock`

Fires once per day at a specific local time.

```lua
trigger = {
  type   = "wall_clock",
  hour   = 7,
  minute = 30,
}
```

Uses the timezone from `[locale].timezone` in your config.

---

### `cron`

Fires on a UTC cron schedule. Uses a seven-field expression with seconds support.

```lua
trigger = {
  type       = "cron",
  expression = "0 */15 * * * * *",   -- every 15 minutes
}
```

---

### `interval`

Fires repeatedly on a fixed time interval.

```lua
trigger = {
  type       = "interval",
  every_secs = 3600,   -- every hour
}
```

---

### `sunrise` / `sunset`

Fires at the computed solar event for your configured location.

```lua
trigger = {
  type        = "sunrise",
  offset_mins = -30,   -- 30 minutes before sunrise
}
```

`offset_mins` defaults to `0`. Negative values are before the event, positive after.

Location is read from `[locale].latitude` and `[locale].longitude` in your config.

---

### `adapter_lifecycle`

Fires when an adapter starts.

```lua
trigger = {
  type    = "adapter_lifecycle",
  event   = "started",
  adapter = "zigbee2mqtt",   -- omit to match any adapter
}
```

---

### `system_error`

Fires on any system error event.

```lua
trigger = {
  type     = "system_error",
  contains = "poll failed",   -- optional substring filter
}
```

---

## The event object

The `execute(ctx, event)` function receives an event table.

Common fields:

| Field | Description |
|---|---|
| `event.type` | Trigger type string |
| `event.device_id` | For device triggers |
| `event.attribute` | Attribute name that changed |
| `event.value` | Current attribute value |
| `event.previous_value` | Previous attribute value |
| `event.attributes` | Full attribute map for the device |
| `event.scheduled_at` | For time-based triggers |

---

## Conditions

Conditions are optional filters evaluated after the trigger matches. All conditions must pass for `execute` to run (AND logic).

```lua
conditions = {
  {
    type       = "time_window",
    start      = "20:00",
    end_time   = "23:00",
  },
  {
    type       = "device_state",
    device_id  = "roku_tv:tv",
    attribute  = "power",
    equals     = false,
  },
}
```

### Condition types

**`device_state`** — current device attribute must match

| Field | Description |
|---|---|
| `device_id` | required |
| `attribute` | required |
| `equals` / `above` / `below` | at least one required |

**`presence`** — convenience wrapper for a presence attribute

| Field | Default |
|---|---|
| `device_id` | required |
| `attribute` | `"presence"` |
| `equals` | `true` |

**`time_window`** — current local time must be within range

| Field | Description |
|---|---|
| `start` | `"HH:MM"` in locale timezone |
| `end` | `"HH:MM"` in locale timezone |

Overnight ranges are supported, e.g. `22:00`–`06:00`.

**`room_state`** — number of devices in a room

| Field | Description |
|---|---|
| `room_id` | required |
| `min_devices` | optional |
| `max_devices` | optional |

**`sun_position`** — current time relative to solar events

```lua
{ type = "sun_position", after = "sunset" }
{ type = "sun_position", before = "sunrise", before_offset_mins = 30 }
```

---

## Full example with conditions

```lua
return {
  id   = "movie_mode",
  name = "Movie Mode",
  trigger = {
    type      = "device_state_change",
    device_id = "remote:living_room",
    attribute = "custom.remote.button",
    equals    = "movie",
  },
  conditions = {
    { type = "time_window", start = "18:00", ["end"] = "23:00" },
    { type = "sun_position", after = "sunset" },
    { type = "device_state", device_id = "roku_tv:tv", attribute = "power", equals = false },
  },
  execute = function(ctx, event)
    ctx:command("elgato_lights:light:0", { capability = "power", action = "on" })
    ctx:command("roku_tv:tv",            { capability = "power", action = "on" })
  end,
}
```

---

## Runtime state

Automations can declare a `state` table for cooldown, deduplication, and resumable scheduling.

```lua
state = {
  cooldown_secs      = 300,   -- suppress re-triggers for 5 minutes after execution
  dedupe_window_secs = 60,    -- suppress identical trigger payloads within 60 seconds
  resumable_schedule = true,  -- persist scheduled fire times across restarts
}
```

---

## Execution mode

Same options as [scenes](/docs/scenes/#execution-mode): `"parallel"` (default), `"single"`, `"queued"`, `"restart"`.

---

## Concurrency limits

`[automations.runner]` in your config:

```toml
[automations.runner]
default_max_concurrent = 8       # global limit for parallel-mode automations
backstop_timeout_secs  = 3600    # hard kill after this many seconds
```

---

## Reloading automations

```bash
curl -X POST http://localhost:3001/automations/reload \
  -H "Authorization: Bearer $TOKEN"
```

Validation runs before activation. The previous catalog stays active if any file fails. Reload events are emitted on the WebSocket stream.
