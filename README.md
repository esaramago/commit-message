# Generate Commit Message

A simple and fast extension for **VS Code** and **VSCodium** that generates clear, concise Git commit messages following the **Conventional Commits** specification based on your repository's git diff, powered by the **OpenRouter API**.

---

## Features

- ✨ **One-Click Generation**: Click the `$(sparkle)` icon in the Source Control (SCM) title bar.
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
- To remove your stored key at any time, run:
  `Generate Commit Message: Clear OpenRouter API Key`
- (Optional) Choose your preferred model by running:
  `Generate Commit Message: Select OpenRouter Model`
  (Free models are highlighted with `[FREE]`).

### 3. Generate Commit Messages
1. Stage your changes (or leave them in the working tree).
2. Click the **sparkle icon** (`$(sparkle)`) in the Source Control title bar, or press `Ctrl+Shift+P` / `Cmd+Shift+P` and run `Generate Commit Message`.
3. The generated commit message will be inserted automatically into the commit input field!

---

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `generateCommitMessage.model` | `auto:free` | Model ID to use from OpenRouter. Use `auto:free` to automatically pick active free models. |
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

---

## Releasing & Publishing

Publishing to the [Open VSX Registry](https://open-vsx.org) is automated with GitHub Actions using **Open VSX Trusted Publishing** (OIDC authentication without static access tokens).

### Automated Release (via Git Tag)
1. Bump the version in `package.json`.
2. Create and push a version tag:
   ```bash
   git tag v0.1.5
   git push origin v0.1.5
   ```
3. The CI workflow (`.github/workflows/release.yml`) will automatically:
   - Run type checks and tests.
   - Package the `.vsix` bundle.
   - Publish to Open VSX via Trusted Publishing (`--trusted-publishing`).
   - Create a GitHub Release with the `.vsix` artifact attached.

### Manual Release
You can also trigger publication manually from the **Actions** tab on GitHub by selecting the **Release & Publish** workflow and clicking **Run workflow**.

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later) - a strong copyleft license requiring any modified or derivative works to remain open-source under the same terms.