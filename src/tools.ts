/**
 * MCP Tools Implementation
 * 各ツールの実装
 */
import {
  Skill,
  getSkillKey,
  getSourceKey,
  loadSkillIndex,
  saveSkillIndex,
  clearCache,
  getLocalizedDescription,
  getTrustBadge,
  getIndexUpdateInfo,
  getSourceStats,
} from "./skillIndex.js";
import {
  searchGitHub,
  fetchSkillFiles,
  getRepoInfo,
  toRawGitHubContentUrl,
} from "./github.js";
import {
  getInstalledSkillMetadata,
  installSkill,
  uninstallSkill,
  getInstalledSkills,
  updateAgentsMd,
} from "./installer.js";
import { resolveTrustedWorkspacePath } from "./workspace.js";

// ===== ツール入力型定義 =====

export interface SearchInput {
  query: string;
}

export interface InstallInput {
  skillName: string;
  workspacePath: string;
  source?: string;
}

export interface UninstallInput {
  skillName: string;
  workspacePath: string;
}

export interface ListInput {
  workspacePath: string;
}

export interface RecommendInput {
  workspacePath: string;
}

export interface WebSearchInput {
  query: string;
}

export interface AddSourceInput {
  repoUrl: string;
}

export interface LocalizeInput {
  skillName: string;
  source?: string;
  description_en?: string;
  description_ja?: string;
}

// ===== 環境設定 =====

function isJapanese(): boolean {
  const lang = process.env.LANG || process.env.LANGUAGE || "";
  return lang.toLowerCase().startsWith("ja");
}

function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

