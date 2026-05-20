# Skill Ninja Repo Rules

- Treat skill identity as `skillName + source`; when multiple skills match, require an exact name or explicit source instead of picking the first match.
- Accept GitHub skill sources only as repository-root URLs or `owner/repo`; reject deeper paths and keep network fetches bounded with timeouts.
- Preserve user-authored `AGENTS.md` content; only update the managed installed-skills section.
- Before release or publish work, run `npm run release:verify` and keep `package.json`, `package-lock.json`, `src/index.ts`, and `CHANGELOG.md` in sync.
