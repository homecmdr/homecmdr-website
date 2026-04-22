+++
title = "Official Plugins"
description = "Official HomeCmdr adapter plugins: Elgato Lights, Ollama, Roku TV, and Zigbee2MQTT."
sort_by = "weight"
template = "section.html"
+++

Official plugins are WASM binaries maintained in the [homecmdr/plugins](https://github.com/homecmdr/plugins) registry and installed into a workspace with the HomeCmdr CLI:

```bash
homecmdr plugin add <plugin-name>
```

No build step required — the CLI downloads the pre-built `.wasm` binary and `.plugin.toml` manifest, prompts for any required config values, and restarts the service if it is running.
