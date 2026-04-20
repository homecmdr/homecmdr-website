+++
title = "Manual installation"
description = "Install HomeCmdr without the CLI — Docker Compose or bare-metal systemd, step by step."
weight = 2
template = "page.html"
+++

If you prefer not to use the CLI, HomeCmdr can be installed manually via Docker or as a systemd service built from source.

## Docker (recommended for home servers)

### Prerequisites

- Docker Engine and Docker Compose
- Network access to your adapters (MQTT broker, local device IPs, etc.)

### Quick start

```bash
# Clone the repository
git clone https://github.com/homecmdr/homecmdr-api homecmdr
cd homecmdr

# Copy and edit the config
cp config/default.toml config/local.toml
$EDITOR config/local.toml   # set auth.master_key, adapter settings, etc.

# Build and start
docker compose up -d
```

The API listens on `http://localhost:3001` by default.

```bash
docker compose logs -f homecmdr   # stream logs
docker compose down               # stop
```

### What the compose file does

| Setting | Value |
|---|---|
| Restart policy | `unless-stopped` — survives reboots |
| Config volume | `./config` bind-mounted read-only at `/config` |
| Data volume | named Docker volume `homecmdr-data` at `/data` |
| Env vars | `HOMECMDR_CONFIG`, `HOMECMDR_DATA_DIR` |

### Storing the master key outside the config file

Create a `.env` file alongside `docker-compose.yml` (do not commit this file):

```
HOMECMDR_MASTER_KEY=your-real-secret-key
```

Then uncomment the `HOMECMDR_MASTER_KEY` line in `docker-compose.yml`.

### Updating

```bash
docker compose pull     # if using a published image
# or
docker compose build    # rebuild from source
docker compose up -d
```

The SQLite database in the named volume is preserved across updates.

---

## Bare metal / systemd

### 1. Build the binary

```bash
git clone https://github.com/homecmdr/homecmdr-api homecmdr
cd homecmdr
cargo build --release -p api
sudo cp target/release/api /usr/local/bin/homecmdr
```

### 2. Create the system user and directories

```bash
sudo useradd --system --no-create-home --shell /sbin/nologin homecmdr
sudo mkdir -p /etc/homecmdr /var/lib/homecmdr
sudo chown homecmdr:homecmdr /var/lib/homecmdr
```

### 3. Install the config

```bash
sudo cp config/default.toml /etc/homecmdr/default.toml
sudo $EDITOR /etc/homecmdr/default.toml   # set auth.master_key, adapters, etc.
sudo chmod 640 /etc/homecmdr/default.toml
sudo chown root:homecmdr /etc/homecmdr/default.toml
```

Copy Lua asset directories if you use scenes, automations, or scripts:

```bash
sudo cp -r config/scenes      /etc/homecmdr/scenes
sudo cp -r config/automations /etc/homecmdr/automations
sudo cp -r config/scripts     /etc/homecmdr/scripts
sudo chown -R homecmdr:homecmdr /etc/homecmdr/scenes \
    /etc/homecmdr/automations /etc/homecmdr/scripts
```

Update the directory paths in `/etc/homecmdr/default.toml`:

```toml
[scenes]
directory = "/etc/homecmdr/scenes"

[automations]
directory = "/etc/homecmdr/automations"

[scripts]
directory = "/etc/homecmdr/scripts"
```

### 4. Store the master key securely (optional)

Instead of putting the key in the config file, use a systemd `EnvironmentFile`:

```bash
sudo tee /etc/homecmdr/secrets.env > /dev/null <<'EOF'
HOMECMDR_MASTER_KEY=your-real-key-here
EOF
sudo chmod 600 /etc/homecmdr/secrets.env
sudo chown root:homecmdr /etc/homecmdr/secrets.env
```

Then uncomment the `EnvironmentFile` line in the unit file (step 5 below).

### 5. Install and start the systemd unit

```bash
sudo cp deploy/homecmdr.service /etc/systemd/system/homecmdr.service
sudo systemctl daemon-reload
sudo systemctl enable --now homecmdr
```

Check status and logs:

```bash
sudo systemctl status homecmdr
sudo journalctl -u homecmdr -f
```

### Updating the binary

```bash
cargo build --release -p api
sudo cp target/release/api /usr/local/bin/homecmdr
sudo systemctl restart homecmdr
```

---

## First login

Regardless of deployment method, verify the server is up:

```bash
curl -s http://localhost:3001/health
# {"status":"ok"}
```

All endpoints except `/health` and `/ready` require a Bearer token.
Use your master key to authenticate:

```bash
curl -s -H "Authorization: Bearer YOUR_MASTER_KEY" http://localhost:3001/devices
```

Create a scoped API key for scripts and automations so they do not use your master key directly:

```bash
curl -s -X POST http://localhost:3001/auth/keys \
  -H "Authorization: Bearer YOUR_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "home-scripts", "role": "write"}'
```

See [Authentication](/docs/authentication/) for the full key management reference.

---

## Running a local dev instance

Run a second instance alongside your primary one — useful for testing config changes without affecting the live system.

Create a separate config:

```bash
cp config/default.toml config/dev.toml
```

Edit `config/dev.toml` to use a different port and database:

```toml
[api]
bind_address = "127.0.0.1:3002"

[persistence]
database_url = "sqlite://data/dev-homecmdr.db"

[adapters.zigbee2mqtt]
client_id = "homecmdr-dev"   # avoids MQTT session conflicts
```

Run it:

```bash
HOMECMDR_CONFIG=config/dev.toml cargo run -p api
```

The dev instance is fully independent: separate port, separate database, separate MQTT session.
