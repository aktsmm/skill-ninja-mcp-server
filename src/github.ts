/**
 * GitHub API Utilities
 * GitHub APIを使用したスキル検索・取得
 */

/** GitHub検索結果 */
export interface GitHubSearchResult {
  repo: string;
  repoUrl: string;
  path: string;
  stars: number;
  url: string;
}

/** SKILL.md の内容 */
export interface SkillContent {
  name: string;
  description?: string;
  content: string;
  url: string;
}

const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

function buildGitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "skill-ninja-mcp-server",
  };

  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
  });
}

export function normalizeGitHubRepoUrl(repoUrl: string): string {
  const trimmedRepoUrl = repoUrl.trim();
  const candidateUrl = /^https?:\/\//i.test(trimmedRepoUrl)
    ? trimmedRepoUrl
    : `https://github.com/${trimmedRepoUrl}`;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(candidateUrl);
  } catch {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "github.com") {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  if (pathParts.length !== 2) {
    throw new Error(
      `GitHub repository URL must be in the form owner/repo or https://github.com/owner/repo: ${repoUrl}`,
    );
  }

  const [owner, rawRepo] = pathParts;
  const repo = rawRepo.replace(/\.git$/i, "");

  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  return `https://github.com/${owner}/${repo}`;
}

function getGitHubRepoSlug(repoUrl: string): string {
  const normalizedUrl = normalizeGitHubRepoUrl(repoUrl);
  const parsedUrl = new URL(normalizedUrl);
  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  const [owner, repo] = pathParts;

  return `${owner}/${repo}`;
}

export function toRawGitHubContentUrl(skillUrl: string): string | null {
  try {
    const parsedUrl = new URL(skillUrl);
    if (parsedUrl.hostname !== "github.com") {
      return null;
    }

    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathParts.length < 5 || pathParts[2] !== "blob") {
      return null;
    }

    const [owner, repo, _blob, ref, ...filePath] = pathParts;
    if (filePath.length === 0) {
      return null;
    }

    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath.join("/")}`;
  } catch {
    return null;
  }
}

/**
 * GitHubでSKILL.mdを検索
 */
export async function searchGitHub(
  query: string,
  token?: string
): Promise<GitHubSearchResult[]> {
  // SKILL.md を含むファイルを検索
  const searchQuery = `path:**/SKILL.md ${query}`;
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(
    searchQuery
  )}&per_page=20`;

  const headers = buildGitHubHeaders(token);
  const response = await fetchWithTimeout(url, { headers });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "GitHub API rate limit exceeded. Set GITHUB_TOKEN for higher limits."
      );
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    items: Array<{
      repository: {
        full_name: string;
        html_url: string;
        stargazers_count: number;
      };
      path: string;
      html_url: string;
    }>;
  };

  return data.items.map((item) => ({
    repo: item.repository.full_name,
    repoUrl: item.repository.html_url,
    path: item.path,
    stars: item.repository.stargazers_count,
    url: item.html_url,
  }));
}

/**
 * GitHubリポジトリからSKILL.mdファイルを取得
 */
export async function fetchSkillFiles(
  repoUrl: string,
  token?: string
): Promise<SkillContent[]> {
  const repo = getGitHubRepoSlug(repoUrl);
  const searchUrl = `https://api.github.com/search/code?q=repo:${repo}+path:**/SKILL.md&per_page=100`;

  const headers = buildGitHubHeaders(token);
  const response = await fetchWithTimeout(searchUrl, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    items: Array<{
      path: string;
      html_url: string;
      url: string;
    }>;
  };

  const skills: SkillContent[] = [];

  for (const item of data.items) {
    try {
      // ファイル内容を取得
      const contentResponse = await fetchWithTimeout(item.url, { headers });
      if (contentResponse.ok) {
        const contentData = (await contentResponse.json()) as {
          content: string;
          encoding: string;
        };
        const content =
          contentData.encoding === "base64"
            ? Buffer.from(contentData.content, "base64").toString("utf-8")
            : contentData.content;

        // スキル名を抽出（ファイルパスから）
        const pathParts = item.path.split("/");
        const skillName =
          pathParts.length > 1
            ? pathParts[pathParts.length - 2]
            : pathParts[0].replace(".md", "");

        // 説明を抽出（最初の段落）
        const descMatch = content.match(/^#[^\n]+\n+([^\n#]+)/);
        const description = descMatch
          ? descMatch[1].trim().substring(0, 200)
          : undefined;

        skills.push({
          name: skillName,
          description,
          content,
          url: item.html_url,
        });
      }
    } catch (error) {
      // 個別のファイル取得エラーは無視
      console.error(`Failed to fetch ${item.path}:`, error);
    }
  }

  return skills;
}

/**
 * リポジトリ情報を取得
 */
export async function getRepoInfo(
  repoUrl: string,
  token?: string
): Promise<{ name: string; stars: number; description?: string }> {
  const repo = getGitHubRepoSlug(repoUrl);
  const url = `https://api.github.com/repos/${repo}`;

  const headers = buildGitHubHeaders(token);
  const response = await fetchWithTimeout(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    name: string;
    stargazers_count: number;
    description?: string;
  };

  return {
    name: data.name,
    stars: data.stargazers_count,
    description: data.description,
  };
}
