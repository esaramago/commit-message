import * as vscode from 'vscode';
import { getGitAPI, getRepositoryDiff, getTargetRepository } from './git';
import { getApiKey, promptAndSetApiKey } from './secrets';
import { buildCommitPrompt } from './prompt';
import {
  fetchAvailableModels,
  generateCommitMessageWithOpenRouter,
  isModelFree,
  POPULAR_FREE_MODELS
} from './openrouter';

export function activate(context: vscode.ExtensionContext) {
  // Command: Generate Commit Message
  const generateCommand = vscode.commands.registerCommand(
    'generate-commit-message.generate',
    async (sourceControlOrRepo?: any) => {
      try {
        const gitAPI = await getGitAPI();
        if (!gitAPI) {
          vscode.window.showErrorMessage('VS Code Git extension was not found or failed to load.');
          return;
        }

        const repo = getTargetRepository(gitAPI, sourceControlOrRepo);
        if (!repo) {
          vscode.window.showInformationMessage('No active Git repository found in the current workspace.');
          return;
        }

        let apiKey = await getApiKey(context);
        if (!apiKey) {
          const action = await vscode.window.showWarningMessage(
            'OpenRouter API Key is not configured.',
            'Set API Key'
          );
          if (action === 'Set API Key') {
            apiKey = await promptAndSetApiKey(context);
          }
          if (!apiKey) {
            return;
          }
        }

        const config = vscode.workspace.getConfiguration('generateCommitMessage');
        const includeUnstaged = config.get<boolean>('includeUnstagedIfNoStaged', true);
        const customPrompt = config.get<string>('customPrompt', '');
        const model = config.get<string>('model', 'meta-llama/llama-3.3-70b-instruct:free');

        const diffResult = await getRepositoryDiff(repo, includeUnstaged);
        if (!diffResult) {
          vscode.window.showInformationMessage(
            'No git changes detected. Stage your changes or modify files to generate a commit message.'
          );
          return;
        }

        const messages = buildCommitPrompt(diffResult.diff, customPrompt);

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Generating commit message using ${model}...`,
            cancellable: true
          },
          async (_progress, token) => {
            const commitMessage = await generateCommitMessageWithOpenRouter(
              apiKey,
              model,
              messages,
              token
            );

            if (token.isCancellationRequested) {
              return;
            }

            repo.inputBox.value = commitMessage;
            vscode.window.showInformationMessage('Commit message generated and inserted into Source Control.');
          }
        );
      } catch (err: any) {
        if (err?.message === 'Operation was cancelled.') {
          return;
        }

        const errorMsg = err?.message || String(err);
        if (errorMsg.includes('Invalid OpenRouter API Key')) {
          const action = await vscode.window.showErrorMessage(errorMsg, 'Update API Key');
          if (action === 'Update API Key') {
            await promptAndSetApiKey(context);
          }
        } else {
          vscode.window.showErrorMessage(`Failed to generate commit message: ${errorMsg}`);
        }
      }
    }
  );

  // Command: Set OpenRouter API Key
  const setApiKeyCommand = vscode.commands.registerCommand(
    'generate-commit-message.setApiKey',
    async () => {
      await promptAndSetApiKey(context);
    }
  );

  // Command: Select OpenRouter Model
  const selectModelCommand = vscode.commands.registerCommand(
    'generate-commit-message.selectModel',
    async () => {
      const config = vscode.workspace.getConfiguration('generateCommitMessage');
      const currentModel = config.get<string>('model', 'meta-llama/llama-3.3-70b-instruct:free');
      const apiKey = await getApiKey(context);

      type ModelQuickPickItem = vscode.QuickPickItem & { modelId?: string; isCustom?: boolean };

      const quickPick = vscode.window.createQuickPick<ModelQuickPickItem>();
      quickPick.title = 'Select OpenRouter Model';
      quickPick.placeholder = 'Choose a model or search... (Free models are highlighted)';
      quickPick.busy = true;
      quickPick.show();

      // Show curated list immediately
      const initialItems: ModelQuickPickItem[] = [
        {
          label: '$(edit) Enter custom model ID...',
          description: 'Type any model ID available on OpenRouter',
          isCustom: true
        },
        ...POPULAR_FREE_MODELS.map((m) => ({
          label: `$(gift) ${m.name}`,
          description: `[FREE] ${m.id}`,
          detail: `${m.description}${m.id === currentModel ? ' (Current)' : ''}`,
          modelId: m.id
        }))
      ];
      quickPick.items = initialItems;

      // Try fetching the full list in the background
      fetchAvailableModels(apiKey).then((models) => {
        quickPick.busy = false;
        if (!models || models.length === 0) {
          return;
        }

        const freeModels = models.filter((m) => isModelFree(m));
        const paidModels = models.filter((m) => !isModelFree(m));

        const updatedItems: ModelQuickPickItem[] = [
          {
            label: '$(edit) Enter custom model ID...',
            description: 'Type any model ID available on OpenRouter',
            isCustom: true
          },
          {
            label: 'Free Models',
            kind: vscode.QuickPickItemKind.Separator
          },
          ...freeModels.map((m) => ({
            label: `$(gift) ${m.name || m.id}`,
            description: `[FREE] ${m.id}`,
            detail: `${m.description ? m.description.slice(0, 100) : ''}${
              m.id === currentModel ? ' (Current)' : ''
            }`,
            modelId: m.id
          })),
          {
            label: 'Other Models',
            kind: vscode.QuickPickItemKind.Separator
          },
          ...paidModels.slice(0, 50).map((m) => ({
            label: `$(symbol-variable) ${m.name || m.id}`,
            description: m.id,
            detail: `${m.description ? m.description.slice(0, 100) : ''}${
              m.id === currentModel ? ' (Current)' : ''
            }`,
            modelId: m.id
          }))
        ];

        quickPick.items = updatedItems;
      });

      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        quickPick.hide();

        if (!selected) {
          return;
        }

        let chosenModelId = selected.modelId;

        if (selected.isCustom) {
          chosenModelId = await vscode.window.showInputBox({
            title: 'Custom OpenRouter Model ID',
            prompt: 'Enter the model identifier (e.g. meta-llama/llama-3.3-70b-instruct:free)',
            value: currentModel,
            ignoreFocusOut: true,
            validateInput: (val) => (val && val.trim().length > 0 ? null : 'Model ID cannot be empty')
          });
          if (chosenModelId) {
            chosenModelId = chosenModelId.trim();
          }
        }

        if (chosenModelId) {
          await config.update('model', chosenModelId, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`OpenRouter model set to: ${chosenModelId}`);
        }
      });
    }
  );

  context.subscriptions.push(generateCommand, setApiKeyCommand, selectModelCommand);
}

export function deactivate() {}

