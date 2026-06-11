import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { scanTestSuite } from '../core/scanner';
import { generateTests } from '../core/generator';
import { requireApiKey } from './apiKey';

export async function runGenerateTests(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('QA Gen: Open a workspace folder first.');
    return;
  }

  const apiKey = await requireApiKey(context);
  if (!apiKey) return;

  const config = vscode.workspace.getConfiguration('qaGen');
  const testDir = path.join(workspaceRoot, config.get<string>('testDirectory', 'tests'));
  const outputDir = path.join(workspaceRoot, config.get<string>('outputDirectory', 'tests/generated'));
  const model = config.get<string>('model', 'claude-sonnet-4-6');

  // ── Step 1: feature description ───────────────────────────────────────────
  const feature = await vscode.window.showInputBox({
    title: 'QA Gen — Generate Tests',
    prompt: 'Describe the feature or user story to generate tests for',
    placeHolder: 'e.g. User can reset their password via email link',
    validateInput: (v) => (v.trim().length < 5 ? 'Please enter a meaningful description' : undefined),
  });
  if (!feature) return;

  // ── Step 2: optional URL ──────────────────────────────────────────────────
  const url = await vscode.window.showInputBox({
    title: 'QA Gen — Generate Tests',
    prompt: 'URL to test (optional — press Enter to skip)',
    placeHolder: 'https://myapp.com/auth/reset',
  });

  // ── Step 3: scan + generate with progress ────────────────────────────────
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'QA Gen',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Scanning test patterns…' });

      const profile = await scanTestSuite(testDir);

      const patternSummary =
        profile.exampleTests.length > 0
          ? `${profile.exampleTests.length} spec(s) found · strategy: ${profile.selectorStrategy}`
          : 'No existing tests — using best practices';

      progress.report({ message: `Generating tests… (${patternSummary})` });

      const generated = await generateTests(
        { feature, url: url || undefined, testDir, outputDir, model },
        profile,
        apiKey,
      );

      progress.report({ message: 'Writing file…' });

      // Ensure output dir exists
      fs.mkdirSync(outputDir, { recursive: true });
      const outPath = resolveNonConflicting(path.join(outputDir, generated.filename));
      fs.writeFileSync(outPath, generated.content, 'utf-8');

      // Open the file in the editor
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outPath));
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(
        `QA Gen: Tests generated (${generated.tokensUsed.toLocaleString()} tokens). Review before committing.`,
        'Open File',
      );
    },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
