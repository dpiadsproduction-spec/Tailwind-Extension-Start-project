# Tailwind Starter v0.1.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تطوير إضافة `tailwind-starter` إلى v0.1.0 بمعمارية وحدات، دعم Tailwind v3+v4 بكشف تلقائي، وسبع ميزات جديدة، مع اختبارات وحدة وتقوية أمنية.

**Architecture:** Adapter + تفكيك موجّه. وحدات نقية (paths/plan/imports/detect/adapter/framework) بلا `vscode` وقابلة للاختبار، ووحدات تكامل (explorer/commands/build/watch/diagnostics/webview) تعتمد على `vscode`. `extension.ts` للتسجيل فقط.

**Tech Stack:** TypeScript 5، VS Code Extension API (engines ^1.74.0)، Node `node:test` للاختبارات، `child_process.spawn` بلا shell للبناء، `@vscode/vsce` للتحزيم.

## Global Constraints

- الإصدار النهائي: `0.1.0`.
- `engines.vscode`: `^1.74.0` (توافق VS Code و Void).
- لا استخدام `exec`/shell؛ كل تنفيذ أوامر عبر `spawn(cmd, args)` بلا shell.
- الوحدات النقية (`core/paths.ts`, `core/result.ts`, `tailwind/adapter*.ts`, `tailwind/detect.ts`, `tailwind/plan.ts`, `tailwind/framework.ts`, `tailwind/imports.ts`) لا تستورد `vscode`.
- كل وحدة < ~300 سطر ومسؤولية واحدة.
- مصدر تشخيص واحد `Tailwind Starter`؛ لا ازدواج.
- شريط الحالة يظهر فقط داخل مشروع Tailwind.
- Workspace Trust يمنع التثبيت/العمليات المدمّرة في الوضع Untrusted.
- VSIX الناتج: `tailwind-starter-0.1.0.vsix` (محلي، ضمن `.gitignore`).
- لا حذف تلقائي للبيانات: الترقية تنشئ نسخة احتياطية قبل أي تعديل.

## Roadmap (المراحل)

| المرحلة | المحتوى | قابلة للاختبار مستقلًا |
|---|---|---|
| 1 | الأساس: بنية الاختبار + وحدات `core` النقية | نعم (اختبارات وحدة) |
| 2 | نواة Tailwind النقية: adapter v3/v4 + detect + plan + framework + imports + templates | نعم |
| 3 | خدمة `workspace` (Multi-root) + `state` | جزئيًا |
| 4 | البناء `build` (spawn) + `watch` حقيقي | نعم (يدويًا) |
| 5 | المستكشف: entry/provider/dnd/actions | نعم (يدويًا) |
| 6 | الأوامر: create-project/create-page/check-project/link+unlink/upgrade | نعم |
| 7 | التشخيص اللحظي + Code Actions + تشخيص البناء | نعم |
| 8 | Webview بطبقة CSP | نعم |
| 9 | ربط `extension.ts` + مساهمات `package.json` + تقوية أمنية | نعم |
| 10 | ترقية v3→v4 بأمر صريح + نسخة احتياطية | نعم |
| 11 | تحقق شامل + تحزيم VSIX | نعم |

**Phase 1 مُفصّلة بالكامل أدناه ومُنفّذة. المراحل 2-11 تُفصّل عند بدء تنفيذها بنفس نمط TDD.**

---

## Phase 1 — الأساس: بنية الاختبار + وحدات core النقية

### Task 1.1: بنية الاختبار وسكربتات البناء

**Files:**
- Modify: `package.json` (scripts + devDependencies)
- Modify: `tsconfig.json` (تضمين الاختبارات)
- Create: `out/` (ناتج tsc)

**Interfaces:**
- Produces: أمر `npm test` يشغّل `node --test` على الناتج المُترجم.

- [ ] **Step 1: إضافة سكربتات الاختبار والتحزيم إلى `package.json`**

```json
"scripts": {
  "vscode:prepublish": "npm run compile",
  "compile": "tsc -p ./",
  "watch": "tsc -watch -p ./",
  "test": "npm run compile && node --test",
  "package": "vsce package"
}
```

- [ ] **Step 2: إضافة `@vscode/vsce` إلى devDependencies**

```json
"devDependencies": {
  "@types/node": "^18.x",
  "@types/vscode": "^1.74.0",
  "@vscode/vsce": "^2.32.0",
  "typescript": "^5.3.3"
}
```