function createSourceId(repoUrl: string): string {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (!match) {
    return repoUrl
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return `${match[1]}-${match[2].replace(/\.git$/i, "")}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSourceDisplayName(
  sourceKey: string | undefined,
  index: {
    sources: Array<{ id?: string; name: string }>;
  },
): string {
  if (!sourceKey) {
    return "Unknown";
  }

  const lowerSourceKey = sourceKey.toLowerCase();
  const sourceInfo = index.sources.find(
    (source) => getSourceKey(source) === lowerSourceKey,
  );

  return sourceInfo?.name || sourceKey;
}

function resolveSkillCandidates(
  skills: Skill[],
  skillName: string,
  source?: string,
): Skill[] {
  const lowerName = skillName.toLowerCase();
  const lowerSource = source?.toLowerCase();

  const sourceMatches = skills.filter((skill) => {
    if (!lowerSource) {
      return true;
    }

    return (skill.source || "").toLowerCase() === lowerSource;
  });

  const exactMatches = sourceMatches.filter(
    (skill) => skill.name.toLowerCase() === lowerName,
  );
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return sourceMatches.filter((skill) =>
    skill.name.toLowerCase().includes(lowerName),
  );
}

function formatSkillChoices(
  skills: Skill[],
  index: { sources: Array<{ id?: string; name: string }> },
): string {
  return skills
    .map(
      (skill) =>
        `- ${skill.name} (${getSourceDisplayName(skill.source, index)} / ${skill.source || "unknown"})`,
    )
    .join("\n");
}

function hasSingleExactSkillName(skills: Skill[], requestedName: string): boolean {
  const lowerName = requestedName.toLowerCase();
  return skills.every((skill) => skill.name.toLowerCase() === lowerName);
}

function resolveInstalledSkillName(
  installedSkills: string[],
  requestedName: string,
): { matchedSkill?: string; ambiguousMatches?: string[] } {
  const lowerName = requestedName.toLowerCase();
  const exactMatch = installedSkills.find(
    (name) => name.toLowerCase() === lowerName,
  );

  if (exactMatch) {
    return { matchedSkill: exactMatch };
  }

  const partialMatches = installedSkills.filter((name) =>
    name.toLowerCase().includes(lowerName),
  );

  if (partialMatches.length === 1) {
    return { matchedSkill: partialMatches[0] };
  }

  if (partialMatches.length > 1) {
    return { ambiguousMatches: partialMatches };
  }

  return {};
}

// ===== ツール実装 =====

/**
 * スキル検索
 */
export async function searchSkills(input: SearchInput): Promise<string> {
  const { query } = input;
  const index = await loadSkillIndex();
  const skills = index.skills;
  const lowerQuery = query.toLowerCase();

  const updateInfo = getIndexUpdateInfo(index);
  const sourceStats = getSourceStats(index);

  // スキルをフィルタリング
  const results = skills
    .filter(
      (skill: Skill) =>
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description?.toLowerCase().includes(lowerQuery) ||
        skill.categories?.some((cat: string) =>
          cat.toLowerCase().includes(lowerQuery),
        ),
    )
    .slice(0, 10);

  if (results.length === 0) {
    return `🔎 ${sourceStats}から検索しました（最終更新: ${updateInfo.lastUpdated}）
${updateInfo.warning}

"${query}" に該当するスキルが見つかりませんでした。

💡 **ヒント:** GitHub には多くのスキルがあります！

---
**Agent Instructions (MUST FOLLOW):**
- Suggest searching GitHub for more skills
- If user wants, use skillNinja_webSearch to find skills on GitHub
- Then use skillNinja_addSource to add the repository

**次のアクション:**
1. 🌐 **GitHub で検索**: skillNinja_webSearch で "${query}" を探す
2. 🔍 別のキーワードで検索: skillNinja_search
3. 🔄 インデックス更新: skillNinja_updateIndex`;
  }

  // 結果をフォーマット
  const isJa = isJapanese();
  const formatted = results
    .map((skill: Skill) => {
      const stars = skill.stars ? `⭐${skill.stars}` : "-";
      const categories = skill.categories?.join(", ") || "";
      const trust = getTrustBadge(skill.source || "", index);
      const desc = getLocalizedDescription(skill, isJa);
      const sourceName = getSourceDisplayName(skill.source, index);
      return `| ${skill.name} | ${
        desc || "説明なし"
      } | ${sourceName} | ${trust} | ${stars} |`;
    })
    .join("\n");

  // おすすめを選定
  const recommended = [...results].sort((a: Skill, b: Skill) => {
    const aOfficial = getTrustBadge(a.source || "", index).includes("Official")
      ? 1
      : 0;
    const bOfficial = getTrustBadge(b.source || "", index).includes("Official")
      ? 1
      : 0;
    if (aOfficial !== bOfficial) return bOfficial - aOfficial;
    return (b.stars || 0) - (a.stars || 0);
  })[0];

  const recommendSection = recommended
    ? `\n### 🌟 おすすめ: ${recommended.name}\n${
        getLocalizedDescription(recommended, isJa) || ""
      } (${getTrustBadge(recommended.source || "", index)})\n`
    : "";

  return `🔎 ${sourceStats}から検索しました（最終更新: ${
    updateInfo.lastUpdated
  }）
${updateInfo.warning}

"${query}" の検索結果: ${results.length} 件

| Skill | Description | Source | Trust | Stars |
|-------|-------------|--------|-------|-------|
${formatted}
${recommendSection}
---
**Agent Instructions (MUST FOLLOW):**
- Show the table above to user in a clean format
- Highlight the 🌟 recommended skill
- ⚠️ Community skills (👥): warn users to use at their own risk
- **Ask user which skill to install and include source when duplicate names exist**
${
  updateInfo.isOutdated
    ? "- ⚠️ Index is outdated! Strongly suggest updating."
    : ""
}

**次のアクション:**
1. 📦 インストール: skillNinja_install でスキル名を指定
2. 🔍 別のキーワードで検索: skillNinja_search
3. 🌐 GitHub で探す: skillNinja_webSearch`;
}

/**
 * スキルインストール
 */
export async function installSkillTool(input: InstallInput): Promise<string> {
  const { skillName, workspacePath, source } = input;
  const trustedWorkspacePath = await resolveTrustedWorkspacePath(workspacePath);
  const index = await loadSkillIndex();

  const matchedSkills = resolveSkillCandidates(index.skills, skillName, source);

  if (matchedSkills.length === 0) {
    return `❌ スキル "${skillName}" が見つかりません。

**次のアクション:**
1. 検索: skillNinja_search
2. スペルを確認${source ? `\n3. source 値を確認: ${source}` : ""}`;
  }

  const exactMatches = matchedSkills.filter(
    (skill) => skill.name.toLowerCase() === skillName.toLowerCase(),
  );
  const disambiguationPool =
    exactMatches.length > 0 ? exactMatches : matchedSkills;

  if (!source && disambiguationPool.length > 1) {
    if (!hasSingleExactSkillName(disambiguationPool, skillName)) {
      return `❌ スキル "${skillName}" は複数の候補に一致します。完全なスキル名を指定してください。

候補:
${formatSkillChoices(disambiguationPool, index)}

**次のアクション:**
1. 完全な skillName で再実行
2. 検索結果を確認: skillNinja_search`;
    }

    return `❌ スキル "${skillName}" は複数のソースに存在します。source を指定してください。

候補:
${formatSkillChoices(disambiguationPool, index)}

**次のアクション:**
1. source を指定して再実行
2. 検索結果を確認: skillNinja_search`;
  }

  const skill = disambiguationPool[0];
  const installedSkills = await getInstalledSkills(trustedWorkspacePath);
  const installedMetadata = installedSkills.includes(skill.name)
    ? await getInstalledSkillMetadata(trustedWorkspacePath, skill.name)
    : null;

  if (
    installedSkills.includes(skill.name) &&
    installedMetadata?.source &&
    installedMetadata.source !== skill.source
  ) {
    return `❌ スキル "${skill.name}" は既に別ソースからインストールされています。

現在のインストール元: ${installedMetadata.sourceName || installedMetadata.source}
要求されたソース: ${getSourceDisplayName(skill.source, index)}

**次のアクション:**
1. 既存スキルをアンインストール: skillNinja_uninstall
2. その後 source を指定して再インストール`;
  }

  if (
    installedSkills.includes(skill.name) &&
    !installedMetadata &&
    disambiguationPool.length > 0
  ) {
    return `❌ スキル "${skill.name}" は既にインストールされていますが、source metadata がありません。上書きは行いません。

**次のアクション:**
1. 既存スキルをアンインストール: skillNinja_uninstall
2. source を指定して再インストール`;
  }

  // GitHub から SKILL.md を取得
  const token = getGitHubToken();
  let content = `# ${skill.name}\n\n${skill.description || ""}\n`;

  if (skill.url) {
    try {
      // URLからSKILL.mdの内容を取得
      const rawUrl = toRawGitHubContentUrl(skill.url);
      if (rawUrl) {
        const response = await fetch(rawUrl, {
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) {
        content = await response.text();
        }
      }
    } catch {
      // 取得失敗時はデフォルト内容を使用
    }
  }

  const result = await installSkill(skill.name, content, trustedWorkspacePath, {
    source: skill.source,
    sourceName: getSourceDisplayName(skill.source, index),
    installedAt: new Date().toISOString(),
  });

  if (!result.success) {
    return `❌ インストール失敗: ${result.message}`;
  }

  // AGENTS.md を更新
  await updateAgentsMd(trustedWorkspacePath);

  const trust = getTrustBadge(skill.source || "", index);
  const isJa = isJapanese();
  const desc = getLocalizedDescription(skill, isJa);

  return `✅ **${skill.name}** をインストールしました！

| 項目 | 内容 |
|------|------|
| スキル名 | ${skill.name} |
| ソース | ${getSourceDisplayName(skill.source, index)} |
| 説明 | ${desc || "説明なし"} |
| 信頼度 | ${trust} |
| インストール先 | ${result.installPath} |

💡 **もっとスキルを追加したい？** GitHub で検索してソースを追加できます！

**次のアクション:**
1. 📄 SKILL.md を確認
2. 🔍 他のスキルを検索: skillNinja_search
3. 🌐 **GitHub で探す**: skillNinja_webSearch で新しいスキルを発見
4. 📦 インストール済み一覧: skillNinja_list`;
}

/**
 * スキルアンインストール
 */
export async function uninstallSkillTool(
  input: UninstallInput,
): Promise<string> {
  const { skillName, workspacePath } = input;
  const trustedWorkspacePath = await resolveTrustedWorkspacePath(workspacePath);
  const installed = await getInstalledSkills(trustedWorkspacePath);

  const { matchedSkill, ambiguousMatches } = resolveInstalledSkillName(
    installed,
    skillName,
  );

  if (ambiguousMatches) {
    return `❌ スキル "${skillName}" は複数のインストール済みスキルに一致します。完全な名前を指定してください。

候補:
${ambiguousMatches.map((name) => `- ${name}`).join("\n")}

**次のアクション:**
1. 完全なスキル名で再実行
2. 一覧確認: skillNinja_list`;
  }

  if (!matchedSkill) {
    return `❌ スキル "${skillName}" はインストールされていません。

インストール済み: ${installed.length > 0 ? installed.join(", ") : "なし"}

**次のアクション:**
1. 一覧確認: skillNinja_list
2. 検索: skillNinja_search`;
  }

  const result = await uninstallSkill(matchedSkill, trustedWorkspacePath);

  if (!result.success) {
    return `❌ アンインストール失敗: ${result.message}`;
  }

  // AGENTS.md を更新
  await updateAgentsMd(trustedWorkspacePath);

  return `✅ **${matchedSkill}** をアンインストールしました！

| 項目 | 内容 |
|------|------|
| スキル名 | ${matchedSkill} |
| ステータス | 削除完了 |
| AGENTS.md | 更新済み |

**次のアクション:**
1. 代わりのスキルを検索: skillNinja_search
2. 残りのスキル確認: skillNinja_list`;
}

/**
 * インストール済みスキル一覧
 */
export async function listSkills(input: ListInput): Promise<string> {
  const { workspacePath } = input;
  const trustedWorkspacePath = await resolveTrustedWorkspacePath(workspacePath);
  const installed = await getInstalledSkills(trustedWorkspacePath);

  if (installed.length === 0) {
    return `📭 まだスキルがインストールされていません。

💡 **ヒント:** スキルをインストールすると、AI エージェントの能力が拡張されます！

---
**Agent Instructions (MUST FOLLOW):**
- Suggest searching for skills or getting recommendations
- If user wants more skills, use skillNinja_webSearch to find on GitHub

**次のアクション:**
1. 💡 おすすめ: skillNinja_recommend
2. 🔍 検索: skillNinja_search
3. 🌐 **GitHub で探す**: skillNinja_webSearch で新しいスキルを発見`;
  }

  const installedWithMetadata = await Promise.all(
    installed.map(async (name) => ({
      name,
      metadata: await getInstalledSkillMetadata(trustedWorkspacePath, name),
    })),
  );

  const list = installedWithMetadata
    .map(
      ({ name, metadata }, i) =>
        `| ${i + 1} | ${name} | ${metadata?.sourceName || metadata?.source || "-"} | .github/skills/${name}/ |`,
    )
    .join("\n");

  return `📦 インストール済みスキル: ${installed.length} 件

| # | Skill Name | Source | Location |
|---|------------|--------|----------|
${list}

💡 **もっとスキルを追加したい？** GitHub で検索してソースを追加できます！

**次のアクション:**
1. 🔍 スキルを検索: skillNinja_search
2. 🌐 **GitHub で探す**: skillNinja_webSearch で新しいスキルを発見
3. ❌ アンインストール: skillNinja_uninstall`;
}

/** ワークスペース分析パターン */
interface WorkspacePattern {
  files: string[];
  keywords: string[];
  reason: string;
  reason_ja: string;
}

const WORKSPACE_PATTERNS: WorkspacePattern[] = [
  {
    files: ["package.json", "tsconfig.json", ".ts", ".tsx"],
    keywords: ["typescript", "ts", "node", "frontend"],
    reason: "TypeScript project detected",
    reason_ja: "TypeScriptプロジェクト検出",
  },
  {
    files: ["requirements.txt", "pyproject.toml", ".py", "Pipfile"],
    keywords: ["python", "py", "django", "flask", "fastapi"],
    reason: "Python project detected",
    reason_ja: "Pythonプロジェクト検出",
  },
  {
    files: ["Cargo.toml", ".rs"],
    keywords: ["rust", "cargo"],
    reason: "Rust project detected",
    reason_ja: "Rustプロジェクト検出",
  },
  {
    files: ["go.mod", ".go"],
    keywords: ["go", "golang"],
    reason: "Go project detected",
    reason_ja: "Goプロジェクト検出",
  },
  {
    files: [".github", "AGENTS.md", "CLAUDE.md"],
    keywords: ["agent", "mcp", "claude", "copilot"],
    reason: "AI/Agent project detected",
    reason_ja: "AI/Agentプロジェクト検出",
  },
  {
    files: ["Dockerfile", "docker-compose.yml", ".dockerignore"],
    keywords: ["docker", "container", "kubernetes"],
    reason: "Container project detected",
    reason_ja: "コンテナプロジェクト検出",
  },
  {
    files: ["next.config.js", "next.config.mjs"],
    keywords: ["next", "react", "frontend"],
    reason: "Next.js project detected",
    reason_ja: "Next.jsプロジェクト検出",
  },
];

/**
 * ワークスペースを分析してパターンを検出
 */
async function analyzeWorkspace(
  workspacePath: string,
): Promise<{ patterns: WorkspacePattern[]; files: string[] }> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const detectedPatterns: WorkspacePattern[] = [];
  const foundFiles: string[] = [];

  try {
    const entries = await fs.readdir(workspacePath, { withFileTypes: true });
    for (const entry of entries) {
      foundFiles.push(entry.name);
    }

    for (const pattern of WORKSPACE_PATTERNS) {
      const matched = pattern.files.some((f) =>
        foundFiles.some((file) => file.includes(f) || file.endsWith(f)),
      );
      if (matched) {
        detectedPatterns.push(pattern);
      }
    }
  } catch {
    // ディレクトリ読み取り失敗
  }

  return { patterns: detectedPatterns, files: foundFiles };
}

