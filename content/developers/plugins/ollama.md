+++
title = "Ollama"
description = "HomeCmdr adapter for Ollama: service-style Lua access to local LLM inference including vision, chat, embeddings, and generation."
weight = 2
template = "page.html"
+++

The `adapter-ollama` adapter adds service-style Lua access to a local [Ollama](https://ollama.com) instance. It does not expose any HomeCmdr devices — it is accessed entirely through `ctx:invoke(...)` from scenes and automations.

## Installation

```bash
# From your homecmdr-api workspace root
homecmdr pull adapter-ollama
cargo build
```

Then add to `crates/adapters/src/lib.rs`:

```rust
use adapter_ollama as _;
```

## Configuration

```toml
[adapters.ollama]
enabled = true
base_url = "http://127.0.0.1:11434"
model = "llava"
```

| Field | Description |
|---|---|
| `enabled` | Enable or disable the adapter |
| `base_url` | HTTP base URL of the Ollama server |
| `model` | Default model when the payload omits `model` |

## Invoke Targets

All targets are accessed via `ctx:invoke(target, payload)` in Lua.

### `ollama:generate`

Text generation.

```lua
local result = ctx:invoke("ollama:generate", {
  prompt = "Write a one-sentence weather summary.",
  model = "llama3",  -- optional, overrides config default
})
local text = result.response
```

Required: `prompt`. Optional: `model`, `suffix`, `system`, `template`, `format`, `options`, `keep_alive`, `raw`, `images`.

Response fields: `response`, `boolean`, `done`, and timing fields.

---

### `ollama:vision`

Vision reasoning with an image.

```lua
local result = ctx:invoke("ollama:vision", {
  prompt = "Reply only true or false. Are clothes on the clothesline?",
  image_base64 = snapshot_base64,
})

if result.boolean == true then
  ctx:command("elgato_lights:light:0", { capability = "power", action = "on" })
end
```

Required: `prompt`, `image_base64`. Optional: `model`, `system`, `template`, `format`, `options`, `keep_alive`, `raw`.

Response fields: `response`, `boolean`, `done`, and timing fields.

---

### `ollama:chat`

Multi-turn chat.

```lua
local result = ctx:invoke("ollama:chat", {
  messages = {
    { role = "system", content = "Be concise." },
    { role = "user",   content = "Summarize the weather in one sentence." },
  },
})
local reply = result.message.content
```

Required: `messages`. Optional: `model`, `format`, `options`, `keep_alive`, `tools`.

`messages` is a Lua list of message tables with fields: `role`, `content`, `images`, `tool_calls`, `tool_name`.

Response fields: `message`, `done`, and timing fields.

---

### `ollama:embeddings`

Generate embeddings for one or more strings.

```lua
local result = ctx:invoke("ollama:embeddings", {
  input = {
    "front door open",
    "back door open",
  },
})
-- result.embeddings is a list of numeric arrays
```

Required: `input` (string or list of strings). Optional: `model`, `keep_alive`, `options`, `truncate`.

Response: `embeddings` (nested numeric arrays).

---

### `ollama:tags`

List available models.

```lua
local result = ctx:invoke("ollama:tags", {})
-- result.models is an array of model info tables
```

No payload required.

---

### `ollama:ps`

List currently loaded models.

```lua
local result = ctx:invoke("ollama:ps", {})
```

No payload required.

---

### `ollama:show`

Show details for a model.

```lua
local result = ctx:invoke("ollama:show", {
  model = "llava",
  verbose = false,
})
```

Optional: `model`, `verbose`.

Returns the raw JSON object converted into Lua tables and lists.

---

### `ollama:version`

Return the Ollama server version.

```lua
local result = ctx:invoke("ollama:version", {})
local version = result.version
```

No payload required.

---

## Shared Helper Pattern

For repeated vision checks, a shared script module avoids duplication:

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

Usage in an automation:

```lua
local ollama = require("ollama")

if ollama.vision_bool(ctx, "Reply only true or false. Is the garage door open?", snapshot) then
  ctx:log("warn", "garage door left open")
end
```