- [ ] **Step 3: التأكد أن `tsconfig.json` يشمل الاختبارات**

`"include": ["src"]` كافٍ؛ الاختبارات توضع تحت `src/**/*.test.ts` وتُترجم إلى `out/**/*.test.js`.

- [ ] **Step 4: تثبيت الاعتمادات والتحقق**

Run: `npm install`
Expected: نجاح.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add test and package scripts"
```

### Task 1.2: وحدة المسارات النقية `core/paths.ts`

**Files:**
- Create: `src/core/paths.ts`
- Test: `src/core/paths.test.ts`

**Interfaces:**
- Produces:
  - `toPosix(p: string): string`
  - `sanitizeRelPath(p: string): string`
  - `dirOf(rel: string): string`
  - `baseName(rel: string): string`
  - `slugify(name: string): string`
  - `relativeHref(fromFile: string, toFile: string): string`
  - `resolveHref(fromDir: string, href: string): string`

- [ ] **Step 1: كتابة الاختبار الفاشل**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRelPath, dirOf, baseName, slugify, relativeHref, resolveHref, toPosix } from './paths';

test('toPosix converts backslashes', () => {
  assert.equal(toPosix('a\\b\\c'), 'a/b/c');
});

test('sanitizeRelPath strips empty, dot and dotdot segments', () => {
  assert.equal(sanitizeRelPath('  a//b/./c/../d '), 'a/b/c/d');
  assert.equal(sanitizeRelPath('a\\b\\c.css'), 'a/b/c.css');
  assert.equal(sanitizeRelPath('/abs/path'), 'abs/path');
  assert.equal(sanitizeRelPath('..'), '');
});

test('dirOf returns parent folder', () => {
  assert.equal(dirOf('a/b/c.html'), 'a/b');
  assert.equal(dirOf('x.css'), '');
});

test('baseName returns file name', () => {
  assert.equal(baseName('a/b/c.html'), 'c.html');
  assert.equal(baseName('c.html'), 'c.html');
});

test('slugify produces safe base', () => {
  assert.equal(slugify('About Us!.HTML'), 'about-us-html');
});

test('relativeHref computes ../ depth correctly', () => {
  assert.equal(relativeHref('index.html', 'style.css'), 'style.css');
  assert.equal(relativeHref('pages/about.html', 'style.css'), '../style.css');
  assert.equal(relativeHref('a/b/c.html', 'a/d/x.css'), '../d/x.css');
  assert.equal(relativeHref('a/b/c.html', 'a/b/d.css'), 'd.css');
});

test('resolveHref resolves relative links', () => {
  assert.equal(resolveHref('pages', '../style.css'), 'style.css');
  assert.equal(resolveHref('', 'style.css'), 'style.css');
  assert.equal(resolveHref('a/b', '../../x.css'), 'x.css');
  assert.equal(resolveHref('pages', 'https://x/y.css'), 'https://x/y.css');
  assert.equal(resolveHref('pages', 'style.css?v=1#a'), 'pages/style.css');
});
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `npm test`
Expected: FAIL لعدم وجود `./paths`.

- [ ] **Step 3: كتابة التنفيذ الأدنى**

```ts
export function toPosix(p: string): string {
  return String(p).replace(/\\/g, '/');
}

export function sanitizeRelPath(p: string): string {
  const normalized = toPosix(p).trim();
  const parts = normalized.split('/').filter((s) => s !== '' && s !== '.' && s !== '..');
  return parts.join('/');
}

export function dirOf(rel: string): string {
  const parts = sanitizeRelPath(rel).split('/');
  parts.pop();
  return parts.join('/');
}

export function baseName(rel: string): string {
  return sanitizeRelPath(rel).split('/').pop() || '';
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
}

export function relativeHref(fromFile: string, toFile: string): string {
  const fromDir = dirOf(fromFile);
  const fromParts = fromDir ? fromDir.split('/') : [];
  const toParts = sanitizeRelPath(toFile).split('/');
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++;
  }
  const up = fromParts.length - i;
  const down = toParts.slice(i);
  return '../'.repeat(up) + down.join('/');
}

export function resolveHref(fromDir: string, href: string): string {
  const clean = href.split('?')[0].split('#')[0].trim();
  if (!clean || clean.indexOf('://') !== -1 || clean.indexOf('data:') === 0 || clean.charAt(0) === '/') {
    return clean;
  }
  const out: string[] = [];
  const segs = (fromDir ? sanitizeRelPath(fromDir).split('/') : []).concat(clean.split('/'));
  for (const s of segs) {
    if (s === '' || s === '.') {
      continue;
    }
    if (s === '..') {
      out.pop();
      continue;
    }
    out.push(s);
  }
  return out.join('/');
}
```

- [ ] **Step 4: تشغيل الاختبار للتأكد من النجاح**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/paths.ts src/core/paths.test.ts
git commit -m "feat(core): add pure path utilities with tests"
```