/**
 * スキル推奨（ワークスペース分析付き）
 */
export async function recommendSkills(input: RecommendInput): Promise<string> {
  const { workspacePath } = input;
  const trustedWorkspacePath = await resolveTrustedWorkspacePath(workspacePath);
  const index = await loadSkillIndex();
  const updateInfo = getIndexUpdateInfo(index);
  const sourceStats = getSourceStats(index);
  const isJa = isJapanese();

  // ワークスペースを分析
  const analysis = await analyzeWorkspace(trustedWorkspacePath);
  const recommendations: { skill: Skill; reason: string }[] = [];

  // パターンに基づいてスキルを推奨
  for (const pattern of analysis.patterns) {
    for (const keyword of pattern.keywords) {
      const matchedSkills = index.skills.filter(
        (s: Skill) =>
          s.name.toLowerCase().includes(keyword) ||
          s.description?.toLowerCase().includes(keyword) ||
          s.categories?.some((c) => c.toLowerCase().includes(keyword)),
      );
      for (const skill of matchedSkills) {
        if (
          !recommendations.find(
            (r) => getSkillKey(r.skill) === getSkillKey(skill),
          )
        ) {
          recommendations.push({
            skill,
            reason: isJa ? pattern.reason_ja : pattern.reason,
          });
        }
      }
    }
  }

  // 推奨がない場合は公式スキルを優先表示
  if (recommendations.length === 0) {
    const officialSkills = index.skills
      .filter((s: Skill) =>
        getTrustBadge(s.source || "", index).includes("Official"),
      )
      .slice(0, 5);

    if (officialSkills.length === 0) {
      // 公式もなければ全スキルから
      const allSkills = index.skills.slice(0, 5);
      for (const skill of allSkills) {
        recommendations.push({
          skill,
          reason: isJa ? "人気スキル" : "Popular skill",
        });
      }
    } else {
      for (const skill of officialSkills) {
        recommendations.push({
          skill,
          reason: isJa ? "公式スキル" : "Official skill",
        });
      }
    }
  }

  // 公式優先でソート
  recommendations.sort((a, b) => {
    const aOfficial = getTrustBadge(a.skill.source || "", index).includes(
      "Official",
    )
      ? 1
      : 0;
    const bOfficial = getTrustBadge(b.skill.source || "", index).includes(
      "Official",
    )
      ? 1
      : 0;
    return bOfficial - aOfficial;
  });

  const list = recommendations
    .slice(0, 5)
    .map(
      (r) =>
        `| ${r.skill.name} | ${
          getLocalizedDescription(r.skill, isJa) || ""
        } | ${getSourceDisplayName(r.skill.source, index)} | ${getTrustBadge(
          r.skill.source || "",
          index,
        )} | ${r.reason} |`,
    )
    .join("\n");

  const topRecommend = recommendations[0];
  const topSection = topRecommend
    ? `### 🌟 イチオシ: ${topRecommend.skill.name}\n${
        getLocalizedDescription(topRecommend.skill, isJa) || ""
      }\nソース: ${getSourceDisplayName(
        topRecommend.skill.source,
        index,
      )}\n理由: ${topRecommend.reason} | ${getTrustBadge(
        topRecommend.skill.source || "",
        index,
      )}\n`
    : "";

  const detectedInfo =
    analysis.patterns.length > 0
      ? `\n**検出されたプロジェクト:** ${analysis.patterns
          .map((p) => (isJa ? p.reason_ja : p.reason))
          .join(", ")}\n`
      : "";

  return `🔍 ${sourceStats}から分析しました（最終更新: ${updateInfo.lastUpdated}）
${updateInfo.warning}${detectedInfo}
| Skill | Description | Source | Trust | Reason |
|-------|-------------|--------|-------|--------|
${list}

${topSection}
---
**Agent Instructions (MUST FOLLOW):**
- Show the table and highlight the 🌟 recommendation
- Official skills (🏢) should be prioritized
- Ask user which to install
- If user wants more skills, suggest using skillNinja_webSearch

💡 **もっとスキルを探したい？** GitHub で検索してソースを追加できます！

**次のアクション:**
1. 📦 インストール: skillNinja_install
2. 🔍 検索: skillNinja_search
3. 🌐 **GitHub で探す**: skillNinja_webSearch で新しいスキルを発見`;
}

