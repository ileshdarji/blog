import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { findCoverageGaps } from '../core/coverage';
import { scanTestSuite } from '../core/scanner';
import { generateTests } from '../core/generator';
import { requireApiKey } from './apiKey';
import type { GapFile } from '../core/types';

export async function runFindCoverageGaps(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('QA Gen: Open a workspace folder first.');
    return;
  }

  const config = vscode.workspace.getConfiguration('qaGen');
  const sourceDir = path.join(workspaceRoot, config.get<string>('sourceDirectory', 'src'));
  const testDir = path.join(workspaceRoot, config.get<string>('testDirectory', 'tests'));
  const outputDir = path.join(workspaceRoot, config.get<string>('outputDirectory', 'tests/generated'));
  const model = config.get<string>('model', 'claude-sonnet-4-6');

  // ── Scan for gaps ─────────────────────────────────────────────────────────
  let gaps: GapFile[] = [];

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'QA Gen: Scanning for coverage gaps…', cancellable: false },
    async () => {
      gaps = await findCoverageGaps(sourceDir, testDir, workspaceRoot);
    },
  );

  if (gaps.length === 0) {
    vscode.window.showInformationMessage(
      `QA Gen: No coverage gaps found in ${path.relative(workspaceRoot, sourceDir)}/ 🎉`,
    );
    return;
  }

  // ── Show QuickPick ────────────────────────────────────────────────────────
  const items: Array<vscode.QuickPickItem & { gap: GapFile }> = gaps.map((g) => ({
    label: `$(file-code) ${g.relativePath}`,
    description: g.suggestedFeature,
    detail: 'No corresponding spec file found',
    gap: g,
  }));

  const headerItem: vscode.QuickPickItem = {
    label: `$(warning) ${gaps.length} file${gaps.length > 1 ? 's' : ''} without tests`,
    kind: vscode.QuickPickItemKind.Separator,
  };

  const picked = await vscode.window.showQuickPick([headerItem, ...items], {
    title: 'QA Gen — Coverage Gaps',
    placeHolder: 'Select a file to generate tests for it, or press Escape to dismiss',
    matchOnDescription: true,
    matchOnDetail: false,
  });

  if (!picked || picked.kind === vscode.QuickPickItemKind.Separator) return;

  const selected = (picked as typeof items[0]).gap;

  // ── Confirm and generate ──────────────────────────────────────────────────
  const action = await vscode.window.showInformationMessage(
    `Generate tests for "${selected.suggestedFeature}"?`,
    { modal: false },
    'Generate',
    'Cancel',
  );
  if (action !== 'Generate') return;

  const apiKey = await requireApiKey(context);
  if (!apiKey) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'QA Gen', cancellable: false },
    async (progress) => {
      progress.report({ message: `Scanning test patterns…` });
      const profile = await scanTestSuite(testDir);

      progress.report({ message: `Generating tests for "${selected.suggestedFeature}"…` });
      const generated = await generateTests(
        { feature: selected.suggestedFeature, testDir, outputDir, model },
        profile,
        apiKey,
      );

      progress.report({ message: 'Writing file…' });
      fs.mkdirSync(outputDir, { recursive: true });
      const outPath = resolveNonConflicting(path.join(outputDir, generated.filename));
      fs.writeFileSync(outPath, generated.content, 'utf-8');

      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outPath));
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(
        `QA Gen: Tests generated (${generated.tokensUsed.toLocaleString()} tokens). Review before committing.`,
      );
    },
  );
}

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function resolveNonConflicting(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  let i = 1;
  let candidate = `${base}-${i}${ext}`;
  while (fs.existsSync(candidate)) candidate = `${base}-${++i}${ext}`;
  return candidate;
}
