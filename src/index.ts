#!/usr/bin/env node
/**
 * Skill Ninja MCP Server
 * Agent Skill の検索・インストール・管理を行う MCP サーバー
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  searchSkills,
  installSkillTool,
  uninstallSkillTool,
  listSkills,
  recommendSkills,
  updateIndex,
  webSearchSkills,
  addSource,
  localizeSkill,
} from "./tools.js";

// ===== ツール定義 =====

const TOOLS = [
  {
    name: "skillNinja_search",
    description:
      "Search for Agent Skills by keyword. Returns matching skills with trust badges and recommendations. / キーワードでエージェントスキルを検索",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (skill name, description, or category)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "skillNinja_install",
    description:
      "Install an Agent Skill to the workspace. Downloads SKILL.md when source content is resolvable, otherwise generates a minimal stub and updates AGENTS.md. / スキルをワークスペースにインストールし、取得できる場合は SKILL.md を保存、できない場合は最小内容を生成",
    inputSchema: {
      type: "object" as const,
      properties: {
        skillName: {
          type: "string",
          description: "Name of the skill to install",
        },
        source: {
          type: "string",
          description:
            "Optional source key for disambiguation when multiple skills share the same name",
        },
        workspacePath: {
          type: "string",
          description: "Absolute path to a trusted workspace directory",
        },
      },
      required: ["skillName", "workspacePath"],
    },
  },
  {
    name: "skillNinja_uninstall",
    description:
      "Uninstall an Agent Skill from the workspace. Removes skill folder and updates AGENTS.md. / スキルをアンインストール",
    inputSchema: {
      type: "object" as const,
      properties: {
        skillName: {
          type: "string",
          description: "Name of the skill to uninstall",
        },
        workspacePath: {
          type: "string",
          description: "Absolute path to a trusted workspace directory",
        },
      },
      required: ["skillName", "workspacePath"],
    },
  },
  {
    name: "skillNinja_list",
    description:
      "List all installed Agent Skills in the workspace. / インストール済みスキル一覧を表示",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspacePath: {
          type: "string",
          description: "Absolute path to a trusted workspace directory",
        },
      },
      required: ["workspacePath"],
    },
  },
  {
    name: "skillNinja_recommend",
    description:
      "Get skill recommendations based on popularity. / 人気スキルのおすすめを取得",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspacePath: {
          type: "string",
          description: "Absolute path to a trusted workspace directory",
        },
      },
      required: ["workspacePath"],
    },
  },
  {
    name: "skillNinja_updateIndex",
    description:
      "Update the skill index from all registered sources. Fetches latest skills from GitHub repositories. / スキルインデックスを更新",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "skillNinja_webSearch",
    description:
      "Search for Agent Skills on GitHub. Finds SKILL.md files across GitHub repositories. / GitHub でスキルを検索",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query for GitHub",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "skillNinja_addSource",
    description:
      "Add a new GitHub repository as a skill source. Repository should contain SKILL.md files. / 新しいリポジトリをスキルソースとして追加",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl: {
          type: "string",
          description:
            "GitHub repository URL (e.g., 'https://github.com/owner/repo' or 'owner/repo')",
        },
      },
      required: ["repoUrl"],
    },
  },
  {
    name: "skillNinja_localize",
    description:
      "Translate/localize skill descriptions in the index. Provide skillName and description_en and/or description_ja. / スキル説明を翻訳・ローカライズ",
    inputSchema: {
      type: "object" as const,
      properties: {
        skillName: {
          type: "string",
          description: "Name of the skill to localize",
        },
        source: {
          type: "string",
          description:
            "Optional source key for disambiguation when multiple skills share the same name",
        },
        description_en: {
          type: "string",
          description: "English description for the skill",
        },
        description_ja: {
          type: "string",
          description: "Japanese description for the skill (日本語の説明)",
        },
      },
      required: ["skillName"],
    },
  },
];

// ===== サーバー初期化 =====

const server = new Server(
  {
    name: "skill-ninja-mcp-server",
    version: "0.1.4",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ===== ハンドラ登録 =====

// ツール一覧
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// ツール実行
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case "skillNinja_search":
        result = await searchSkills(args as { query: string });
        break;

      case "skillNinja_install":
        result = await installSkillTool(
          args as { skillName: string; workspacePath: string; source?: string },
        );
        break;

      case "skillNinja_uninstall":
        result = await uninstallSkillTool(
          args as { skillName: string; workspacePath: string },
        );
        break;

      case "skillNinja_list":
        result = await listSkills(args as { workspacePath: string });
        break;

      case "skillNinja_recommend":
        result = await recommendSkills(args as { workspacePath: string });
        break;

      case "skillNinja_updateIndex":
        result = await updateIndex();
        break;

      case "skillNinja_webSearch":
        result = await webSearchSkills(args as { query: string });
        break;

      case "skillNinja_addSource":
        result = await addSource(args as { repoUrl: string });
        break;

      case "skillNinja_localize":
        result = await localizeSkill(
          args as {
            skillName: string;
            source?: string;
            description_en?: string;
            description_ja?: string;
          },
        );
        break;

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: result }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// ===== サーバー起動 =====

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Skill Ninja MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
