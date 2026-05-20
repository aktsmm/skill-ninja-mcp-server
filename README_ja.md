# Skill Ninja MCP Server 🥷

[![npm version](https://img.shields.io/npm/v/skill-ninja-mcp-server.svg)](https://www.npmjs.com/package/skill-ninja-mcp-server)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](LICENSE)

<a href="https://glama.ai/mcp/servers/@aktsmm/skill-ninja-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@aktsmm/skill-ninja-mcp-server/badge" alt="Skill Ninja MCP Server on Glama" />
</a>

[English README](README.md)

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

| 変数名                           | 説明                                       | デフォルト                         |
| -------------------------------- | ------------------------------------------ | ---------------------------------- |
| `GITHUB_TOKEN`                   | GitHub API トークン（レート制限対策）      | なし                               |
| `SKILL_NINJA_INDEX_DIR`          | インデックス保存先                         | `~/.skill-ninja`                   |
| `SKILL_NINJA_TRUSTED_WORKSPACES` | 読み書き可能な信頼済みワークスペースルート | カレントワークスペースのみ自動判定 |
| `LANG`                           | 言語設定（日本語: `ja_JP`）                | システム設定                       |

## セキュリティ

`skillNinja_install`、`skillNinja_uninstall`、`skillNinja_list`、`skillNinja_recommend` は、信頼済みワークスペース配下でのみ動作します。

- 既定では、サーバーのカレントディレクトリがプロジェクトルートらしい場合だけ、その場所を信頼済みとして扱います。
- それ以外の場所を許可するには、`SKILL_NINJA_TRUSTED_WORKSPACES` に OS のパス区切り文字で区切ったルート一覧を設定してください。
- 信頼済みルート外の `workspacePath` は、読み取り・書き込み・削除の前に拒否されます。
- GitHub API と raw content 取得には timeout を設け、ネットワーク障害で MCP サーバーが無期限に待ち続けないようにしています。

## 同名スキルの扱い

- 検索結果とおすすめ結果には、各スキルのソース名が表示されます。
- 複数ソースに同じスキル名が存在する場合、`skillNinja_install` と `skillNinja_localize` では任意の `source` を指定して対象を明示できます。
- インストール済み一覧には記録済みソースが表示され、別ソースの同名スキルで静かに上書きしないようにガードされます。
- 部分一致した skillName が複数の別スキルに一致する場合、install/localize/uninstall は先頭候補を選ばず、完全なスキル名の指定を求めます。

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

💬 "GitHub Awesome Copilot の webapp-testing をインストールして"
  → skillNinja_install で skillName="webapp-testing", source="github-awesome-copilot"

💬 "test をインストールして"
  → まず完全なスキル名に絞る（例: "test-driven-development"）

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

# リリース前検証
npm run release:verify

# ビルド
npm run build

# 開発モード
npm run dev
```

## ライセンス

CC BY-NC-SA 4.0
