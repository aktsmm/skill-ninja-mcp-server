import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import {
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
import { recommendSkills, searchSkills } from "../dist/tools.js";

async function createWorkspace(prefix) {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return workspacePath;
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

test("renders a five-column search results table", async () => {
  const output = await searchSkills({ query: "mcp" });

  assert.match(
    output,
    /\| Skill \| Description \| Categories \| Trust \| Stars \|/,
  );

  const tableRows = output
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("|---"));

  for (const row of tableRows.slice(1)) {
    const cellCount = row.split("|").length - 2;
    assert.equal(cellCount, 5, `unexpected table format: ${row}`);
  }
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
