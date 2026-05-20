import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import {
  getInstalledSkillMetadata,
  getInstalledSkills,
  installSkill,
  uninstallSkill,
  updateAgentsMd,
} from "../dist/installer.js";
import {
  getSourceKey,
  getSkillKey,
  getTrustBadge,
  mergeSkillIndexes,
} from "../dist/skillIndex.js";
import {
  buildRawGitHubFileUrl,
  normalizeGitHubRepoUrl,
  searchGitHub,
  toRawGitHubContentUrl,
} from "../dist/github.js";
import {
  addSource,
  installSkillTool,
  localizeSkill,
  recommendSkills,
  searchSkills,
  uninstallSkillTool,
} from "../dist/tools.js";

async function createWorkspace(prefix) {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return workspacePath;
}

async function withMockFetch(fetchImpl, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("rejects installs outside trusted workspace roots", async () => {
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;
  const untrustedWorkspace = await createWorkspace("skill-ninja-untrusted-");

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = process.cwd();

  await assert.rejects(
    () => installSkill("demo-skill", "# Demo", untrustedWorkspace),
    /trusted workspace root/i,
  );

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(untrustedWorkspace, { recursive: true, force: true });
});

test("allows install/list/update/uninstall inside configured trusted roots", async () => {
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;
  const trustedRoot = await createWorkspace("skill-ninja-trusted-");
  const workspacePath = path.join(trustedRoot, "workspace");
  const skillFilePath = path.join(
    workspacePath,
    ".github",
    "skills",
    "demo-skill",
    "SKILL.md",
  );

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = trustedRoot;
  await fs.mkdir(workspacePath, { recursive: true });

  const installResult = await installSkill(
    "demo-skill",
    "# Demo Skill\n",
    workspacePath,
  );
  assert.equal(installResult.success, true);
  assert.equal(await fs.readFile(skillFilePath, "utf-8"), "# Demo Skill\n");

  await updateAgentsMd(workspacePath);
  const agentsContent = await fs.readFile(
    path.join(workspacePath, "AGENTS.md"),
    "utf-8",
  );
  assert.match(agentsContent, /demo-skill/);

  const installedSkills = await getInstalledSkills(workspacePath);
  assert.deepEqual(installedSkills, ["demo-skill"]);

  const uninstallResult = await uninstallSkill("demo-skill", workspacePath);
  assert.equal(uninstallResult.success, true);
  await assert.rejects(() => fs.access(skillFilePath));

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(trustedRoot, { recursive: true, force: true });
});

test("rejects workspace analysis outside trusted roots", async () => {
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;
  const untrustedWorkspace = await createWorkspace("skill-ninja-recommend-");

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = process.cwd();
  await fs.writeFile(
    path.join(untrustedWorkspace, "package.json"),
    "{}",
    "utf-8",
  );

  await assert.rejects(
    () => recommendSkills({ workspacePath: untrustedWorkspace }),
    /trusted workspace root/i,
  );

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(untrustedWorkspace, { recursive: true, force: true });
});

test("renders a five-column search results table with source names", async () => {
  const output = await searchSkills({ query: "mcp" });

  assert.match(
    output,
    /\| Skill \| Description \| Source \| Trust \| Stars \|/,
  );

  const tableRows = output
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("|---"));

  for (const row of tableRows.slice(1)) {
    const cellCount = row.split("|").length - 2;
    assert.equal(cellCount, 5, `unexpected table format: ${row}`);
  }
});

test("requires source when installing a duplicated skill name", async () => {
  const trustedRoot = await createWorkspace("skill-ninja-install-tool-");
  const workspacePath = path.join(trustedRoot, "workspace");
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = trustedRoot;
  await fs.mkdir(workspacePath, { recursive: true });

  const result = await installSkillTool({
    skillName: "webapp-testing",
    workspacePath,
  });

  assert.match(result, /複数のソースに存在/);
  assert.match(result, /anthropics-skills|github-awesome-copilot/);

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(trustedRoot, { recursive: true, force: true });
});

