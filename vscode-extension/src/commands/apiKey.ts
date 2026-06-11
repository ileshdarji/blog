import * as vscode from 'vscode';

const SECRET_KEY = 'qaGen.anthropicApiKey';

export async function setApiKey(context: vscode.ExtensionContext): Promise<void> {
  const current = await context.secrets.get(SECRET_KEY);

  const value = await vscode.window.showInputBox({
    title: 'QA Gen — Set Anthropic API Key',
    prompt: 'Enter your Anthropic API key (starts with sk-ant-)',
    password: true,
    value: current ?? '',
    placeHolder: 'sk-ant-...',
    validateInput: (v) => {
      if (!v.trim()) return 'API key cannot be empty';
      if (!v.startsWith('sk-ant-') && !v.startsWith('sk-')) return 'Key should start with sk-ant-';
      return undefined;
    },
  });

  if (value === undefined) return; // user cancelled

  await context.secrets.store(SECRET_KEY, value.trim());
  vscode.window.showInformationMessage('QA Gen: API key saved securely.');
}

export async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  return context.secrets.get(SECRET_KEY);
}

export async function requireApiKey(context: vscode.ExtensionContext): Promise<string | null> {
  const key = await getApiKey(context);
  if (key) return key;

  const action = await vscode.window.showWarningMessage(
    'QA Gen: No Anthropic API key found.',
    'Set API Key',
    'Cancel',
  );
  if (action === 'Set API Key') {
    await setApiKey(context);
    return getApiKey(context).then((k) => k ?? null);
  }
  return null;
}
