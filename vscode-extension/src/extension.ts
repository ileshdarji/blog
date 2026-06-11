import * as vscode from 'vscode';
import { runGenerateTests } from './commands/generate';
import { runFindCoverageGaps } from './commands/gaps';
import { setApiKey } from './commands/apiKey';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  // ── Register commands ────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('qaGen.generateTests', () =>
      runGenerateTests(context),
    ),
    vscode.commands.registerCommand('qaGen.findCoverageGaps', () =>
      runFindCoverageGaps(context),
    ),
    vscode.commands.registerCommand('qaGen.setApiKey', () =>
      setApiKey(context),
    ),
    vscode.commands.registerCommand('qaGen.showMenu', () =>
      showCommandMenu(context),
    ),
  );

  // ── Status bar item ───────────────────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = 'qaGen.showMenu';
  statusBarItem.text = '$(beaker) QA Gen';
  statusBarItem.tooltip = 'QA Gen — AI Playwright Test Generator';
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);
}

export function deactivate(): void {
  statusBarItem?.dispose();
}

// ── Quick-pick command menu ───────────────────────────────────────────────────

async function showCommandMenu(context: vscode.ExtensionContext): Promise<void> {
  const items: Array<vscode.QuickPickItem & { command: string }> = [
    {
      label: '$(beaker) Generate Tests',
      description: 'Generate Playwright tests from a feature description',
      command: 'qaGen.generateTests',
    },
    {
      label: '$(graph) Find Coverage Gaps',
      description: 'Show source files that have no corresponding spec file',
      command: 'qaGen.findCoverageGaps',
    },
    {
      label: '$(key) Set API Key',
      description: 'Store your Anthropic API key securely',
      command: 'qaGen.setApiKey',
    },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: 'QA Gen — AI Playwright Test Generator',
    placeHolder: 'Select an action',
  });

  if (picked) {
    vscode.commands.executeCommand(picked.command);
  }
}
