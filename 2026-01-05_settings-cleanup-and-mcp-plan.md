# セッションエクスポート

```yaml
session:
  meta:
    date: "2026-01-05"
    project: "Ag-Ext-Skill-NINJA"
    summary: "VS Code設定ファイルの整理、グローバル指示ファイルのリネーム、azure-updates MCP設定追加、MCP サーバー化計画の策定"

  # ===== 成果物 =====
  accomplishments:
    - what: "グローバル指示ファイルをリネーム"
      files: ["C:\\Users\\vainf\\.aitk\\instructions\\global.instructions.md"]
      detail: "codeGeneration.instructions.md → global.instructions.md（内容がコード生成に特化していないため）"

    - what: "azure-updates MCP の記述を追加"
      files: ["C:\\Users\\vainf\\.aitk\\instructions\\global.instructions.md"]
      detail: "「Azure の最新アップデート情報は #azure-updates.mcp を参照。」を追加"

    - what: "mcp.json に azure-updates を追加"
      files: ["C:\\Users\\vainf\\AppData\\Roaming\\Code\\User\\mcp.json"]
      detail: "settings.json ではなく mcp.json で MCP サーバーを管理するよう統一"

    - what: "settings.json から MCP サーバー定義を削除"
      files: ["C:\\Users\\vainf\\AppData\\Roaming\\Code\\User\\settings.json"]
      detail: "chat.mcp.servers を削除し、mcp.json への参照コメントを追加"

    - what: "URL 自動承認を全て true に統一"
      files: ["C:\\Users\\vainf\\AppData\\Roaming\\Code\\User\\settings.json"]
      detail: "chat.tools.urls.autoApprove の個別設定をすべて true に簡略化"

  # ===== 収集した知識 =====
  knowledge:
    snippets:
      - name: "VS Code MCP サーバー設定場所"
        code: |
          # MCP 専用設定ファイル（推奨）
          %APPDATA%\Code\User\mcp.json

          # 従来の設定方法（非推奨）
          settings.json の chat.mcp.servers
        usage: "mcp.json があれば settings.json の MCP 設定は不要"

      - name: "指示ファイルの命名規則"
        code: |
          <任意の名前>.instructions.md
          
          # 例
          global.instructions.md    # ✅
          python.instructions.md    # ✅
          guidelines.md             # ❌（.instructions.md が必要）
        usage: "chat.instructionsFilesLocations で指定したフォルダ内の *.instructions.md が自動読み込み"

    patterns:
      - name: "MCP 設定の管理方針"
        description: "mcp.json に統一し、settings.json には autostart/serverSampling のみ残す"

      - name: "グローバル指示ファイル配置"
        description: "~/.aitk/instructions/ に配置し、全ワークスペースで共通ルールを適用"

    keywords:
      - "VS Code MCP"
      - "mcp.json"
      - "chat.instructionsFilesLocations"
      - ".instructions.md"
      - "azure-updates-mcp-server"

  # ===== 参考URL =====
  references:
    - url: "https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview"
      title: "What is Azure Functions?"
      purpose: "Azure Functions の概要説明に使用"

  # ===== 次回継続用 =====
  continuation:
    current_state: "VS Code 設定整理完了、Agent Skill Ninja の MCP サーバー化は未着手"
    pending:
      - task: "Agent Skill Ninja を MCP サーバーとして公開"
        context: |
          現在は VS Code 拡張機能として languageModelTools で実装
          スタンドアロン MCP サーバーにすれば Claude Desktop/Cursor 等でも使用可能
          新規プロジェクト skill-ninja-mcp-server として mcpTools.ts のロジックを移植予定
    next_actions:
      - "skill-ninja-mcp-server プロジェクトを新規作成"
      - "mcpTools.ts のロジックを MCP SDK 形式に移植"
      - "npm パッケージとして公開（npx 対応）"
    open_questions:
      - "Claude Desktop/Cursor 等でのスキルインデックス保存場所をどうするか"

  # ===== ブログネタ候補 =====
  blog_seeds:
    - title: "VS Code の MCP 設定を mcp.json に統一する"
      category: "Tips"
      hook: "settings.json と mcp.json 両方に書いてて混乱してませんか？"

    - title: "GitHub Copilot のグローバル指示ファイル設定術"
      category: "Tips"
      hook: ".aitk/instructions/ で全プロジェクト共通のAI指示を設定する方法"

    - title: "VS Code 拡張機能を MCP サーバー化する"
      category: "作ってみた"
      hook: "languageModelTools から MCP SDK への移行ガイド"
```
