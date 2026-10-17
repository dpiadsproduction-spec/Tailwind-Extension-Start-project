import * as vscode from 'vscode';
import { readTextFile, writeFile, fileExists } from '../core/fs-util';
import { upgradeInputCss, extractThemeExtend, buildUpgradeNotes, themeComment } from '../tailwind/upgrade';
import { detectProjectMajor } from '../tailwind/detect-vscode';
import { pickRootRemembering, folderUri } from '../workspace/workspace';
import { installTailwind } from './install';

export const UPGRADE_COMMAND = 'tailwind-starter.upgradeToV4';

export async function runUpgrade(context: vscode.ExtensionContext): Promise<void> {
  const root = await pickRootRemembering(context, undefined, 'اختر مشروع الترقية');
  if (!root) {
    return;
  }
  const rootUri = folderUri(root);

  const inputCss = await readTextFile(rootUri, 'input.css');
  const configText = await readTextFile(rootUri, 'tailwind.config.js');
  if (inputCss === undefined && configText === undefined) {
    vscode.window.showErrorMessage('لا يوجد input.css أو tailwind.config.js — لا شيء للترقية.');
    return;
  }

  const major = await detectProjectMajor(rootUri);
  const hasV3Entry = inputCss !== undefined && /@tailwind\s+(base|components|utilities)/.test(inputCss);
  if (major === 4 && !hasV3Entry) {
    vscode.window.showInformationMessage('المشروع يبدو بالفعل على Tailwind v4.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    'سيتم أخذ نسخة احتياطية ثم تحويل input.css إلى صيغة v4. متابعة؟',
    { modal: true },
    'ترقية إلى v4'
  );
  if (confirm !== 'ترقية إلى v4') {
    return;
  }

  let css = inputCss ?? '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';
  const extend = configText ? extractThemeExtend(configText) : undefined;
  const upgraded = upgradeInputCss(css);

  if (inputCss !== undefined) {
    await writeFile(rootUri, 'input.v3.bak.css', inputCss);
  }
  if (configText !== undefined) {
    await writeFile(rootUri, 'tailwind.config.v3.bak.js', configText);
  }

  const notePrefix = '/* tailwind-starter: upgraded to v4 */\n';
  css = notePrefix + themeComment(extend) + upgraded;
  await writeFile(rootUri, 'input.css', css);

  const install = await vscode.window.showInformationMessage(
    'تم إنشاء النسخة الاحتياطية وتحويل input.css. تثبيت Tailwind v4 الآن؟',
    'تثبيت v4',
    'لاحقًا'
  );
  if (install === 'تثبيت v4') {
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'جاري تثبيت Tailwind v4...', cancellable: false },
        async () => installTailwind(rootUri, 4)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage('فشل تثبيت v4: ' + msg);
    }
  }

  const notes = buildUpgradeNotes(configText);
  vscode.window.showWarningMessage('تمت الترقية. راجع:' + '\n- ' + notes.join('\n- '));
  if (await fileExists(rootUri, 'tailwind.config.js')) {
    vscode.window.showInformationMessage('يمكنك حذف tailwind.config.js بعد مراجعة theme (نسخة احتياطية محفوظة).');
  }
}
