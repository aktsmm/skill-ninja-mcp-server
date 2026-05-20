# Changelog

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