### Task 1.3: وحدة النتائج `core/result.ts`

**Files:**
- Create: `src/core/result.ts`
- Test: `src/core/result.test.ts`

**Interfaces:**
- Produces: `type Result<T>`, `ok<T>(value): Result<T>`, `err<T=never>(error): Result<T>`.

- [ ] **Step 1: كتابة الاختبار الفاشل**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ok, err } from './result';

test('ok wraps value', () => {
  const r = ok(42);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value, 42);
});

test('err wraps error', () => {
  const r = err('boom');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'boom');
});
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `npm test`
Expected: FAIL لعدم وجود `./result`.

- [ ] **Step 3: كتابة التنفيذ الأدنى**

```ts
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error };
}
```

- [ ] **Step 4: تشغيل الاختبار للتأكد من النجاح**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/result.ts src/core/result.test.ts
git commit -m "feat(core): add Result type helpers with tests"
```

### Task 1.4: وحدة نظام الملفات `core/fs-util.ts`

**Files:**
- Create: `src/core/fs-util.ts`

**Interfaces:**
- Consumes: `sanitizeRelPath` من `core/paths.ts`.
- Produces:
  - `fileExistsUri(uri: vscode.Uri): Promise<boolean>`
  - `fileExists(rootUri, relPath): Promise<boolean>`
  - `readTextFile(rootUri, relPath): Promise<string | undefined>`
  - `writeFile(rootUri, relPath, content): Promise<void>`
  - `createFileIfMissing(rootUri, relPath, content): Promise<boolean>`

- [ ] **Step 1: كتابة التنفيذ**

```ts
import * as vscode from 'vscode';
import { sanitizeRelPath } from './paths';

export async function fileExistsUri(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function fileExists(rootUri: vscode.Uri, relPath: string): Promise<boolean> {
  const clean = sanitizeRelPath(relPath);
  if (!clean) {
    return false;
  }
  return fileExistsUri(vscode.Uri.joinPath(rootUri, ...clean.split('/')));
}

export async function readTextFile(rootUri: vscode.Uri, relPath: string): Promise<string | undefined> {
  const clean = sanitizeRelPath(relPath);
  if (!clean) {
    return undefined;
  }
  try {
    const raw = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(rootUri, ...clean.split('/')));
    return Buffer.from(raw).toString('utf8');
  } catch {
    return undefined;
  }
}