test("installs the requested duplicate skill source", async () => {
  const trustedRoot = await createWorkspace("skill-ninja-install-source-");
  const workspacePath = path.join(trustedRoot, "workspace");
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = trustedRoot;
  await fs.mkdir(workspacePath, { recursive: true });

  const result = await withMockFetch(async (url) => {
    assert.equal(
      url,
      buildRawGitHubFileUrl(
        "https://github.com/github/awesome-copilot",
        "skills/webapp-testing/SKILL.md",
        "main",
      ),
    );

    return {
      ok: true,
      text: async () => "# Real Skill\n\nFetched from GitHub\n",
    };
  }, async () =>
    installSkillTool({
      skillName: "webapp-testing",
      source: "github-awesome-copilot",
      workspacePath,
    }),
  );

  assert.match(result, /GitHub Awesome Copilot \(Official\)/);
  assert.match(result, /元の SKILL\.md を取得/);
  assert.doesNotMatch(result, /最小内容を生成/);

  const metadata = await getInstalledSkillMetadata(
    workspacePath,
    "webapp-testing",
  );
  assert.equal(metadata?.source, "github-awesome-copilot");
  assert.equal(
    await fs.readFile(
      path.join(workspacePath, ".github", "skills", "webapp-testing", "SKILL.md"),
      "utf-8",
    ),
    "# Real Skill\n\nFetched from GitHub\n",
  );

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(trustedRoot, { recursive: true, force: true });
});

test("blocks installing a duplicate skill from another source over an existing install", async () => {
  const trustedRoot = await createWorkspace("skill-ninja-install-conflict-");
  const workspacePath = path.join(trustedRoot, "workspace");
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = trustedRoot;
  await fs.mkdir(workspacePath, { recursive: true });

  await withMockFetch(
    async () => ({
      ok: true,
      text: async () => "# Installed from source\n",
    }),
    async () =>
      installSkillTool({
        skillName: "webapp-testing",
        source: "anthropics-skills",
        workspacePath,
      }),
  );

  const result = await installSkillTool({
    skillName: "webapp-testing",
    source: "github-awesome-copilot",
    workspacePath,
  });

  assert.match(result, /既に別ソースからインストール/);
  assert.match(result, /Anthropic Skills \(Official\)/);

  const metadata = await getInstalledSkillMetadata(
    workspacePath,
    "webapp-testing",
  );
  assert.equal(metadata?.source, "anthropics-skills");

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(trustedRoot, { recursive: true, force: true });
});

test("requires an exact skill name when install query matches multiple skills", async () => {
  const trustedRoot = await createWorkspace("skill-ninja-ambiguous-install-");
  const workspacePath = path.join(trustedRoot, "workspace");
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = trustedRoot;
  await fs.mkdir(workspacePath, { recursive: true });

  const result = await installSkillTool({
    skillName: "test",
    workspacePath,
  });

  assert.match(result, /完全なスキル名を指定/);
  assert.match(result, /webapp-testing/);
  assert.match(result, /test-driven-development/);

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(trustedRoot, { recursive: true, force: true });
});

test("rejects ambiguous partial uninstall matches", async () => {
  const trustedRoot = await createWorkspace("skill-ninja-ambiguous-uninstall-");
  const workspacePath = path.join(trustedRoot, "workspace");
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = trustedRoot;
  await fs.mkdir(workspacePath, { recursive: true });

  await installSkill("alpha-test", "# Alpha\n", workspacePath);
  await installSkill("beta-test", "# Beta\n", workspacePath);

  const result = await uninstallSkillTool({
    skillName: "test",
    workspacePath,
  });

  assert.match(result, /複数のインストール済みスキルに一致/);
  assert.match(result, /alpha-test/);
  assert.match(result, /beta-test/);
  assert.deepEqual((await getInstalledSkills(workspacePath)).sort(), [
    "alpha-test",
    "beta-test",
  ]);

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(trustedRoot, { recursive: true, force: true });
});

