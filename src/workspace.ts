import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

const TRUSTED_WORKSPACES_ENV = "SKILL_NINJA_TRUSTED_WORKSPACES";
const WORKSPACE_MARKERS = [
  ".git",
  ".github",
  "package.json",
  "tsconfig.json",
  "AGENTS.md",
];

export class WorkspaceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function maybeRealpath(targetPath: string): Promise<string | null> {
  try {
    return await fs.realpath(targetPath);
  } catch {
    return null;
  }
}

async function getImplicitTrustedWorkspaceRoot(): Promise<string[]> {
  const currentDir = path.resolve(process.cwd());
  const homeDir = path.resolve(os.homedir());
  const rootDir = path.parse(currentDir).root;

  if (currentDir === homeDir || currentDir === rootDir) {
    return [];
  }

  for (const marker of WORKSPACE_MARKERS) {
    if (await pathExists(path.join(currentDir, marker))) {
      return [currentDir];
    }
  }

  return [];
}

async function getTrustedWorkspaceRoots(): Promise<string[]> {
  const configuredRoots = (process.env[TRUSTED_WORKSPACES_ENV] || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const implicitRoots = await getImplicitTrustedWorkspaceRoot();
  const roots = [...configuredRoots, ...implicitRoots];
  const resolvedRoots = await Promise.all(
    roots.map((entry) => maybeRealpath(entry)),
  );

  return [
    ...new Set(
      resolvedRoots.filter((entry): entry is string => Boolean(entry)),
    ),
  ];
}

function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function getTrustedRootsHint(trustedRoots: string[]): string {
  if (trustedRoots.length === 0) {
    return `Set ${TRUSTED_WORKSPACES_ENV} to one or more trusted workspace roots separated by "${path.delimiter}", or start the server from the target workspace root.`;
  }

  return `Trusted workspace roots: ${trustedRoots.join(", ")}`;
}

export async function resolveTrustedWorkspacePath(
  workspacePath: string,
): Promise<string> {
  if (!workspacePath || workspacePath.trim().length === 0) {
    throw new WorkspaceAccessError("workspacePath is required.");
  }

  const requestedPath = path.resolve(workspacePath);
  const resolvedWorkspace = await maybeRealpath(requestedPath);

  if (!resolvedWorkspace) {
    throw new WorkspaceAccessError(
      `workspacePath does not exist or is not accessible: ${requestedPath}`,
    );
  }

  const trustedRoots = await getTrustedWorkspaceRoots();
  if (trustedRoots.length === 0) {
    throw new WorkspaceAccessError(
      `No trusted workspace roots are configured. ${getTrustedRootsHint(trustedRoots)}`,
    );
  }

  if (
    !trustedRoots.some((rootPath) => isWithinRoot(resolvedWorkspace, rootPath))
  ) {
    throw new WorkspaceAccessError(
      `workspacePath must stay inside a trusted workspace root: ${resolvedWorkspace}. ${getTrustedRootsHint(
        trustedRoots,
      )}`,
    );
  }

  return resolvedWorkspace;
}

export function validateSkillName(skillName: string): string {
  const normalizedName = skillName.trim();

  if (!normalizedName) {
    throw new Error("skillName is required.");
  }

  if (
    normalizedName !== path.basename(normalizedName) ||
    normalizedName === "." ||
    normalizedName === ".."
  ) {
    throw new Error("skillName must be a single directory name.");
  }

  return normalizedName;
}