export async function writeFile(rootUri: vscode.Uri, relPath: string, content: string): Promise<void> {
  const clean = sanitizeRelPath(relPath);
  if (!clean) {
    throw new Error('Invalid path: ' + relPath);
  }
  const uri = vscode.Uri.joinPath(rootUri, ...clean.split('/'));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

export async function createFileIfMissing(rootUri: vscode.Uri, relPath: string, content: string): Promise<boolean> {
  if (await fileExists(rootUri, relPath)) {
    return false;
  }
  const parts = sanitizeRelPath(relPath).split('/');
  parts.pop();
  if (parts.length > 0) {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, ...parts));
  }
  await writeFile(rootUri, relPath, content);
  return true;
}
```

- [ ] **Step 2: التحقق من البناء**

Run: `npm run compile`
Expected: نجاح بلا أخطاء.

- [ ] **Step 3: Commit**

```bash
git add src/core/fs-util.ts
git commit -m "feat(core): add vscode fs utilities"
```

### Task 1.5: تقرير Phase 1 والتحقق

- [ ] **Step 1: التحقق الشامل**

Run: `npm run compile && npm test`
Expected: tsc ناجح، كل اختبارات الوحدة PASS.

- [ ] **Step 2: Commit (إن بقيت تغييرات) + دفع**

```bash
git push origin main
```

---

## Phase 2 — نواة Tailwind النقية

- **Task 2.1:** `tailwind/adapter.ts` — واجهة `TailwindAdapter` + مصنع اختيار (اختبارات على أوامر/توجيهات/`usesJsConfig`).
- **Task 2.2:** `tailwind/adapter-v3.ts` — CLI `tailwindcss`، `@tailwind ...`، config=true، content=config.
- **Task 2.3:** `tailwind/adapter-v4.ts` — CLI `@tailwindcss/cli`، `@import "tailwindcss"`، config=false (إلا `@config`)، `detectApplyErrorNeedsReference`.
- **Task 2.4:** `tailwind/detect.ts` — كشف الإصدار من node_modules ثم CSS ثم الافتراضي (اختبارات).
- **Task 2.5:** `tailwind/framework.ts` — كشف Vite/Next/Nuxt/Angular/... وتوليد `content` (اختبارات).
- **Task 2.6:** `tailwind/plan.ts` — `getBuildPlan`/`isGeneratedCss`/`isPlanInput` (اختبارات).
- **Task 2.7:** `tailwind/imports.ts` — managed imports + page-scoped + add/remove import (اختبارات منطق نصي).
- **Task 2.8:** `tailwind/templates.ts` — قوالب HTML/CSS/JS الأساسية.

## Phase 3 — workspace + state

- **Task 3.1:** `workspace/workspace.ts` — اختيار الجذر، المطابقة، Multi-root.
- **Task 3.2:** `core/state.ts` — OutputChannel/StatusBar/الأعلام.

## Phase 4 — build + watch

- **Task 4.1:** `tailwind/build.ts` — `buildNow` عبر `spawn` بلا shell + Diagnostics من المخرجات.
- **Task 4.2:** `tailwind/watch.ts` — watch مُدار قابل للإلغاء + أهداف متعددة.

## Phase 5 — المستكشف

- **Task 5.1:** `explorer/entry.ts` — `CleanEntry`.
- **Task 5.2:** `explorer/provider.ts` — tree data provider + فرز/استبعاد.
- **Task 5.3:** `explorer/dnd.ts` — سحب/إفلات.
- **Task 5.4:** `explorer/actions.ts` — new/rename/delete/move + resync imports.

## Phase 6 — الأوامر

- **Task 6.1:** `commands/create-project.ts` (+webview wiring).
- **Task 6.2:** `commands/create-page.ts` (+اختيار قالب من `pages-library`).
- **Task 6.3:** `commands/check-project.ts`.
- **Task 6.4:** `commands/link-asset.ts` — Link + Unlink.
- **Task 6.5:** `tailwind/pages-library.ts` — قوالب الصفحات الجاهزة.

## Phase 7 — التشخيص

- **Task 7.1:** `diagnostics/build-diagnostics.ts` — أخطاء البناء موحّدة.
- **Task 7.2:** `diagnostics/provider.ts` — تشخيص لحظي + Code Actions.

## Phase 8 — Webview

- **Task 8.1:** `webview/html.ts` — واجهة الإنشاء.
- **Task 8.2:** `webview/panel.ts` — لوحة + CSP.

## Phase 9 — الربط والتقوية

- **Task 9.1:** إعادة كتابة `extension.ts` كتسجيل فقط.
- **Task 9.2:** تحديث `package.json` (مساهمات/أوامر/إعدادات/`engines`).
- **Task 9.3:** تقوية أمنية (spawn، تنقية، Workspace Trust، شريط حالة مشروط).

## Phase 10 — الترقية v3→v4

- **Task 10.1:** `commands/upgrade.ts` — نسخة احتياطية + تحويل input.css + نقل theme + رسالة مراجعة.

## Phase 11 — التحقق والتحزيم

- **Task 11.1:** تشغيل `npm run compile && npm test`.
- **Task 11.2:** `npm run package` → `tailwind-starter-0.1.0.vsix`.
- **Task 11.3:** تحديث `README.md` و`CHANGELOG.md`.
- **Task 11.4:** دفع نهائي.

## Self-Review (مطابقة المواصفة)

- دعم v3/v4 + كشف تلقائي → Tasks 2.1-2.4 ✔
- content ذكي حسب الإطار → Task 2.5 ✔
- تشخيص لحظي → Task 7.2 ✔
- مكتبة قوالب → Tasks 2.8, 6.5 ✔
- Unlink → Task 6.4 ✔
- watch حقيقي → Task 4.2 ✔
- إعادة هيكلة → كل المراحل ✔
- أمان (spawn/تنقية/Trust/CSP/شريط حالة) → Tasks 9.3, 8.2, 4.1 ✔
- ترقية بأمر صريح + backup → Task 10.1 ✔
- اختبارات وحدة نقية → Tasks 1.2,1.3,2.1-2.7 ✔
- VSIX محلي → Tasks 1.1,11.2 ✔
