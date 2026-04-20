+++
title = "Dashboard"
description = "Running and extending the HomeCmdr reference dashboard — a zero-build-step Alpine.js web app."
weight = 7
template = "page.html"
+++

HomeCmdr ships a fully functional reference dashboard: [homecmdr-dash](https://github.com/homecmdr/homecmdr-dash).

It is an **independent static client** — no build step, no npm, no bundler. Serve the directory, open your browser, and you are done. Use it as-is or as the starting point for a custom interface.

---

## Prerequisites

- The HomeCmdr API running (see [quickstart](/docs/quickstart/))
- Any static file server (Python, Node, Caddy, nginx, etc.)

---

## Running the dashboard

### Step 1 — Clone the dashboard

```bash
git clone https://github.com/homecmdr/homecmdr-dash
cd homecmdr-dash
```

### Step 2 — Enable CORS in the API config

The dashboard is served from a different origin than the API. Add your dashboard origin to `config/default.toml`:

```toml
[api.cors]
enabled = true
allowed_origins = ["http://127.0.0.1:8080"]
```

Restart the API after changing config.

### Step 3 — Serve the dashboard

```bash
python -m http.server 8080
# or
npx serve . --port 8080
```

### Step 4 — Open the dashboard

```
http://127.0.0.1:8080/
```

You will be prompted for the API base URL and a bearer token. Enter your API address (e.g. `http://127.0.0.1:3001`) and your master key (or a scoped read/write key).

**Skip the prompt on every page load** by passing credentials in the URL:

```
http://127.0.0.1:8080/?api=http://127.0.0.1:3001&token=your-key
```

The token is stored in `localStorage` as `hc_token` after the first successful connection.

---

## What the dashboard shows

| Tab | Content |
|---|---|
| **Devices** | All devices grouped by room. Power toggle, brightness slider, colour temperature slider, and attribute badges per device. |
| **Weather** | Read-only sensor cards from the `open_meteo` adapter — temperature, wind speed, wind direction. |
| **Scenes** | All Lua scenes loaded by the API. Click Run to execute. |
| **Events** | Live WebSocket event feed. Newest events at the top. |

---

## File structure

```
homecmdr-dash/
├── index.html          Entry point and all HTML templates
├── css/
│   ├── base.css        Design tokens (colours, spacing, typography)
│   ├── layout.css      App shell, header, nav, responsive grid
│   └── components.css  Cards, buttons, sliders, badges, event feed
└── js/
    ├── utils.js        Formatting helpers and URL utilities
    ├── api.js          Authenticated HTTP client (createApiClient)
    ├── websocket.js    WebSocket manager with reconnect
    └── app.js          Alpine.js component (homeCmdrApp)
```

Tech stack: **Alpine.js v3** for reactive state and DOM templating, **vanilla CSS** with custom properties.

---

## Extending the dashboard

### Add a new sensor card (Weather tab)

1. Enable the device in the adapter config
2. Add its ID to `WEATHER_DEVICE_IDS` in `js/app.js`
3. Add a card block in the Weather tab section of `index.html`

### Add a new device control

1. Add a method to the returned object in `js/app.js` (see `togglePower`, `setBrightness`)
2. Add a `sendCommand` call via `js/api.js`
3. Add a control block inside the device card template in `index.html`
4. Style it in `css/components.css`

### Change the colour scheme

All colours are CSS custom properties in `css/base.css` under `:root`. Change the values there — no other file needs to change.

### Add a new tab

1. Add a nav button in `<nav class="app-nav">` in `index.html`
2. Add a `<div role="tabpanel" x-show="activeTab === 'your-tab'">` section
3. Add any new state and data loading in `js/app.js`

---

## API endpoints used by the dashboard

| Purpose | Endpoint |
|---|---|
| Load rooms | `GET /rooms` |
| Load all devices | `GET /devices` |
| Load scenes | `GET /scenes` |
| Send a device command | `POST /devices/{id}/command` |
| Execute a scene | `POST /scenes/{id}/execute` |
| Live event stream | `WS /events?token=...` |

See the full [API reference](/developers/api-reference/) for all available endpoints.
