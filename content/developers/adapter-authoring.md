+++
title = "Adapter Authoring"
description = "Guide to writing a new HomeCmdr adapter: architecture, factory registration, polling, commands, canonical device mapping, and the review checklist."
weight = 3
template = "page.html"
+++

This guide covers creating a new adapter crate for HomeCmdr. It reflects the current codebase — not an aspirational plugin system.

> **Publishing an official plugin?** Official plugins live in the [homecmdr/plugins](https://github.com/homecmdr/plugins) registry and are installed into workspaces with `homecmdr plugin add <name>`. This guide is for creating an adapter locally in your workspace.

---

## Architecture Overview

The adapter system is **compile-time linked and factory-driven**.

- `crates/core` defines the shared runtime contracts (traits, command model, event bus, registry).
- `crates/adapters` is a link crate that pulls adapter crates into the final `api` binary.
- `crates/api` discovers adapter factories at startup through `registered_adapter_factories()` (powered by `inventory`).
- Each adapter crate owns its own config, validation, polling, command translation, and tests.

Adapters do **not** require edits to `crates/api/src/main.rs` or `crates/core/src/config.rs`. You will update three places for workspace linkage (see step 13).

---

## Required Runtime Contracts

Before writing any code, read:

- `crates/core/src/adapter.rs` — `Adapter` and `AdapterFactory` traits
- `crates/core/src/model.rs` — `Device`, `DeviceKind`, `AttributeValue`
- `crates/core/src/registry.rs` — `DeviceRegistry`
- `crates/core/src/command.rs` — `DeviceCommand`
- `crates/core/src/capability.rs` — canonical capability catalog

**Key rules:**

1. All device IDs must be namespaced: `"{adapter_name}:{vendor_id}"`.
2. `run()` must publish `Event::AdapterStarted` before doing work.
3. `run()` must not exit on transient failures — log the error and sleep.
4. Polling failures should emit `Event::SystemError`.
5. `command()` returns:
   - `Ok(true)` — command applied
   - `Ok(false)` — device or command not owned by this adapter
   - `Err(...)` — adapter recognized the command but could not apply it
6. Registry updates must preserve prior `room_id`.
7. When state is unchanged, preserve `updated_at` and refresh only `last_seen`.

---

## Existing Patterns

### Pattern 1: Poll-only sensor

Reference: `crates/adapter-open-meteo/src/lib.rs`

- No `command()` override needed.
- Maps external data to `DeviceKind::Sensor` devices.
- Each poll upserts canonical state.
- Preserves room assignment via `previous.and_then(|d| d.room_id.clone())`.

### Pattern 2: Poll + commands for multiple devices

Reference: `crates/adapter-elgato-lights/src/lib.rs`

- One adapter owns multiple vendor devices.
- Device IDs encode vendor identity (e.g. `elgato_lights:light:0`).
- `command()` parses the device ID, returns `Ok(false)` for devices it doesn't own.
- Confirms state after commands before updating the registry.
- Removes stale devices when they disappear upstream.

### Pattern 3: Poll + commands for one logical device

Reference: `crates/adapter-roku-tv/src/lib.rs`

- One adapter exposes one logical device.
- `command()` checks one stable device ID.
- Command translation is simple keypress mapping.

---

## Step-by-Step Procedure

### 1. Choose the adapter name

The name must be stable and `snake_case`.

```
open_meteo
elgato_lights
roku_tv
```

This name is used in: the config section key `[adapters.<name>]`, `AdapterFactory::name()`, `Adapter::name()`, device ID prefixes, and error messages.

Keep the crate name aligned: `crates/adapter-<name>`.

### 2. Create the crate

Create:
- `crates/adapter-<name>/Cargo.toml`
- `crates/adapter-<name>/src/lib.rs`

Typical dependencies:

```toml
[dependencies]
anyhow = "1"
async-trait = "0.1"
chrono = "0.4"
inventory = "0.3"
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
homecmdr-core = { path = "../../crates/core" }
tokio = { version = "1", features = ["time"] }
tracing = "0.1"
```

### 3. Define the config struct

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct ExampleConfig {
    pub enabled: bool,
    pub base_url: String,
    pub poll_interval_secs: u64,
}
```

Guidelines:
- Include `enabled`.
- Include a poll interval for polled integrations.
- Use `serde` defaults only when there is a clear stable default.
- Do not add adapter-specific config structs to `crates/core/src/config.rs`.

### 4. Validate config inside the adapter crate

```rust
fn validate_config(config: &ExampleConfig) -> Result<()> {
    if config.base_url.is_empty() {
        bail!("adapters.example.base_url must not be empty");
    }
    if config.poll_interval_secs < 1 {
        bail!("adapters.example.poll_interval_secs must be >= 1");
    }
    Ok(())
}
```

Error messages should name the full config path (`adapters.<name>.<field>`).

### 5. Implement the factory

```rust
pub struct ExampleFactory;
static EXAMPLE_FACTORY: ExampleFactory = ExampleFactory;

inventory::submit! {
    RegisteredAdapterFactory { factory: &EXAMPLE_FACTORY }
}

impl AdapterFactory for ExampleFactory {
    fn name(&self) -> &'static str { ADAPTER_NAME }

    fn build(&self, config: AdapterConfig) -> Result<Option<Box<dyn Adapter>>> {
        let config: ExampleConfig = serde_json::from_value(config)
            .context("failed to parse example adapter config")?;
        validate_config(&config)?;

        if !config.enabled {
            return Ok(None);
        }

        Ok(Some(Box::new(ExampleAdapter::new(config))))
    }
}
```

- `Ok(None)` = valid but disabled.
- `Err(...)` = invalid config.

### 6. Implement the adapter struct

Store fields derived from config to avoid repeated parsing:

```rust
pub struct ExampleAdapter {
    client: reqwest::Client,
    base_url: String,
    poll_interval: Duration,
}
```

### 7. Implement polling

```rust
async fn poll_once(&self, registry: &DeviceRegistry) -> Result<()> {
    let data = self.client.get(&self.base_url).send().await?.json().await?;
    let device_id = format!("{ADAPTER_NAME}:my_device");
    let previous = registry.get(&device_id);
    let device = build_device(&device_id, &data, previous.as_ref());
    registry.upsert(device).await?;
    Ok(())
}
```

When building a device:
- Preserve prior `room_id`.
- Preserve `updated_at` when state and metadata are unchanged.
- Always set `last_seen` to now on successful observation.

### 8. Implement `run()`

```rust
#[async_trait]
impl Adapter for ExampleAdapter {
    fn name(&self) -> &str { ADAPTER_NAME }

    async fn run(&self, registry: DeviceRegistry, bus: EventBus) -> Result<()> {
        bus.publish(Event::AdapterStarted {
            adapter: self.name().to_string(),
        });

        loop {
            if let Err(error) = self.poll_once(&registry).await {
                tracing::error!(error = %error, "example poll failed");
                bus.publish(Event::SystemError {
                    message: format!("example poll failed: {error}"),
                });
            }
            sleep(self.poll_interval).await;
        }
    }
}
```

`run()` must not exit. Use fixed sleep intervals after failures (current adapters do not use exponential backoff).

### 9. Implement `command()` (only if needed)

```rust
async fn command(
    &self,
    device_id: &DeviceId,
    command: DeviceCommand,
    registry: DeviceRegistry,
) -> Result<bool> {
    if !device_id.starts_with(ADAPTER_NAME) {
        return Ok(false);
    }
    // translate and apply command
    // update registry with post-command state
    Ok(true)
}
```

Commands are already validated by the core before reaching your adapter. You may add adapter-local narrowing (e.g. vendor-specific value ranges) on top of canonical validation.

### 10. Map to canonical device state

Use `DeviceKind` intentionally:

| Kind | Use for |
|---|---|
| `Sensor` | Read-only measured values |
| `Light` | Controllable lighting |
| `Switch` | Generic on/off devices |
| `Virtual` | Logical devices with no physical counterpart |

Canonical ownership rules:
- Use `device.attributes.<capability_key>` when a canonical capability covers the state.
- Use `custom.<adapter>.<field>` only for current-state attributes that don't fit the canonical catalog.
- Use `metadata.vendor_specific` for opaque upstream identifiers and descriptive metadata.
- Do not publish the same meaning in both a canonical attribute and vendor-specific data.

### 11. Handle disappearing devices

If the upstream source is authoritative, remove stale devices when they disappear:

```rust
let current_ids: HashSet<_> = fetched_devices.iter().map(|d| d.id.clone()).collect();
for stale_id in self.known_ids.difference(&current_ids) {
    registry.remove(stale_id).await?;
}
```

Do not remove devices because a single poll failed.

### 12. Add config examples

Update `config/default.toml` with a usable (and disabled by default) example section:

```toml
[adapters.example]
enabled = false
base_url = "http://127.0.0.1:9000"
poll_interval_secs = 30
```

### 13. Add workspace linkage

Update three files:

1. **Root `Cargo.toml`** — add the crate to `[workspace.members]`
2. **`crates/adapters/Cargo.toml`** — add it as a dependency
3. **`crates/adapters/src/lib.rs`** — add `use adapter_example as _;`

Without step 3, the `inventory::submit!` side effect won't run and the factory will not be registered.

### 14. Write tests

Every adapter should cover at minimum:

- Config validation (valid, invalid, disabled)
- Polling normalization (external payload → canonical device)
- Command translation (if commands exist)
- State freshness (`updated_at` stable on identical state)
- Factory `build()` behavior

**Recommended test infrastructure:** a tiny in-process mock server using `tokio::net::TcpListener` with ephemeral ports. See existing adapters for the pattern.

### 15. Verify

```bash
cargo fmt --all
cargo test -p adapter-<name> -p homecmdr-adapters
cargo check --workspace
```

---

## Full Code Template

```rust
use anyhow::{Context, Result, bail};
use async_trait::async_trait;
use homecmdr_core::adapter::{Adapter, AdapterFactory, RegisteredAdapterFactory};
use homecmdr_core::bus::EventBus;
use homecmdr_core::command::DeviceCommand;
use homecmdr_core::config::AdapterConfig;
use homecmdr_core::event::Event;
use homecmdr_core::model::DeviceId;
use homecmdr_core::registry::DeviceRegistry;
use tokio::time::{sleep, Duration};

const ADAPTER_NAME: &str = "example";

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ExampleConfig {
    pub enabled: bool,
    pub poll_interval_secs: u64,
}

pub struct ExampleFactory;
static EXAMPLE_FACTORY: ExampleFactory = ExampleFactory;

inventory::submit! {
    RegisteredAdapterFactory { factory: &EXAMPLE_FACTORY }
}

pub struct ExampleAdapter {
    poll_interval: Duration,
}

impl ExampleAdapter {
    pub fn new(config: ExampleConfig) -> Self {
        Self {
            poll_interval: Duration::from_secs(config.poll_interval_secs),
        }
    }

    async fn poll_once(&self, registry: &DeviceRegistry) -> Result<()> {
        let _ = registry;
        Ok(())
    }
}

impl AdapterFactory for ExampleFactory {
    fn name(&self) -> &'static str { ADAPTER_NAME }

    fn build(&self, config: AdapterConfig) -> Result<Option<Box<dyn Adapter>>> {
        let config: ExampleConfig = serde_json::from_value(config)
            .context("failed to parse example adapter config")?;

        if config.poll_interval_secs == 0 {
            bail!("adapters.example.poll_interval_secs must be >= 1");
        }
        if !config.enabled {
            return Ok(None);
        }

        Ok(Some(Box::new(ExampleAdapter::new(config))))
    }
}

#[async_trait]
impl Adapter for ExampleAdapter {
    fn name(&self) -> &str { ADAPTER_NAME }

    async fn run(&self, registry: DeviceRegistry, bus: EventBus) -> Result<()> {
        bus.publish(Event::AdapterStarted {
            adapter: self.name().to_string(),
        });

        loop {
            if let Err(error) = self.poll_once(&registry).await {
                bus.publish(Event::SystemError {
                    message: format!("example poll failed: {error}"),
                });
            }
            sleep(self.poll_interval).await;
        }
    }

    async fn command(
        &self,
        _device_id: &DeviceId,
        _command: DeviceCommand,
        _registry: DeviceRegistry,
    ) -> Result<bool> {
        Ok(false)
    }
}
```

---

## Common Mistakes

1. Editing `crates/api/src/main.rs` to manually instantiate your adapter.
2. Editing `crates/core/src/config.rs` to add adapter-specific config structs.
3. Using device IDs without the adapter prefix.
4. Dropping `room_id` on registry refresh.
5. Replacing `updated_at` on every poll when state is identical.
6. Returning `Err(...)` for a device ID the adapter does not own.
7. Forgetting to add `use <crate> as _;` to `crates/adapters/src/lib.rs`.
8. Adding new capabilities when an existing canonical one already covers the state.
9. Writing tests that require a fixed local port without exclusive control.
10. Putting vendor metadata into canonical attributes prematurely.

---

## Review Checklist

Before finishing an adapter, verify:

- [ ] New crate exists under `crates/adapter-<name>`
- [ ] Crate has an `AdapterFactory` registered with `inventory::submit!`
- [ ] Adapter name matches the config section key
- [ ] Adapter is linked in root `Cargo.toml`
- [ ] Adapter is linked in `crates/adapters/Cargo.toml`
- [ ] `crates/adapters/src/lib.rs` imports the crate for side-effect registration
- [ ] `config/default.toml` contains a usable example section
- [ ] Device IDs are namespaced correctly
- [ ] Room assignment is preserved across refreshes
- [ ] `updated_at` is stable for identical state
- [ ] `command()` returns `Ok(false)` for unsupported devices
- [ ] Focused tests cover polling and commands
- [ ] `cargo fmt --all` passes
- [ ] Targeted tests pass

---

## MCP Tooling

The MCP server (`crates/mcp-server`) exposes tools that assist with adapter authoring:

- **`scaffold_adapter`** — generates a new adapter crate skeleton with the correct `inventory::submit!` factory boilerplate and prints the three manual registration steps.
- **`run_cargo_check`** — runs `cargo check` on the workspace or a focused package.
- **`run_cargo_test`** — runs `cargo test` on the workspace or a focused package.
- **`list_capabilities`** — lists the canonical capability schemas the runtime knows about.

See [MCP Server](/developers/mcp-server/) for setup details.
