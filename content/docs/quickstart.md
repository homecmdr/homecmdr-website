+++
title = "Quickstart"
description = "From a fresh install to a working HomeCmdr server with your first device in five minutes."
weight = 1
template = "page.html"
+++

This guide walks through the fastest path from a fresh install to a running HomeCmdr instance with at least one device reporting state.

If you have not installed the CLI yet, start with the [installation guide](/installation/).

## What you will have by the end

- A running HomeCmdr API server
- At least one adapter reporting device state
- A bearer token to make API calls
- (optional) The reference dashboard running in your browser

---

## 1. Initialise your workspace

```bash
homecmdr init
```

Answer the prompts:

| Prompt | What to enter |
|---|---|
| Workspace directory | Press Enter to use `~/.local/share/homecmdr/workspace/` |
| Timezone | e.g. `Europe/London` or `America/New_York` |
| Latitude / Longitude | Your approximate location (used for sunrise/sunset triggers) |
| Bind address | Press Enter for the default `127.0.0.1:3001` |
| Database backend | Press Enter for SQLite |

`init` generates a random master key and writes everything to `config/default.toml`. Make a note of the master key — you will need it to authenticate API calls.

## 2. Add your first plugin

Every device integration is a plugin. Install the ones relevant to your hardware:

```bash
homecmdr plugin add zigbee2mqtt      # MQTT-backed Zigbee devices
homecmdr plugin add elgato-lights    # Elgato Key Light / Key Light Air
homecmdr plugin add roku-tv          # Roku TV power control
homecmdr plugin add ollama           # local LLM via Ollama
```

The CLI prompts for each config value (host, port, credentials) and appends the config block to `config/default.toml`.

If you do not have any of those devices, HomeCmdr ships with the **Open-Meteo** weather adapter enabled by default — it requires no setup.

## 3. Build the binary

```bash
homecmdr build --release
```

This compiles an optimised binary with all your selected plugins linked in. The first build takes a few minutes; subsequent builds are faster.

## 4. Start the server

For a quick test run without the systemd service:

```bash
homecmdr-api --config ~/.local/share/homecmdr/workspace/config/default.toml
```

Or from inside the workspace directory:

```bash
cargo run -p api
```

## 5. Verify it is running

```bash
curl http://127.0.0.1:3001/health
# {"status":"ok"}
```

List devices (replace `YOUR_MASTER_KEY` with your generated key):

```bash
curl -H "Authorization: Bearer YOUR_MASTER_KEY" http://127.0.0.1:3001/devices
```

You should see device objects from your configured adapters within a few seconds of startup.

## 6. (optional) Run the dashboard

Clone the reference dashboard and serve it:

```bash
git clone https://github.com/homecmdr/homecmdr-dash
cd homecmdr-dash
python -m http.server 8080
```

Enable CORS in your API config so the dashboard can connect:

```toml
[api.cors]
enabled = true
allowed_origins = ["http://127.0.0.1:8080"]
```

Restart the API, then open `http://127.0.0.1:8080/` and enter your API URL and master key when prompted.

## 7. Deploy as a service

Once you are happy with your setup:

```bash
homecmdr service install
```

The server will now start automatically on boot. See [Installation](/installation/) for full service management details.

---

## Next steps

- [Configuration reference](/docs/configuration/) — all config file options explained
- [Rooms and devices](/docs/rooms-and-devices/) — organise your devices into rooms
- [Scenes](/docs/scenes/) — write Lua scenes for one-click device control
- [Automations](/docs/automations/) — trigger actions based on events and schedules
