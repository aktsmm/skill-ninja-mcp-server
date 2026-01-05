/**
 * Skill Index Types and Utilities
 * スキルインデックスの型定義と操作関数
 */
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

// ESM での __dirname 相当
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 型定義 =====

/** スキルソース情報 */
export interface Source {
  id?: string;
  name: string;
  url: string;
  type?: string;
  branch?: string;
  description?: string;
  description_ja?: string;
  lastUpdated?: string;
}

/** スキル情報 */
export interface Skill {
  name: string;
  description?: string;
  description_ja?: string;
  categories?: string[];
  source?: string;
  path?: string;
  relativePath?: string;
  stars?: number;
  url?: string;
  rawUrl?: string;
  owner?: string;
  isOrg?: boolean;
  standalone?: boolean;
  requires?: string[];
  bundle?: string;
}

/** スキルインデックス全体 */
export interface SkillIndex {
  version: string;
  lastUpdated?: string;
  sources: Source[];
  skills: Skill[];
  categories?: Array<{
    id: string;
    name: string;
    name_ja?: string;
    description?: string;
    description_ja?: string;
  }>;
  bundles?: Array<{
    id: string;
    name: string;
    source: string;
    description: string;
    description_ja?: string;
    skills: string[];
  }>;
}

// ===== 定数 =====

/** デフォルトのインデックス保存先 */
const DEFAULT_INDEX_DIR = path.join(os.homedir(), ".skill-ninja");
const INDEX_FILE = "skill-index.json";

/** バンドルされたインデックスのパス */
const BUNDLED_INDEX_PATH = path.join(__dirname, "..", "resources", "skill-index.json");

// ===== キャッシュ =====

let cachedIndex: SkillIndex | undefined;

// ===== 関数 =====

/**
 * インデックス保存ディレクトリを取得（環境変数で上書き可能）
 */
export function getIndexDir(): string {
  return process.env.SKILL_NINJA_INDEX_DIR || DEFAULT_INDEX_DIR;
}

/**
 * インデックスファイルのパスを取得
 */
export function getIndexPath(): string {
  return path.join(getIndexDir(), INDEX_FILE);
}

/**
 * 空のインデックスを作成
 */
export function createEmptyIndex(): SkillIndex {
  return {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    sources: [],
    skills: [],
  };
}

/**
 * バンドルされたインデックスを読み込む
 */
async function loadBundledIndex(): Promise<SkillIndex | null> {
  try {
    const content = await fs.readFile(BUNDLED_INDEX_PATH, "utf-8");
    return JSON.parse(content) as SkillIndex;
  } catch {
    return null;
  }
}

/**
 * スキルインデックスを読み込む
 * 1. ローカルインデックスがあればそれを使用
 * 2. なければバンドルインデックスをコピーして使用
 * 3. バンドル版のバージョンが新しければソースをマージ
 */
export async function loadSkillIndex(): Promise<SkillIndex> {
  if (cachedIndex) {
    return cachedIndex;
  }

  const indexPath = getIndexPath();

  // バンドルインデックスを読み込む
  const bundledIndex = await loadBundledIndex();

  try {
    // ローカルインデックスを読み込む
    const content = await fs.readFile(indexPath, "utf-8");
    const localIndex = JSON.parse(content) as SkillIndex;

    // バンドル版がある場合はマージ
    if (bundledIndex && bundledIndex.version > localIndex.version) {
      const mergedIndex = mergeSkillIndexes(localIndex, bundledIndex);
      await saveSkillIndex(mergedIndex);
      cachedIndex = mergedIndex;
      return mergedIndex;
    }

    cachedIndex = localIndex;
    return localIndex;
  } catch {
    // ローカルにない場合はバンドルインデックスを使用
    if (bundledIndex) {
      await saveSkillIndex(bundledIndex);
      cachedIndex = bundledIndex;
      return bundledIndex;
    }

    // バンドルもない場合は空のインデックス
    const emptyIndex = createEmptyIndex();
    await saveSkillIndex(emptyIndex);
    cachedIndex = emptyIndex;
    return emptyIndex;
  }
}

/**
 * 2つのスキルインデックスをマージ（バンドル版の新しいソース/スキルを追加）
 */
function mergeSkillIndexes(
  localIndex: SkillIndex,
  bundledIndex: SkillIndex
): SkillIndex {
  // ローカルのソース名セット
  const localSourceNames = new Set(localIndex.sources.map((s) => s.name));
  // 新しいソースを追加
  const newSources = bundledIndex.sources.filter(
    (s) => !localSourceNames.has(s.name)
  );

  // ローカルのスキル名セット
  const localSkillNames = new Set(localIndex.skills.map((s) => s.name));
  // 新しいスキルを追加
  const newSkills = bundledIndex.skills.filter(
    (s) => !localSkillNames.has(s.name)
  );

  return {
    version: bundledIndex.version,
    lastUpdated: new Date().toISOString(),
    sources: [...localIndex.sources, ...newSources],
    skills: [...localIndex.skills, ...newSkills],
  };
}

/**
 * スキルインデックスを保存
 */
export async function saveSkillIndex(index: SkillIndex): Promise<void> {
  const indexDir = getIndexDir();
  const indexPath = getIndexPath();

  // ディレクトリを作成
  await fs.mkdir(indexDir, { recursive: true });

  // インデックスを保存
  index.lastUpdated = new Date().toISOString();
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");

  // キャッシュを更新
  cachedIndex = index;
}

/**
 * キャッシュをクリア
 */
export function clearCache(): void {
  cachedIndex = undefined;
}

/**
 * ローカライズされた説明を取得
 */
export function getLocalizedDescription(
  skill: Skill,
  isJapanese: boolean
): string | undefined {
  if (isJapanese && skill.description_ja) {
    return skill.description_ja;
  }
  return skill.description;
}

/**
 * 信頼度バッジを取得
 */
export function getTrustBadge(source: string): string {
  const lowerSource = source.toLowerCase();
  if (lowerSource.includes("anthropic") || lowerSource.includes("github")) {
    return "🏢 Official";
  } else if (
    lowerSource.includes("awesome") ||
    lowerSource.includes("curated")
  ) {
    return "📋 Curated";
  }
  return "👥 Community";
}

/**
 * インデックス更新情報を取得
 */
export function getIndexUpdateInfo(index: SkillIndex): {
  lastUpdated: string;
  daysOld: number;
  isOutdated: boolean;
  warning: string;
} {
  const lastUpdated = index.lastUpdated || "unknown";
  let daysOld = 0;
  let isOutdated = false;

  if (index.lastUpdated) {
    const lastDate = new Date(index.lastUpdated);
    const now = new Date();
    daysOld = Math.floor(
      (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    isOutdated = daysOld > 7;
  }

  const warning = isOutdated
    ? `⚠️ インデックスが${daysOld}日前から更新されていません。更新を推奨します。`
    : "";

  return { lastUpdated, daysOld, isOutdated, warning };
}

/**
 * ソース統計を取得
 */
export function getSourceStats(index: SkillIndex): string {
  const sourceCount = index.sources.length;
  const skillCount = index.skills.length;
  return `${sourceCount}ソース/${skillCount}スキル`;
}
