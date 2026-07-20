# Agent Instructions

## Project Type
- This repository is a **Pi Agent Package**.
- Keep the `pi-package` keyword in `package.json` for Pi package discovery.
- Treat the `pi` manifest in `package.json` as the source of truth for exported Pi resources.
- Put prompt templates in `prompts/`; declare extensions, skills, prompts, and themes in the `pi` manifest when adding them.
- Keep Pi runtime packages in `peerDependencies` with a `"*"` range; do not bundle them.

## Package Manager
- Use **pnpm 11**: `pnpm install`.
- Do not generate npm or Yarn lockfiles.

## Commands
| Task | Command |
|------|---------|
| Build | `pnpm build` |
| Lint a file | `pnpm exec eslint path/to/file.ts` |
| Type-check | `pnpm exec tsc --noEmit` |

## Key Files
| Purpose | Path |
|---------|------|
| Package and Pi resource manifest | `package.json` |
| Build configuration | `tsup.config.ts` |
| TypeScript configuration | `tsconfig.json` |
| Release workflow | `.github/workflows/release.yml` |

## Conventions
- Use TypeScript and ES modules for source code.
- Use repo-relative paths in the `pi` manifest.
- Add third-party runtime libraries to `dependencies`; reserve `devDependencies` for development tooling.
- Run the relevant lint, type-check, and build commands after changes.
