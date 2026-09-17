import * as vscode from 'vscode';

const SECRET_KEY = 'openrouter.apiKey';

export async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  return await context.secrets.get(SECRET_KEY);
}

export async function setApiKey(context: vscode.ExtensionContext, apiKey: string): Promise<void> {
  await context.secrets.store(SECRET_KEY, apiKey.trim());
}

export async function deleteApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}

export async function promptAndSetApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  const currentKey = await getApiKey(context);
  const input = await vscode.window.showInputBox({
    title: 'OpenRouter API Key',
    prompt: 'Enter your OpenRouter API Key (sk-or-v1-...) to generate commit messages.',
    value: currentKey ?? '',
    password: true,
    ignoreFocusOut: true,
    placeHolder: 'sk-or-v1-...',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'API Key cannot be empty';
      }
      return null;
    }
  });

  if (input !== undefined) {
    await setApiKey(context, input);
    vscode.window.showInformationMessage('OpenRouter API Key has been saved securely.');
    return input.trim();
  }

  return undefined;
}

