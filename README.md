# Skill Ninja MCP Server 🥷

[![npm version](https://img.shields.io/npm/v/skill-ninja-mcp-server.svg)](https://www.npmjs.com/package/skill-ninja-mcp-server)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

[日本語版 README](README_ja.md)

An MCP (Model Context Protocol) server for searching, installing, and managing AI Agent Skills.

Works with MCP-compatible clients like Claude Desktop, Cursor, and VS Code.

## Features

- 🔍 Search skills by keyword from 140+ pre-indexed skills
- 📥 Install skills to workspace (`.github/skills/`)
- 📋 List installed skills
- 💡 Get personalized recommendations based on workspace analysis
- 🌐 Search GitHub for new skills
- ➕ Add new skill sources

## Installation

```bash
npm install -g skill-ninja-mcp-server
```

Or run directly with npx:

```bash
npx skill-ninja-mcp-server
```

## Configuration

### Claude Desktop

`~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skill-ninja": {
      "command": "npx",
      "args": ["skill-ninja-mcp-server"]
    }
  }
}
```

### VS Code (mcp.json)

`%APPDATA%\Code\User\mcp.json`:

```json
{
  "servers": {
    "skill-ninja": {
      "command": "npx",
      "args": ["skill-ninja-mcp-server"]
    }
  }
}
```

## Environment Variables

| Variable                | Description                        | Default          |
| ----------------------- | ---------------------------------- | ---------------- |
| `GITHUB_TOKEN`          | GitHub API token (for rate limits) | None             |
| `SKILL_NINJA_INDEX_DIR` | Index storage directory            | `~/.skill-ninja` |
| `LANG`                  | Language setting (e.g., `ja_JP`)   | System default   |

## Available Tools

| Tool                     | Description                    |
| ------------------------ | ------------------------------ |
| `skillNinja_search`      | Search skills by keyword       |
| `skillNinja_install`     | Install a skill to workspace   |
| `skillNinja_uninstall`   | Uninstall a skill              |
| `skillNinja_list`        | List installed skills          |
| `skillNinja_recommend`   | Get popular skill recommendations |
| `skillNinja_updateIndex` | Update the skill index         |
| `skillNinja_webSearch`   | Search skills on GitHub        |
| `skillNinja_addSource`   | Add a new skill source         |
| `skillNinja_localize`    | Translate skill descriptions   |

## Usage Examples

```
💬 "Find Azure-related skills"
   → Calls skillNinja_search

💬 "Install the bicep-mcp skill"
   → Installs via skillNinja_install

💬 "Search GitHub for MCP servers"
   → Searches via skillNinja_webSearch
```

## Development

```bash
# Clone
git clone https://github.com/aktsmm/skill-ninja-mcp-server
cd skill-ninja-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## License

MIT
