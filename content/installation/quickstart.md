+++
title = "Install with the CLI"
description = "The recommended way to install HomeCmdr — one curl command to get the CLI, then a handful of guided prompts to set up your server."
weight = 1
template = "page.html"
+++

The HomeCmdr CLI is the recommended installation path. It handles everything:
downloading the API source, interactive configuration, adding plugins, compiling the binary,
and deploying under systemd. No manual workspace cloning or `Cargo.toml` editing required.

## Prerequisites

- **Linux with systemd** — Debian, Ubuntu, Raspberry Pi OS, Fedora, Arch, and derivatives all work
- **Rust toolchain** — required to build the API binary; install from [rustup.rs](https://rustup.rs/)
- **`sudo` access** — only needed at deploy time for the systemd install step

HomeCmdr plugins are compile-time Rust crates linked into the API binary at build time.
A local Rust toolchain is needed to build and customise the server,
but the CLI itself ships as a pre-built binary.

## Step 1 — Install the CLI

```bash
curl -sSf https://raw.githubusercontent.com/homecmdr/homecmdr-cli/main/install.sh | bash
```

The installer detects your architecture automatically:

| Architecture | Example hardware |
|---|---|
| `x86_64` | Standard PC or server |
| `aarch64` | Raspberry Pi 4/5, most 64-bit ARM SBCs |
| `armv7` | Raspberry Pi 2/3 (32-bit OS) |

The `homecmdr` binary is placed in `~/.local/bin/`. Make sure that directory is on your `PATH`.
The installer prints a reminder if it is not.

Alternatively, if you already have Cargo:

```bash
cargo install --git https://github.com/homecmdr/homecmdr-cli
```

## Step 2 — Initialise your workspace

```bash
homecmdr init
```

This command:

1. Downloads the `homecmdr-api` source into `~/.local/share/homecmdr/workspace/` (or a path you choose with `--dir`)
2. Runs interactive prompts for timezone, location (latitude/longitude for solar triggers), bind address, and database backend
3. Generates a random master key and writes it to `config/default.toml`
4. Offers to build the debug binary immediately

You can re-run `homecmdr init --force` to regenerate config while preserving your workspace.

## Step 3 — Add plugins

```bash
homecmdr plugin add zigbee2mqtt
homecmdr plugin add elgato-lights
```

For each plugin, the CLI:

1. Fetches the plugin from the [official registry](https://github.com/homecmdr/adapters)
2. Extracts the crate into your workspace
3. Patches the necessary `Cargo.toml` files automatically
4. Prompts interactively for every config value (host, credentials, poll interval, etc.)
5. Appends the completed config block to `config/default.toml`
6. Rebuilds the binary

Accepted formats: short name (`zigbee2mqtt`) or full name (`adapter-zigbee2mqtt`).

See [available plugins](/developers/plugins/) for the full list.

## Step 4 — Build a release binary

```bash
homecmdr build --release
```

This compiles an optimised binary and installs it to `/usr/local/bin/homecmdr`.
It automatically restarts the systemd service if it is already running.

Without `--release`, a debug build is produced at `target/debug/api` for development use.

## Step 5 — Install as a systemd service

```bash
homecmdr service install
```

This command:

1. Creates the `homecmdr` system user
2. Creates `/etc/homecmdr/` and `/var/lib/homecmdr/`
3. Copies and patches `config/default.toml` (rewrites relative paths to absolute)
4. Copies your scenes, automations, and scripts directories
5. Writes and enables `/etc/systemd/system/homecmdr.service`
6. Starts the service immediately

Check it started cleanly:

```bash
homecmdr service logs
```

Or with systemctl directly:

```bash
sudo systemctl status homecmdr
sudo journalctl -u homecmdr -f
```

## Verifying the installation

```bash
curl -s http://localhost:3001/health
```

Should return `{"status":"ok"}`. All other endpoints require a Bearer token — use your master key:

```bash
curl -s -H "Authorization: Bearer YOUR_MASTER_KEY" http://localhost:3001/devices
```

## Service management

```bash
homecmdr service start
homecmdr service stop
homecmdr service restart
homecmdr service status
homecmdr service logs
```

## Updating

To update to a newer version of the API:

```bash
homecmdr build --release   # pulls latest source and rebuilds
```

The service is restarted automatically after a successful release build.

## Managing plugins

```bash
homecmdr plugin list                 # installed and available plugins
homecmdr plugin add <name>           # add a plugin
homecmdr plugin remove <name>        # remove a plugin
```

`plugin remove` reverses everything `plugin add` did: unpatches workspace files,
removes the config block from `config/default.toml`, deletes the crate directory, and rebuilds.

## Uninstalling the service

```bash
homecmdr service uninstall
```

Stops, disables, and removes the systemd unit.
Config files in `/etc/homecmdr/` and data in `/var/lib/homecmdr/` are preserved.