test("preserves manual AGENTS.md content when skill list changes", async () => {
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;
  const trustedRoot = await createWorkspace("skill-ninja-agents-");
  const workspacePath = path.join(trustedRoot, "workspace");
  const agentsPath = path.join(workspacePath, "AGENTS.md");

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = trustedRoot;
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(
    agentsPath,
    ["# Workspace Rules", "", "Keep this manual section."].join("\n"),
    "utf-8",
  );

  await installSkill("demo-skill", "# Demo Skill\n", workspacePath);
  await updateAgentsMd(workspacePath);

  let agentsContent = await fs.readFile(agentsPath, "utf-8");
  assert.match(agentsContent, /Keep this manual section\./);
  assert.match(agentsContent, /skill-ninja:installed-skills:start/);
  assert.match(agentsContent, /demo-skill/);

  await uninstallSkill("demo-skill", workspacePath);
  await updateAgentsMd(workspacePath);

  agentsContent = await fs.readFile(agentsPath, "utf-8");
  assert.match(agentsContent, /Keep this manual section\./);
  assert.doesNotMatch(agentsContent, /skill-ninja:installed-skills:start/);

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(trustedRoot, { recursive: true, force: true });
});

test("resolves trust badges from source metadata", () => {
  const index = {
    sources: [
      {
        id: "anthropics-skills",
        name: "Anthropic Skills (Official)",
        url: "https://github.com/anthropics/skills",
        type: "official",
      },
      {
        id: "composio-awesome",
        name: "Awesome Claude Skills (ComposioHQ)",
        url: "https://github.com/ComposioHQ/awesome-claude-skills",
        type: "awesome-list",
      },
    ],
  };

  assert.equal(getTrustBadge("anthropics-skills", index), "🏢 Official");
  assert.equal(getTrustBadge("composio-awesome", index), "📋 Curated");
  assert.equal(getTrustBadge("obra-superpowers", index), "👥 Community");
});

test("keeps same skill names from different sources distinct", () => {
  const mergedIndex = mergeSkillIndexes(
    {
      version: "1.0.0",
      sources: [{ name: "local-source", url: "https://example.com/local" }],
      skills: [
        {
          name: "webapp-testing",
          source: "local-source",
          description: "Local version",
        },
      ],
    },
    {
      version: "1.1.0",
      sources: [
        { name: "official-source", url: "https://example.com/official" },
      ],
      skills: [
        {
          name: "webapp-testing",
          source: "official-source",
          description: "Official version",
        },
      ],
    },
  );

  assert.equal(mergedIndex.skills.length, 2);
  assert.equal(
    new Set(mergedIndex.skills.map((skill) => getSkillKey(skill))).size,
    2,
  );
});

test("prefers stable source ids over display names", () => {
  assert.equal(getSourceKey({ id: "owner-repo", name: "Repo" }), "owner-repo");
  assert.equal(getSourceKey({ name: "Repo Name" }), "repo name");
});

test("requires source when localizing a duplicated skill name", async () => {
  const result = await localizeSkill({
    skillName: "webapp-testing",
    description_en: "Updated description",
  });

  assert.match(result, /複数のソースに存在/);
  assert.match(result, /anthropics-skills|github-awesome-copilot/);
});

test("requires an exact skill name when localize query matches multiple skills", async () => {
  const result = await localizeSkill({
    skillName: "test",
    description_en: "Updated description",
  });

  assert.match(result, /完全なスキル名を指定/);
  assert.match(result, /webapp-testing/);
  assert.match(result, /test-driven-development/);
});

test("recommendations include source names for duplicated skills", async () => {
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;
  const trustedRoot = await createWorkspace("skill-ninja-recommend-source-");
  const workspacePath = path.join(trustedRoot, "workspace");

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = trustedRoot;
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, "AGENTS.md"),
    "# Agent Skills\n",
    "utf-8",
  );

  const output = await recommendSkills({ workspacePath });

  assert.match(
    output,
    /\| Skill \| Description \| Source \| Trust \| Reason \|/,
  );
  assert.match(
    output,
    /Anthropic Skills \(Official\)|GitHub Awesome Copilot \(Official\)/,
  );

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(trustedRoot, { recursive: true, force: true });
});

