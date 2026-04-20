+++
title = "Configuration"
description = "Every option in config/default.toml — API binding, authentication, adapters, persistence, scenes, automations, and CORS."
weight = 2
template = "page.html"
+++

HomeCmdr is configured through a single TOML file. The default location is `config/default.toml` inside your workspace, but you can override it:

- CLI flag: `--config /path/to/config.toml`
- Environment variable: `HOMECMDR_CONFIG=/path/to/config.toml`

When installed as a systemd service, the CLI copies and adjusts your config to `/etc/homecmdr/default.toml`.

---

## `[api]`

```toml
[api]
bind_address = "127.0.0.1:3001"
```

| Key | Type | Default | Description |
|---|---|---|---|
| `bind_address` | string | `"127.0.0.1:3001"` | Host and port the HTTP server listens on |

---

## `[api.cors]`

Cross-origin requests are disabled by default. Enable them for browser-based dashboards served from a different origin.

```toml
[api.cors]
enabled = true
allowed_origins = ["http://127.0.0.1:8080"]
```

| Key | Type | Description |
|---|---|---|
| `enabled` | bool | Enable CORS support |
| `allowed_origins` | array of strings | Explicit origins to allow. Wildcard (`*`) is not supported. |

---

## `[api.rate_limit]`

Optional token-bucket rate limiter on write endpoints.

```toml
[api.rate_limit]
enabled = false
requests_per_second = 100
burst_size = 20
```

Affects: `POST /devices/{id}/command`, `POST /rooms/{id}/command`, `POST /groups/{id}/command`, `POST /scenes/{id}/execute`.

Requests that exceed the configured rate receive `HTTP 429 Too Many Requests`.

---

## `[auth]`

```toml
[auth]
master_key = "your-strong-key-here"
```

The master key grants full admin access and is used for initial setup and API key management. It is stored and compared as a SHA-256 hex digest.

Override it at runtime with the `HOMECMDR_MASTER_KEY` environment variable (takes precedence over the config file value).

See [Authentication](/docs/authentication/) for the full key management model.

---

## `[locale]`

```toml
[locale]
timezone = "Europe/London"
latitude  = 51.5
longitude = -0.1
```

Used by sunrise/sunset automation triggers and wall-clock scheduling. `latitude` and `longitude` are in decimal degrees. `timezone` must be a valid [IANA timezone name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

---

## `[persistence]`

### SQLite (default)

```toml
[persistence]
backend = "sqlite"
database_url = "sqlite://data/homecmdr.db"
auto_create = true
```

The database file is created automatically on first run. Relative paths in `database_url` are resolved from the directory set by `HOMECMDR_DATA_DIR` (or the current working directory if unset).

### PostgreSQL

```toml
[persistence]
backend = "postgres"
database_url = "postgres://user:pass@localhost/homecmdr"
```

Both backends store the same data: device and room state, full attribute history, command audit log, scene and automation execution history.

---

## `[scenes]`

```toml
[scenes]
enabled   = true
directory = "config/scenes"
watch     = false
```

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Load scene assets at startup |
| `directory` | string | `"config/scenes"` | Path to Lua scene files |
| `watch` | bool | `false` | Auto-reload scenes when `.lua` files change |

When `watch = true`, saving any `.lua` file under the directory triggers a debounced reload identical to `POST /scenes/reload`. Keep `watch = false` in production.

---

## `[automations]`

```toml
[automations]
enabled   = true
directory = "config/automations"
watch     = false

[automations.runner]
default_max_concurrent = 8
backstop_timeout_secs  = 3600
```

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Load automation assets at startup |
| `directory` | string | `"config/automations"` | Path to Lua automation files |
| `watch` | bool | `false` | Auto-reload automations when `.lua` files change |
| `runner.default_max_concurrent` | int | `8` | Max concurrent executions for automations using `parallel` mode without an explicit `max` |
| `runner.backstop_timeout_secs` | int | `3600` | Hard ceiling (seconds) on any single automation execution |

---

## `[scripts]`

```toml
[scripts]
enabled   = true
directory = "config/scripts"
watch     = false
```

Scripts are reusable Lua helper modules loaded by scenes and automations via `require(...)`. See [Scenes](/docs/scenes/) and [Automations](/docs/automations/).

---

## `[adapters]`

Each enabled adapter gets its own block:

```toml
[adapters.open_meteo]
enabled            = true
latitude           = 51.5
longitude          = -0.1
poll_interval_secs = 90

[adapters.zigbee2mqtt]
enabled    = true
host       = "192.168.1.10"
port       = 1883
base_topic = "zigbee2mqtt"

[adapters.elgato_lights]
enabled = true
```

The fields inside each `[adapters.<name>]` block are defined by the adapter crate, not by core. See the [plugin docs](/developers/plugins/) for the config reference for each official adapter.

---

## Environment variables

| Variable | Effect |
|---|---|
| `HOMECMDR_CONFIG` | Path to the config file (overrides `--config`) |
| `HOMECMDR_DATA_DIR` | Prefix for relative `database_url` paths |
| `HOMECMDR_MASTER_KEY` | Overrides `auth.master_key` in the config file |
