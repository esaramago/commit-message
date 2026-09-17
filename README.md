# Generate commit message extension
# Generate Commit Message

This extension for vscode and vscodium simply generates a Git commit message based on your project's git diff.
It uses openrouter API from. You'll need an API key for it.
You can select your preferred model.
A simple and fast extension for **VS Code** and **VSCodium** that generates clear, concise Git commit messages following the **Conventional Commits** specification based on your repository's git diff, powered by the **OpenRouter API**.

---

## Features

- ✨ **One-Click Generation**: Click the `$(sparkle)` icon in your Source Control (SCM) commit box or Source Control title bar.
- 🆓 **Free Models First**: Defaulted to high-performance free models on OpenRouter (`meta-llama/llama-3.3-70b-instruct:free`, `google/gemini-2.0-flash-exp:free`, `qwen/qwen-2.5-coder-32b-instruct:free`, etc.).
- 📐 **Conventional Commits**: Automatically categorizes changes (`feat`, `fix`, `docs`, `refactor`, `chore`, etc.) in standard English.
- 🔒 **Secure Storage**: API keys are encrypted using VS Code's native `SecretStorage`.
- 🔄 **Smart Fallback**: Analyzes staged changes first; if nothing is staged, falls back to working tree changes.

---

## Getting Started

### 1. Get an OpenRouter API Key
1. Visit [openrouter.ai](https://openrouter.ai/keys) and create a free account.
2. Create an API key (`sk-or-v1-...`). You can use free models without adding any credits!

### 2. Configure the Extension
- Run the command:
  `Generate Commit Message: Set OpenRouter API Key`
  and paste your key.
- (Optional) Choose your preferred model by running:
  `Generate Commit Message: Select OpenRouter Model`
  (Free models are highlighted with `[FREE]`).

### 3. Generate Commit Messages
1. Stage your changes (or leave them in the working tree).
2. Click the **sparkle icon** next to the commit message box in the Source Control view, or press `Ctrl+Shift+P` / `Cmd+Shift+P` and run `Generate Commit Message`.
3. The generated commit message will be inserted automatically into the commit input field!

---

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `generateCommitMessage.model` | `meta-llama/llama-3.3-70b-instruct:free` | Model ID to use from OpenRouter. |
| `generateCommitMessage.includeUnstagedIfNoStaged` | `true` | When no changes are staged, analyze working tree diffs. |
| `generateCommitMessage.customPrompt` | `""` | Additional instructions to append to the commit generation prompt. |

---

## Development

```bash
# Install dependencies
pnpm install

# Compile extension
pnpm run compile

# Type check
pnpm run typecheck

# Start watch mode
pnpm run watch
```

Press `F5` to open a new VS Code window with the extension loaded for testing.