test("mergeSkillIndexes deduplicates identical sources by stable key and url", () => {
  const mergedIndex = mergeSkillIndexes(
    {
      version: "1.0.0",
      sources: [
        {
          id: "anthropics-skills",
          name: "Anthropic Skills",
          url: "https://github.com/anthropics/skills",
        },
      ],
      skills: [],
    },
    {
      version: "1.1.0",
      sources: [
        {
          id: "anthropics-skills",
          name: "Anthropic Skills (Official)",
          url: "https://github.com/anthropics/skills",
        },
      ],
      skills: [],
    },
  );

  assert.equal(mergedIndex.sources.length, 1);
});

test("converts GitHub blob URLs to raw content URLs safely", () => {
  assert.equal(
    toRawGitHubContentUrl(
      "https://github.com/example/repo/blob/main/skills/demo/SKILL.md",
    ),
    "https://raw.githubusercontent.com/example/repo/main/skills/demo/SKILL.md",
  );
  assert.equal(
    toRawGitHubContentUrl("https://github.com/example/repo/tree/main/skills"),
    null,
  );
  assert.equal(toRawGitHubContentUrl("https://example.com/file.md"), null);
});

test("normalizes GitHub repository URLs and rejects non-repository paths", () => {
  assert.equal(
    normalizeGitHubRepoUrl("owner/repo"),
    "https://github.com/owner/repo",
  );
  assert.equal(
    normalizeGitHubRepoUrl("https://github.com/owner/repo.git"),
    "https://github.com/owner/repo",
  );
  assert.throws(
    () => normalizeGitHubRepoUrl("https://github.com/owner/repo/tree/main"),
    /owner\/repo/,
  );
  assert.throws(
    () => normalizeGitHubRepoUrl("https://example.com/owner/repo"),
    /Invalid GitHub repository URL/,
  );
});

test("rejects addSource inputs that are not repository roots", async () => {
  const result = await addSource({
    repoUrl: "https://github.com/owner/repo/tree/main",
  });

  assert.match(result, /ソース追加失敗/);
  assert.match(result, /owner\/repo/);
});

test("warns when install falls back to generated content", async () => {
  const trustedRoot = await createWorkspace("skill-ninja-install-fallback-");
  const workspacePath = path.join(trustedRoot, "workspace");
  const originalTrustedRoots = process.env.SKILL_NINJA_TRUSTED_WORKSPACES;

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = trustedRoot;
  await fs.mkdir(workspacePath, { recursive: true });

  const result = await withMockFetch(
    async () => {
      throw new Error("network down");
    },
    async () =>
      installSkillTool({
        skillName: "webapp-testing",
        source: "anthropics-skills",
        workspacePath,
      }),
  );

  assert.match(result, /インデックス情報から生成/);
  assert.match(result, /最小内容を生成しました/);
  assert.equal(
    await fs.readFile(
      path.join(workspacePath, ".github", "skills", "webapp-testing", "SKILL.md"),
      "utf-8",
    ),
    "# webapp-testing\n\nTest web applications\n",
  );

  process.env.SKILL_NINJA_TRUSTED_WORKSPACES = originalTrustedRoots;
  await fs.rm(trustedRoot, { recursive: true, force: true });
});

test("GitHub searches attach a timeout signal", async () => {
  const originalFetch = globalThis.fetch;
  let capturedSignal;

  globalThis.fetch = async (_url, init) => {
    capturedSignal = init?.signal;
    return {
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    };
  };

  try {
    const results = await searchGitHub("demo");
    assert.deepEqual(results, []);
    assert.ok(capturedSignal instanceof AbortSignal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
