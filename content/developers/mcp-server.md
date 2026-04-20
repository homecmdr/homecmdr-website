+++
title = "MCP Server"
description = "HomeCmdr MCP server: stdio JSON-RPC 2.0 bridge for MCP hosts, adapter scaffolding tools, and live device control."
weight = 4
template = "page.html"
+++

HomeCmdr includes a standalone MCP server (`crates/mcp-server`) that exposes the runtime to MCP-compatible hosts such as Claude Desktop, Cursor, and other AI coding tools.

> **This page is a work in progress.** Full protocol documentation and a detailed tool reference are coming soon.

---

## Overview

The MCP server is a separate binary that communicates over **stdio using JSON-RPC 2.0** (MCP protocol version `2024-11-05`). It is launched as a subprocess by an MCP host — it does not start automatically with the API.

The API must be running before the MCP server can proxy requests to it.

---

## Starting the MCP Server

```bash
cargo run -p mcp-server -- --token <BEARER_TOKEN>
```

Options:

| Flag | Default | Description |
|---|---|---|
| `--token` | — | Bearer token for the HomeCmdr API (also settable via `HOMECMDR_TOKEN`) |
| `--api-url` | `http://127.0.0.1:3001` | Base URL of the running HomeCmdr API |
| `--workspace` | `.` | Path to the HomeCmdr API workspace root |

---

## Available Tools

| Tool | Description |
|---|---|
| `scaffold_adapter` | Generates a new adapter crate skeleton with correct factory boilerplate |
| `run_cargo_check` | Runs `cargo check` on the workspace or a focused package |
| `run_cargo_test` | Runs `cargo test` on the workspace or a focused package |
| `list_capabilities` | Lists canonical capability schemas the runtime knows about |

Device control and query tools proxy to the HTTP API with Bearer auth.

---

## MCP Host Configuration

Example configuration for Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "homecmdr": {
      "command": "cargo",
      "args": ["run", "-p", "mcp-server", "--"],
      "env": {
        "HOMECMDR_TOKEN": "your-api-key-here"
      }
    }
  }
}
```

Full configuration details and tool reference will be documented here once the MCP server reaches a stable API surface.