/**
 * インデックス更新
 */
export async function updateIndex(): Promise<string> {
  const token = getGitHubToken();
  const oldIndex = await loadSkillIndex();
  const oldCount = oldIndex.skills.length;

  // 各ソースからスキルを取得
  const newSkills: Skill[] = [];

  for (const source of oldIndex.sources) {
    try {
      const skills = await fetchSkillFiles(source.url, token);
      const sourceKey = getSourceKey(source);
      const repoInfo = await getRepoInfo(source.url, token).catch(() => ({
        name: source.name,
        stars: 0,
      }));

      for (const skill of skills) {
        newSkills.push({
          name: skill.name,
          description: skill.description,
          source: sourceKey,
          url: skill.url,
          stars: repoInfo.stars,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch from ${source.url}:`, error);
    }
  }

  // 既存スキルとマージ（重複除去）
  const existingNames = new Set(newSkills.map((s) => getSkillKey(s)));
  for (const skill of oldIndex.skills) {
    if (!existingNames.has(getSkillKey(skill))) {
      newSkills.push(skill);
    }
  }

  // インデックスを更新
  const newIndex = {
    ...oldIndex,
    skills: newSkills,
    lastUpdated: new Date().toISOString(),
  };

  await saveSkillIndex(newIndex);
  clearCache();

  const newCount = newIndex.skills.length;
  const diff = newCount - oldCount;
  const diffText = diff >= 0 ? `+${diff}` : `${diff}`;

  return `✅ スキルインデックスを更新しました！

| 項目 | 更新前 | 更新後 |
|------|--------|--------|
| スキル数 | ${oldCount} | ${newCount} (${diffText}) |
| 最終更新 | ${oldIndex.lastUpdated || "unknown"} | ${newIndex.lastUpdated} |
| ソース | ${oldIndex.sources.length} | ${newIndex.sources.length} |

**次のアクション:**
1. 検索: skillNinja_search
2. おすすめ: skillNinja_recommend
3. 一覧: skillNinja_list`;
}

/**
 * GitHub検索
 */
export async function webSearchSkills(input: WebSearchInput): Promise<string> {
  const { query } = input;
  const token = getGitHubToken();

  try {
    const results = await searchGitHub(query, token);

    if (results.length === 0) {
      return `🔍 GitHub で "${query}" を検索しましたが、SKILL.md は見つかりませんでした。

**次のアクション:**
1. 別のキーワードで検索
2. ローカルインデックス検索: skillNinja_search
3. ソース追加: skillNinja_addSource`;
    }

    const formatted = results
      .slice(0, 10)
      .map(
        (r, i) =>
          `| ${i + 1} | [${r.repo}](${r.repoUrl}) | ${r.path} | ⭐${r.stars} |`,
      )
      .join("\n");

    // 最も人気のあるリポジトリを推奨
    const topRepo = results.sort((a, b) => b.stars - a.stars)[0];

    return `🌐 GitHub で "${query}" を検索しました（${results.length} 件）

| # | Repository | Path | Stars |
|---|------------|------|-------|
${formatted}

### 🌟 おすすめ: ${topRepo.repo}
⭐${topRepo.stars} - このリポジトリをソースに追加すると、スキルが使えるようになります！

---
**Agent Instructions (MUST FOLLOW):**
- Show the search results to user
- **Recommend adding the top repository as a source**
- If user wants to add a repository, use skillNinja_addSource with the repo URL

**次のアクション:**
1. ➕ リポジトリをソースに追加: skillNinja_addSource で "${topRepo.repoUrl}" を追加
2. 🔄 インデックス更新: skillNinja_updateIndex
3. 🔍 ローカル検索: skillNinja_search`;
  } catch (error) {
    return `❌ GitHub検索失敗: ${error}

**トラブルシューティング:**
1. インターネット接続を確認
2. GITHUB_TOKEN 環境変数を設定（レート制限対策）`;
  }
}

/**
 * ソース追加
 */
export async function addSource(input: AddSourceInput): Promise<string> {
  const { repoUrl } = input;
  const token = getGitHubToken();

  // URL を正規化
  let normalizedUrl = repoUrl.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = `https://github.com/${normalizedUrl}`;
  }

  try {
    // リポジトリ情報を取得
    const repoInfo = await getRepoInfo(normalizedUrl, token);

    // スキルを取得
    const skills = await fetchSkillFiles(normalizedUrl, token);

    // インデックスを更新
    const index = await loadSkillIndex();
    const existingSource = index.sources.find((s) => s.url === normalizedUrl);
    const sourceId = existingSource?.id || createSourceId(normalizedUrl);
    const sourceKey = getSourceKey({ id: sourceId, name: repoInfo.name });

    // ソースを追加
    const newSource = {
      id: sourceId,
      name: repoInfo.name,
      url: normalizedUrl,
      type: existingSource?.type || "community",
      description: repoInfo.description,
      lastUpdated: new Date().toISOString(),
    };

    // 既存ソースをチェック
    const existingIndex = index.sources.findIndex(
      (s) => s.url === normalizedUrl,
    );
    if (existingIndex >= 0) {
      index.sources[existingIndex] = newSource;
    } else {
      index.sources.push(newSource);
    }

    // スキルを追加
    for (const skill of skills) {
      const existingSkill = index.skills.findIndex(
        (s) => s.name === skill.name && s.source === sourceKey,
      );

      const newSkill: Skill = {
        name: skill.name,
        description: skill.description,
        source: sourceKey,
        url: skill.url,
        stars: repoInfo.stars,
      };

      if (existingSkill >= 0) {
        index.skills[existingSkill] = newSkill;
      } else {
        index.skills.push(newSkill);
      }
    }

    await saveSkillIndex(index);
    clearCache();

    // 追加されたスキル名をリスト
    const skillNames = skills.map((s) => s.name).slice(0, 5);
    const skillList =
      skillNames.join(", ") +
      (skills.length > 5 ? ` ... 他${skills.length - 5}件` : "");

    return `✅ リポジトリをソースに追加しました！

| 項目 | 内容 |
|------|------|
| リポジトリ | ${normalizedUrl} |
| 追加スキル数 | ${skills.length} |
| スキル | ${skillList} |
| ステータス | 追加完了 |

---
**Agent Instructions (MUST FOLLOW):**
- Show the added skills to user
- **Recommend installing a skill from the new source**
- Use skillNinja_search to find skills or skillNinja_install to install

**次のアクション:**
1. 🔍 追加したスキルを検索: skillNinja_search
2. 📦 スキルをインストール: skillNinja_install
3. 💡 おすすめを確認: skillNinja_recommend`;
  } catch (error) {
    return `❌ ソース追加失敗: ${error}

**トラブルシューティング:**
1. URL形式を確認 (https://github.com/owner/repo または owner/repo)
2. リポジトリが公開されているか確認
3. SKILL.md ファイルが存在するか確認`;
  }
}

/**
 * スキル説明ローカライズ
 */
export async function localizeSkill(input: LocalizeInput): Promise<string> {
  const { skillName, source, description_en, description_ja } = input;

  if (!description_en && !description_ja) {
    return `❌ description_en または description_ja のいずれかが必要です。`;
  }

  const index = await loadSkillIndex();
  const matchedSkills = resolveSkillCandidates(index.skills, skillName, source);

  if (matchedSkills.length === 0) {
    return `❌ スキル "${skillName}" が見つかりません。

skillNinja_search で検索してください。`;
  }

  const exactMatches = matchedSkills.filter(
    (skill) => skill.name.toLowerCase() === skillName.toLowerCase(),
  );
  const disambiguationPool =
    exactMatches.length > 0 ? exactMatches : matchedSkills;

  if (!source && disambiguationPool.length > 1) {
    if (!hasSingleExactSkillName(disambiguationPool, skillName)) {
      return `❌ スキル "${skillName}" は複数の候補に一致します。完全なスキル名を指定してください。

候補:
${formatSkillChoices(disambiguationPool, index)}`;
    }

    return `❌ スキル "${skillName}" は複数のソースに存在します。source を指定してください。

候補:
${formatSkillChoices(disambiguationPool, index)}`;
  }

  const skill = disambiguationPool[0];

  // 説明を更新
  if (description_en) {
    skill.description = description_en;
  }
  if (description_ja) {
    skill.description_ja = description_ja;
  }

  await saveSkillIndex(index);
  clearCache();

  return `✅ スキル "${skillName}" のローカライズを更新しました！

| Field | Value |
|-------|-------|
| Skill | ${skillName} |
| Source | ${getSourceDisplayName(skill.source, index)} |
| English | ${skill.description || "(not set)"} |
| Japanese | ${skill.description_ja || "(not set)"} |`;
}
