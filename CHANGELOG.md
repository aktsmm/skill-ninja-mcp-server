# Changelog

## 0.1.3

- Cleaned the build output before compilation so stale artifacts do not leak into published tarballs.
- Published only dist JavaScript and declaration files plus the bundled skill index, excluding sourcemap artifacts from the npm package.

## 0.1.2

- Stopped install, localize, and uninstall flows from selecting the first ambiguous partial match; exact names are now required when multiple skills match.
- Added 10-second timeout guards and safer raw-content URL conversion for GitHub API and content fetches.
- Tightened addSource validation to accept only repository-root GitHub URLs.
- Enabled forceConsistentCasingInFileNames in tsconfig and expanded regression coverage for ambiguity and URL normalization paths.
- Cleaned dist before build and stopped generating sourcemaps so the npm tarball excludes development mapping artifacts.

## 0.1.1

- Fixed arbitrary workspacePath read/write/delete by restricting filesystem operations to trusted workspace roots.
- Added duplicate skill disambiguation with source-aware search, recommend, install, and localize flows.
- Stopped install, localize, and uninstall flows from choosing the first partial match when multiple different skill names match a query.
- Prevented silent overwrite when the same skill name is installed from a different source.
- Preserved manual AGENTS.md content while updating only the managed installed-skills section.
- Added bounded timeouts and safer raw-content URL handling for GitHub API and content fetches.
- Tightened addSource repository URL validation to accept only repository roots and enabled forceConsistentCasingInFileNames in TypeScript config.
- Updated dependency versions to remove known production audit issues.
- Synchronized English and Japanese documentation with security and duplicate-skill behavior.
