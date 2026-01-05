# Skill Ninja MCP Server 🥷

Agent Skill の検索・インストール・管理を行う MCP (Model Context Protocol) サーバー。

Claude Desktop、Cursor、VS Code など MCP 対応クライアントで使用可能。

## インストール

```bash
npm install -g skill-ninja-mcp-server
```

または npx で直接実行:

```bash
npx skill-ninja-mcp-server
```

## 設定

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

## 環境変数

| 変数名                  | 説明                                  | デフォルト       |
| ----------------------- | ------------------------------------- | ---------------- |
| `GITHUB_TOKEN`          | GitHub API トークン（レート制限対策） | なし             |
| `SKILL_NINJA_INDEX_DIR` | インデックス保存先                    | `~/.skill-ninja` |
| `LANG`                  | 言語設定（日本語: `ja_JP`）           | システム設定     |

## ツール一覧

| Tool                     | Description                |
| ------------------------ | -------------------------- |
| `skillNinja_search`      | キーワードでスキル検索     |
| `skillNinja_install`     | スキルをインストール       |
| `skillNinja_uninstall`   | スキルをアンインストール   |
| `skillNinja_list`        | インストール済みスキル一覧 |
| `skillNinja_recommend`   | 人気スキルのおすすめ       |
| `skillNinja_updateIndex` | インデックスを更新         |
| `skillNinja_webSearch`   | GitHub でスキルを検索      |
| `skillNinja_addSource`   | スキルソースを追加         |
| `skillNinja_localize`    | スキル説明を翻訳           |

## 使用例

```
💬 "Azure 関連のスキルを探して"
   → skillNinja_search が呼び出される

💬 "bicep-mcp スキルをインストールして"
   → skillNinja_install でインストール

💬 "GitHub で MCP サーバーを検索"
   → skillNinja_webSearch で検索
```

## 開発

```bash
# クローン
git clone https://github.com/aktsmm/skill-ninja-mcp-server
cd skill-ninja-mcp-server

# 依存関係インストール
npm install

# ビルド
npm run build

# 開発モード
npm run dev
```

## ライセンス

MIT
