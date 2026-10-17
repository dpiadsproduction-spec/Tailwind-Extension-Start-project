# Changelog

## 0.1.0

A full internal rewrite with Tailwind v3 + v4 support. All existing commands keep working, but the implementation is now modular, testable, and hardened.

### Added

- **Tailwind v4 support** alongside v3, with automatic project detection (`@tailwindcss/cli`, installed package version, `input.css` directives).
- **Create Project wizard** with a v3/v4 selector and a nonce-based Content-Security-Policy.
- **Page template library** with nine templates: basic, hero, header + navbar, footer, cards, contact form, pricing, dashboard, 404.
- **Live diagnostics** while typing:
  - `@apply` in a page-scoped file;
  - `@apply` in v4 outside the shared bundle without `@reference`;
  - `@tailwind` directives in a v4 project and `@import "tailwindcss"` in a v3 project.
- **Code actions**: add `@reference "tailwindcss"`, link the file to the build, convert entry CSS between v3 and v4.
- **Unlink File from Page** command, complementing Link.
- **Real watch mode** built on managed `spawn` processes, supporting multiple build targets and cancellation.
- **Check & Fix Project** now also detects the project's Tailwind major and respects framework-specific content globs.
- **Explicit v3 → v4 upgrade** command with automatic backups (`input.v3.bak.css`, `tailwind.config.v3.bak.js`) and theme migration notes.
- **Multi-root aware commands** — the target folder is inferred from context or explicitly chosen.
- **Unit tests** for all pure logic modules (89 tests).

### Changed

- `extension.ts` is now a thin registration layer; behavior lives in focused modules:
  - `core/` — paths, results, filesystem helpers, shared extension state;
  - `tailwind/` — adapters, detection, framework content globs, build plan, imports, templates, runner, build, watch;
  - `workspace/` — root resolution, multi-root helpers, auto mode;
  - `explorer/` — clean tree provider, drag-and-drop, actions, Link/Unlink;
  - `diagnostics/` — build parsing, live rules, provider and code actions;
  - `commands/` — create project, create page, check project, link asset, upgrade;
  - `webview/` — HTML shell and panel host.
- The status bar item is only shown for detected Tailwind projects.

### Security

- Replaced all `exec`/shell invocations with `spawn(cmd, args, { shell: false })`.
- Added a nonce-based CSP to the create-project webview.
- Automatic installs and builds are skipped in untrusted workspaces.
- Relative paths are sanitized and confined to the workspace root.

### Fixed

- Removed the dead `getWatchTerminal` code path that made the watch button a no-op.
- Corrected the `package-lock.json` version mismatch.
- Case-insensitive build-target and generated-CSS matching.
- Prevented commands from silently targeting another project when a root selection is cancelled.

### Compatibility

- `engines.vscode` stays at `^1.74.0`.
- Existing settings (`autoBuild`, `autoFix`, `targets`, `explorerExclude`) keep their names and defaults.
