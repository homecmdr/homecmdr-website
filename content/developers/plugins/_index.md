+++
title = "Official Plugins"
description = "Official HomeCmdr adapter plugins: Elgato Lights, Ollama, Roku TV, and Zigbee2MQTT."
sort_by = "weight"
template = "section.html"
+++

Official adapters are standalone Rust crates maintained in the [homecmdr/adapters](https://github.com/homecmdr/adapters) registry and installed into a workspace with the HomeCmdr CLI:

```bash
homecmdr pull <adapter-name>
cargo build
```

After pulling, you must also add `use <crate_name> as _;` to `crates/adapters/src/lib.rs` in your workspace.
