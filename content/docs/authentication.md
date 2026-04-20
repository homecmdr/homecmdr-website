+++
title = "Authentication"
description = "Master key setup, bearer tokens, API key creation and management, and role-based access control."
weight = 6
template = "page.html"
+++

All HomeCmdr API endpoints — except `GET /health` and `GET /ready` — require a Bearer token in the `Authorization` header.

```
Authorization: Bearer <token>
```

---

## Master key

The master key is the root credential for your HomeCmdr instance. Set it in `config/default.toml`:

```toml
[auth]
master_key = "your-strong-key-here"
```

Or override it at runtime via environment variable (takes precedence over config):

```bash
HOMECMDR_MASTER_KEY=your-strong-key-here
```

The master key always grants full admin access. Use it for initial setup and API key management, then create scoped keys for day-to-day automation use.

Generate a strong key (32+ random bytes is recommended):

```bash
openssl rand -hex 32
```

---

## Roles

| Role | Access |
|---|---|
| `read` | All GET endpoints and the WebSocket event stream |
| `write` | Read + all mutation endpoints (commands, rooms, groups, scenes) |
| `admin` | Administrative endpoints (diagnostics, reload, key management) |
| `automation` | Admin + Automation — intended for automation scripts that need to trigger scenes and manage devices |

The master key always grants `admin` access.

---

## API key management

### Create a key

```bash
curl -X POST http://localhost:3001/auth/keys \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "home-scripts", "role": "write"}'
```

Response:

```json
{
  "id": "key_abc123",
  "label": "home-scripts",
  "role": "write",
  "key": "hc_abc123...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

The `key` value is only shown once. Store it securely.

### List keys

```bash
curl -H "Authorization: Bearer $MASTER_KEY" http://localhost:3001/auth/keys
```

Key values are not returned in this listing — only ID, label, role, and creation time.

### Delete a key

```bash
curl -X DELETE http://localhost:3001/auth/keys/key_abc123 \
  -H "Authorization: Bearer $MASTER_KEY"
```

---

## Recommended key strategy

| Use case | Role |
|---|---|
| First-time setup, key management | Master key |
| Dashboard (read-only view) | `read` |
| Dashboard (full control) | `write` |
| Automation scripts | `write` or `automation` |
| Admin tasks (reload, diagnostics) | `admin` or master key |

Use environment variables or a secrets manager to store non-master keys in scripts — never hard-code them in automation files that might be committed to version control.

---

## CORS for browser clients

If you are running the dashboard (or any browser client) from a different origin than the API, enable CORS in your config:

```toml
[api.cors]
enabled = true
allowed_origins = ["http://127.0.0.1:8080", "http://192.168.1.50:8080"]
```

Only explicit origins are accepted — wildcard (`*`) is not supported.

---

## Using tokens in the dashboard

The reference dashboard stores your token in `localStorage` under the key `hc_token` after your first successful connection. You can also pass it in the URL to skip the login prompt:

```
http://127.0.0.1:8080/?api=http://127.0.0.1:3001&token=your-key
```

---

## Securing the master key in systemd

Instead of putting the key in the config file directly, use a systemd `EnvironmentFile`:

```bash
sudo tee /etc/homecmdr/secrets.env > /dev/null <<'EOF'
HOMECMDR_MASTER_KEY=your-real-key-here
EOF
sudo chmod 600 /etc/homecmdr/secrets.env
sudo chown root:homecmdr /etc/homecmdr/secrets.env
```

Reference it in the unit file:

```ini
[Service]
EnvironmentFile=/etc/homecmdr/secrets.env
```

The systemd service installed by `homecmdr service install` includes this `EnvironmentFile` line commented out — uncomment it to activate.
