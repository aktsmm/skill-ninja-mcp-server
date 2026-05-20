# Skill Ninja MCP Server 🥷

[![npm version](https://img.shields.io/npm/v/skill-ninja-mcp-server.svg)](https://www.npmjs.com/package/skill-ninja-mcp-server)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](LICENSE)

<a href="https://glama.ai/mcp/servers/@aktsmm/skill-ninja-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@aktsmm/skill-ninja-mcp-server/badge" alt="Skill Ninja MCP Server on Glama" />
</a>

[日本語版 README](README_ja.md)

An MCP (Model Context Protocol) server for searching, installing, and managing AI Agent Skills.

Works with MCP-compatible clients like Claude Desktop, Cursor, and VS Code.

## Installation

```bash
npm install -g skill-ninja-mcp-server
```

Or run it directly with npx:

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

| Variable                         | Description                                               | Default                               |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| `GITHUB_TOKEN`                   | GitHub API token for higher rate limits                   | none                                  |
| `SKILL_NINJA_INDEX_DIR`          | Skill index storage directory                             | `~/.skill-ninja`                      |
| `SKILL_NINJA_TRUSTED_WORKSPACES` | Trusted workspace roots allowed for read/write operations | auto-detect current project root only |
| `LANG`                           | Output language, for example `ja_JP`                      | system default                        |

## Security

Workspace-mutating tools only operate inside trusted workspace roots.

- By default, the server trusts the current working directory only when it looks like a project root.
- To allow other locations, set the `SKILL_NINJA_TRUSTED_WORKSPACES` environment variable to one or more trusted roots separated by your OS path delimiter.
- Requests outside trusted roots are rejected before any read, write, or delete occurs.

## Tools

| Tool                     | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `skillNinja_search`      | Search the local skill index by keyword                    |
| `skillNinja_install`     | Install a skill into a trusted workspace                   |
| `skillNinja_uninstall`   | Remove an installed skill from a trusted workspace         |
| `skillNinja_list`        | List installed skills in a trusted workspace               |
| `skillNinja_recommend`   | Recommend skills based on workspace contents               |
| `skillNinja_updateIndex` | Refresh the local skill index from registered sources      |
| `skillNinja_webSearch`   | Search GitHub for repositories containing `SKILL.md` files |
| `skillNinja_addSource`   | Add a GitHub repository as a skill source                  |
| `skillNinja_localize`    | Update localized skill descriptions in the index           |

## Usage Examples

```text
"Find skills for Azure work"
  -> skillNinja_search

"Install the docx skill"
  -> skillNinja_install

"Search GitHub for MCP skills"
  -> skillNinja_webSearch
```

## Development

```bash
git clone https://github.com/aktsmm/skill-ninja-mcp-server
cd skill-ninja-mcp-server
npm install
npm test
```

## License

CC BY-NC-SA 4.0 — see [LICENSE](LICENSE).
