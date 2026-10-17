# Tailwind Starter

An extension for VS Code and Void that scaffolds Tailwind CSS projects, creates pages, wires assets, and keeps a shared build up to date — supporting both **Tailwind v3** and **v4** with automatic detection.

## Features

- **Create Project wizard** — a CSP-hardened webview with a Tailwind version selector (v3 / v4), quick-start files, and an arbitrary nested folder/file tree.
- **Create Page** — pick one of nine ready-made templates (basic, hero, header + navbar, footer, cards, contact form, pricing, dashboard, 404) and choose how its CSS participates in the build:
  - plain CSS linked directly from the page,
  - Tailwind-powered CSS imported into the shared build (supports `@apply`),
  - a standalone input with its own compiled output.
- **Smart imports** — CSS files that use Tailwind directives are automatically imported into `input.css`, and HTML pages are automatically linked to `style.css`.
- **Live diagnostics + quick fixes** — while typing, the extension warns about `@apply` in page-scoped files, missing `@reference` on v4, and v3/v4 directive mismatches. Each warning ships with a one-click fix.
- **Clean Workspace explorer** — filtered project tree with drag-and-drop, new file/folder, rename, delete, and Link / **Unlink** file to page.
- **Real watch mode** — managed `spawn`-based processes (no shell), multiple build targets, cancellable.
- **Check & Fix Project** — repairs HTML links, imports Tailwind-powered CSS, updates content globs, installs dependencies, and rebuilds.
- **Explicit v3 → v4 upgrade** — backs up `input.css` and `tailwind.config.js` before converting directives and copying the theme for manual review.
- **Multi-root aware** — commands operate on the folder you choose, never a hard-coded first folder.

## Supported frameworks (content detection)

Next.js, Nuxt, Angular, Vue, Svelte/SvelteKit, Astro, Vite, Create React App, and generic HTML projects.

## Commands

| Command | Description |
| --- | --- |
| `Tailwind Starter: Create Project` | Open the project wizard |
| `Tailwind Starter: Create Page` | Create an HTML page with a template |
| `Tailwind Starter: Check & Fix Project` | Repair links, imports, config, install, rebuild |
| `Tailwind Starter: Rebuild Now` | Run the build once |
| `Tailwind Starter: Start Watch` / `Stop Watch` | Managed watch processes |
| `Tailwind Starter: Link File to Page` / `Unlink File from Page` | Attach or detach a CSS/JS asset |
| `Tailwind Starter: Upgrade to Tailwind v4` | Backup and convert an existing v3 project |
| `Clean Explorer: New File` / `New Folder` / `Rename` / `Delete` / `Refresh` | Project tree actions |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `tailwindStarter.autoBuild` | `true` | Rebuild on save |
| `tailwindStarter.autoFix` | `true` | Auto-link HTML pages and import Tailwind CSS |
| `tailwindStarter.liveDiagnostics` | `true` | Live diagnostics while typing |
| `tailwindStarter.targets` | `[]` | Extra `{ input, output }` build targets |
| `tailwindStarter.explorerExclude` | `["node_modules", ...]` | Names hidden from the Clean Workspace |

## Security notes

- All child processes are launched with `child_process.spawn` **without a shell**, so values from workspace settings cannot inject commands.
- Webview content is protected with a nonce-based Content-Security-Policy.
- Automatic installs and builds are disabled in untrusted workspaces.
- Every relative path is sanitized and confined to its workspace folder.

## Requirements

- VS Code / Void `1.74.0` or newer.
- Node.js with `npx` available for builds and installs.
- A workspace folder open to use project features.

## Development

```bash
# Install dependencies
npm install

# Type-check
npm run compile

# Run unit tests
npm test

# Build a local VSIX
npm run package
```

The VSIX is produced as `tailwind-starter-0.1.0.vsix`.

## License

See the repository for licensing information.
