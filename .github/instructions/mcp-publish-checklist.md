# MCP Server 公開チェックリスト

MCPサーバーを公開する前に確認するファイル一覧。

## 必須ファイル

- [ ] `README.md` - インストール・設定手順
- [ ] `LICENSE` - MITなど
- [ ] `package.json` - name, description, repository, bin 設定
- [ ] `Dockerfile` - Glama.ai等でDocker実行を可能にする
- [ ] `.dockerignore` - 不要ファイル除外

## 外部サービス登録用

### Glama.ai (`glama.json`)

```json
{
  "$schema": "https://glama.ai/mcp/schemas/server.json",
  "name": "your-mcp-server",
  "description": "サーバーの説明",
  "repository": {
    "url": "https://github.com/owner/repo",
    "source": "github"
  },
  "runtime": "node",
  "author": { "name": "your-name" },
  "license": "MIT",
  "categories": ["developer-tools"],
  "installation": {
    "command": "npx -y your-mcp-server"
  }
}
```

## 登録手順

1. **npm publish** - npmに公開
2. **awesome-mcp-servers** - PRを作成
3. **Glama.ai** - https://glama.ai/mcp/servers でAdd Server → Claim
4. **Discord** - MCP Discordでフレア申請（任意）
