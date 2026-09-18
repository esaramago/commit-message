import * as vscode from 'vscode'
import { getGitAPI, getRepositoryDiff, getTargetRepository } from './git'
import { deleteApiKey, getApiKey, promptAndSetApiKey } from './secrets'
import { buildCommitPrompt } from './prompt'
import {
  fetchAvailableModels,
  generateCommitMessageWithAutoFallback,
  isModelFree,
  isProviderNotFeatured,
  POPULAR_FREE_MODELS,
  POPULAR_PAID_MODELS,
} from './openrouter'

export function activate(context: vscode.ExtensionContext) {
  // Command: Generate Commit Message
  const generateCommand = vscode.commands.registerCommand(
    'commit-message.generate',
    async (sourceControlOrRepo?: any) => {
      try {
        const gitAPI = await getGitAPI()
        if (!gitAPI) {
          vscode.window.showErrorMessage(
            'VS Code Git extension was not found or failed to load.',
          )
          return
        }

        const repo = getTargetRepository(gitAPI, sourceControlOrRepo)
        if (!repo) {
          vscode.window.showInformationMessage(
            'No active Git repository found in the current workspace.',
          )
          return
        }

        let apiKey = await getApiKey(context)
        if (!apiKey) {
          const action = await vscode.window.showWarningMessage(
            'OpenRouter API key is required to generate commit messages. OpenRouter provides access to AI models (including free models) to analyze your git diff.',
            'Set API Key',
            'Learn More',
          )
          if (action === 'Set API Key') {
            apiKey = await promptAndSetApiKey(context)
          } else if (action === 'Learn More') {
            const extensionId =
              context.extension?.id || 'emanuelsaramago.commit-message'
            await vscode.env.openExternal(
              vscode.Uri.parse(
                `https://marketplace.visualstudio.com/items?itemName=${extensionId}#getting-started`,
              ),
            )
          }
          if (!apiKey) {
            return
          }
        }

        const config = vscode.workspace.getConfiguration(
          'generateCommitMessage',
        )
        const includeUnstaged = config.get<boolean>(
          'includeUnstagedIfNoStaged',
          true,
        )
        const customPrompt = config.get<string>('customPrompt', '')
        const model = config.get<string>('model', 'auto:free')
        const isAuto = !model || model === 'auto' || model === 'auto:free'
        let savedAutoModel = context.globalState.get<string>(
          'openrouter.lastWorkingAutoModel',
        )
        // Evict slow/queued models (like Nemotron) from previous session cache
        if (savedAutoModel === 'nvidia/nemotron-3.5-lightning:free') {
          savedAutoModel = undefined
          await context.globalState.update(
            'openrouter.lastWorkingAutoModel',
            undefined,
          )
        }

        const diffResult = await getRepositoryDiff(repo, includeUnstaged)
        if (!diffResult) {
          vscode.window.showInformationMessage(
            'No git changes detected. Stage your changes or modify files to generate a commit message.',
          )
          return
        }

        const messages = buildCommitPrompt(diffResult.diff, customPrompt)
        const displayModel = isAuto
          ? savedAutoModel
            ? `auto:free (${savedAutoModel})`
            : 'auto:free'
          : model

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Generating commit message using ${displayModel}...`,
            cancellable: true,
          },
          async (progress, token) => {
            const result = await generateCommitMessageWithAutoFallback(
              apiKey,
              model,
              messages,
              (status) => progress.report({ message: status }),
              token,
              savedAutoModel,
            )

            if (token.isCancellationRequested) {
              return
            }

            repo.inputBox.value = result.commitMessage

            if (result.isAutoMode) {
              if (result.usedModel && result.usedModel !== savedAutoModel) {
                await context.globalState.update(
                  'openrouter.lastWorkingAutoModel',
                  result.usedModel,
                )
              }
              if (result.fallbackUsed && savedAutoModel) {
                vscode.window.showInformationMessage(
                  `Previous auto model "${savedAutoModel}" was unavailable. Switched to "${result.usedModel}".`,
                )
              }
            } else if (result.fallbackUsed) {
              const action = await vscode.window.showInformationMessage(
                `Model "${result.originalModel}" was unavailable. Successfully generated with "${result.usedModel}".`,
                'Set as Default Model',
              )
              if (action === 'Set as Default Model') {
                await config.update(
                  'model',
                  result.usedModel,
                  vscode.ConfigurationTarget.Global,
                )
              }
            }
          },
        )
      } catch (err: any) {
        if (err?.message === 'Operation was cancelled.') {
          return
        }

        const config = vscode.workspace.getConfiguration('generateCommitMessage')
        const currentModel = config.get<string>('model', 'auto:free')
        const isAuto = !currentModel || currentModel === 'auto' || currentModel === 'auto:free'
        if (isAuto) {
          await context.globalState.update('openrouter.lastWorkingAutoModel', undefined)
        }

        const errorMsg = err?.message || String(err)
        if (errorMsg.includes('Invalid OpenRouter API Key')) {
          const action = await vscode.window.showErrorMessage(
            errorMsg,
            'Update API Key',
          )
          if (action === 'Update API Key') {
            await promptAndSetApiKey(context)
          }
        } else {
          const action = await vscode.window.showErrorMessage(
            `Failed to generate commit message: ${errorMsg}`,
            'Select Another Model',
          )
          if (action === 'Select Another Model') {
            await vscode.commands.executeCommand(
              'commit-message.selectModel',
            )
          }
        }
      }
    },
  )

  // Command: Set OpenRouter API Key
  const setApiKeyCommand = vscode.commands.registerCommand(
    'commit-message.setApiKey',
    async () => {
      await promptAndSetApiKey(context)
    },
  )

  // Command: Clear OpenRouter API Key
  const clearApiKeyCommand = vscode.commands.registerCommand(
    'commit-message.clearApiKey',
    async () => {
      await deleteApiKey(context)
      vscode.window.showInformationMessage(
        'OpenRouter API Key has been removed.',
      )
    },
  )

  // Command: Select OpenRouter Model
  const selectModelCommand = vscode.commands.registerCommand(
    'commit-message.selectModel',
    async () => {
      const config = vscode.workspace.getConfiguration('generateCommitMessage')
      const currentModel = config.get<string>('model', 'auto:free')
      const savedAutoModel = context.globalState.get<string>(
        'openrouter.lastWorkingAutoModel',
      )
      const apiKey = await getApiKey(context)

      type ModelQuickPickItem = vscode.QuickPickItem & {
        modelId?: string
        isCustom?: boolean
      }

      const quickPick = vscode.window.createQuickPick<ModelQuickPickItem>()
      quickPick.title = 'Select OpenRouter Model'
      quickPick.placeholder =
        'Choose a model or search... (Free models are highlighted)'
      quickPick.busy = true
      quickPick.show()

      const isAutoCurrent =
        currentModel === 'auto:free' || currentModel === 'auto'
      const autoDetailSuffix = isAutoCurrent
        ? savedAutoModel
          ? ` (Current: using ${savedAutoModel})`
          : ' (Current)'
        : ''

      const autoOption: ModelQuickPickItem = {
        label: '$(sparkle) Auto (Free)',
        description: 'Recommended',
        detail: `Dynamically selects the currently active free model on OpenRouter${autoDetailSuffix}`,
        modelId: 'auto:free',
      }

      const customOption: ModelQuickPickItem = {
        label: '$(edit) Enter custom model ID...',
        description: 'Type any model ID available on OpenRouter',
        isCustom: true,
      }

      // Show curated list immediately
      const initialItems: ModelQuickPickItem[] = [
        autoOption,
        customOption,
        {
          label: 'Popular Free Models',
          kind: vscode.QuickPickItemKind.Separator,
        },
        ...POPULAR_FREE_MODELS.map((m) => ({
          label: `$(gift) ${m.name}`,
          description: `[FREE] ${m.id}`,
          detail: `${m.description}${m.id === currentModel ? ' (Current)' : ''}`,
          modelId: m.id,
        })),
        {
          label: 'Featured Paid Models',
          kind: vscode.QuickPickItemKind.Separator,
        },
        ...POPULAR_PAID_MODELS.filter((m) => !isProviderNotFeatured(m.id)).map(
          (m) => ({
            label: `$(symbol-variable) ${m.name}`,
            description: m.id,
            detail: `${m.description}${m.id === currentModel ? ' (Current)' : ''}`,
            modelId: m.id,
          }),
        ),
      ]
      quickPick.items = initialItems

      // Fetch live models from OpenRouter
      fetchAvailableModels(apiKey).then((models) => {
        quickPick.busy = false
        if (!models || models.length === 0) {
          return
        }

        const freeModels = models.filter((m) => isModelFree(m))
        const paidModels = models.filter(
          (m) => !isModelFree(m) && !isProviderNotFeatured(m.id),
        )

        const updatedItems: ModelQuickPickItem[] = [
          autoOption,
          customOption,
          {
            label: `Live Free Models (${freeModels.length} available)`,
            kind: vscode.QuickPickItemKind.Separator,
          },
          ...freeModels.map((m) => ({
            label: `$(gift) ${m.name || m.id}`,
            description: `[FREE] ${m.id}`,
            detail: `${m.description ? m.description.slice(0, 100) : ''}${
              m.id === currentModel ? ' (Current)' : ''
            }`,
            modelId: m.id,
          })),
          {
            label: 'Featured Paid Models',
            kind: vscode.QuickPickItemKind.Separator,
          },
          ...paidModels.slice(0, 50).map((m) => ({
            label: `$(symbol-variable) ${m.name || m.id}`,
            description: m.id,
            detail: `${m.description ? m.description.slice(0, 100) : ''}${
              m.id === currentModel ? ' (Current)' : ''
            }`,
            modelId: m.id,
          })),
        ]

        quickPick.items = updatedItems
      })

      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0]
        quickPick.hide()

        if (!selected) {
          return
        }

        let chosenModelId = selected.modelId

        if (selected.isCustom) {
          chosenModelId = await vscode.window.showInputBox({
            title: 'Custom OpenRouter Model ID',
            prompt:
              'Enter the model identifier (e.g. meta-llama/llama-3.3-70b-instruct:free)',
            value: currentModel,
            ignoreFocusOut: true,
            validateInput: (val) =>
              val && val.trim().length > 0 ? null : 'Model ID cannot be empty',
          })
          if (chosenModelId) {
            chosenModelId = chosenModelId.trim()
          }
        }

        if (chosenModelId) {
          if (chosenModelId === 'auto:free' || chosenModelId === 'auto') {
            await context.globalState.update(
              'openrouter.lastWorkingAutoModel',
              undefined,
            )
          }
          await config.update(
            'model',
            chosenModelId,
            vscode.ConfigurationTarget.Global,
          )
          vscode.window.showInformationMessage(
            `OpenRouter model set to: ${chosenModelId}`,
          )
        }
      })
    },
  )

  context.subscriptions.push(
    generateCommand,
    setApiKeyCommand,
    clearApiKeyCommand,
    selectModelCommand,
  )
}

export function deactivate() {}
