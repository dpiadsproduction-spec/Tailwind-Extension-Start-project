import * as vscode from 'vscode';
import { dirOf, relativeHref, resolveHref } from '../core/paths';
import { fileExists } from '../core/fs-util';
import { createAdapter } from '../tailwind/adapter';
import { detectProjectMajor, isTailwindInstalled } from '../tailwind/detect-vscode';
import { detectFramework, contentGlobs, type PackageLike } from '../tailwind/framework';
import { ensureInputCss, ensurePageImport } from '../tailwind/imports-vscode';
import { isGeneratedCss, isPlanInput } from '../tailwind/plan';
import { currentPlan } from '../tailwind/targets';
import { PAGE_SCOPED_MARK } from '../tailwind/imports';
import { buildNow } from '../tailwind/build';
import { pickRootRemembering, folderUri } from '../workspace/workspace';
import { ensureTailwindConfig, ensureWatchScript } from './project-files';
import { ensureTailwindInstalled } from './install';
import { readTextFile } from '../core/fs-util';

export const CHECK_PROJECT_COMMAND = 'tailwind-starter.checkProject';

async function readPackageLike(rootUri: vscode.Uri): Promise<PackageLike> {
  const text = await readTextFile(rootUri, 'package.json');
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as PackageLike;
  } catch {
    return {};
  }
}

function asRelative(f: vscode.Uri): string {
  return vscode.workspace.asRelativePath(f, false).replace(/\\/g, '/');
}

export async function runCheckProject(context: vscode.ExtensionContext): Promise<void> {
  const root = await pickRootRemembering(context, undefined, 'اختر مشروع الفحص');
  if (!root) {
    return;
  }
  const rootUri = folderUri(root);

  let fixedLinks = 0;
  let importsAdded = 0;

  const major = await detectProjectMajor(rootUri);
  const adapter = createAdapter(major);
  const framework = detectFramework(await readPackageLike(rootUri));
  const globs = contentGlobs(framework);
  const configFixed = await ensureTailwindConfig(rootUri, adapter, globs);

  const plan = currentPlan();

  const cssFiles = await vscode.workspace.findFiles('**/*.css', '{**/node_modules/**,**/.git/**}');
  for (const f of cssFiles) {
    const rel = asRelative(f);
    if (rel === 'style.css' || rel === 'output.css' || isPlanInput(rel, plan) || isGeneratedCss(rel, plan)) {
      continue;
    }
    const text = (await readTextFile(rootUri, rel)) || '';
    if (/@(apply|tailwind|screen)\b/.test(text) && text.indexOf(PAGE_SCOPED_MARK) === -1) {
      await ensureInputCss(rootUri);
      if (await ensurePageImport(rootUri, rel)) {
        importsAdded++;
      }
    }
  }

  const htmlFiles = await vscode.workspace.findFiles('**/*.html', '{**/node_modules/**,**/.git/**}');
  for (const f of htmlFiles) {
    const rel = asRelative(f);
    const text = (await readTextFile(rootUri, rel)) || '';
    const correct = relativeHref(rel, 'style.css');
    const linkRe = /<link\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    let hasGood = false;
    let outHref: string | undefined;
    while ((m = linkRe.exec(text)) !== null) {
      const tag = m[0];
      if (!/rel\s*=\s*["']stylesheet["']/i.test(tag)) {
        continue;
      }
      const hm = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
      if (!hm) {
        continue;
      }
      const resolved = resolveHref(dirOf(rel), hm[1]).toLowerCase();
      if (resolved === 'output.css') {
        if (outHref === undefined) {
          outHref = hm[1];
        }
      } else if (isGeneratedCss(resolved, plan)) {
        hasGood = true;
      }
    }
    if (hasGood) {
      continue;
    }
    let updated = text;
    if (outHref !== undefined) {
      updated = updated.replace(outHref, correct);
    } else if (/<\/head\s*>/i.test(updated)) {
      updated = updated.replace(/<\/head\s*>/i, '  <link rel="stylesheet" href="' + correct + '">\n</head>');
    } else {
      continue;
    }
    await vscode.workspace.fs.writeFile(f, Buffer.from(updated, 'utf8'));
    fixedLinks++;
  }

  await ensureWatchScript(rootUri, adapter);

  let installedNote = '';
  if (!(await isTailwindInstalled(rootUri))) {
    const ok = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'جاري تثبيت Tailwind CSS...', cancellable: false },
      async () => ensureTailwindInstalled(rootUri, major)
    );
    if (!ok) {
      vscode.window.showErrorMessage('فشل تثبيت Tailwind. تحقق من الاتصال بالإنترنت.');
      return;
    }
    installedNote = ' وثُبّت Tailwind';
  }

  if (await fileExists(rootUri, 'input.css')) {
    await buildNow(rootUri);
  }

  vscode.window.showInformationMessage(
    'فحص مكتمل' +
      installedNote +
      ': روابط مصلحة=' +
      fixedLinks +
      '، config محدث=' +
      (configFixed ? 'نعم' : 'لا حاجة') +
      '، ملفات CSS مربوطة بالبناء=' +
      importsAdded
  );
}
