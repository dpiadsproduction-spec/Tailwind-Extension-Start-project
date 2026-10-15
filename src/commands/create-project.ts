import * as vscode from 'vscode';
import { pickRootRemembering, folderUri } from '../workspace/workspace';
import { scaffoldProject, type CreateData } from './scaffold';

export const CREATE_PROJECT_COMMAND = 'tailwind-starter.createProject';

export async function runCreateProject(
  context: vscode.ExtensionContext,
  data: CreateData,
  preferredUri?: vscode.Uri
): Promise<void> {
  const root = await pickRootRemembering(context, preferredUri, 'اختر مجلد إنشاء المشروع');
  if (!root) {
    return;
  }
  await scaffoldProject(folderUri(root), data);
}
