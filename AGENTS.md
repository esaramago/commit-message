# AGENTS.md

Technical guide and conventions for AI agents and developers working on this extension.

---

## 1. Project Overview

`generate-commit-message` is a lightweight VS Code / VSCodium extension that automatically generates Conventional Commits messages using the OpenRouter API based on your current Git diff.

### Key Goals
- **Simplicity and Speed**: Fast startup, zero heavy runtime dependencies, bundled into a single file with `esbuild`.
- **Cost Efficiency**: Prioritizes and highlights free models (`:free`) available on OpenRouter (defaulting to `auto:free` with automatic fallback when a model is disabled or changes to paid).
- **Standard Commits**: Enforces the Conventional Commits specification in English without noise or markdown codeblock wrappers.
- **Native SCM Integration**: Places buttons directly into the Source Control title bar.

---

## 2. Architecture & File Structure

```
.
├── .vscode/
│   ├── launch.json        # Debug configuration for Extension Development Host (F5)
│   ├── settings.json      # Workspace editor settings
│   └── tasks.json         # Background build tasks (esbuild watch)
├── src/
│   ├── extension.ts       # Extension entry point (activate/deactivate, commands registration)
│   ├── git.ts             # VS Code Git extension integration (repo detection, diff extraction)
│   ├── openrouter.ts      # OpenRouter API client, model listing and free model filters
│   ├── prompt.ts          # Conventional Commits prompt builder and message sanitization
│   ├── secrets.ts         # Secure credential storage via vscode.SecretStorage
│   └── types.ts           # TypeScript interfaces for OpenRouter and Git API
├── .vscodeignore          # Packaging exclusion list
├── package.json           # Extension manifest (commands, configuration, menus, dependencies)
├── tsconfig.json          # TypeScript compiler options
└── README.md              # User-facing documentation
```

---

## 3. Data Flow

1. **Trigger**: User clicks the sparkle `$(sparkle)` icon on the SCM input box or runs `generate-commit-message.generate`.
2. **Git API**: Extension queries `vscode.git` to identify the active repository and checks:
   - Staged changes (`repo.diff(true)`)
   - If empty, falls back to unstaged working tree changes (`repo.diff(false)`) if enabled in settings.
3. **API Key & Model**:
   - Retrieves OpenRouter API Key from `context.secrets.get('openrouter.apiKey')`.
   - Reads model preference from `generateCommitMessage.model`.
4. **Prompt Construction**: `buildCommitPrompt` injects Conventional Commits rules, diff text (safely truncated if large), and any optional custom instructions.
5. **OpenRouter Completion**: Sends request using native `fetch` to `https://openrouter.ai/api/v1/chat/completions`.
6. **Insertion**: Cleans up response (stripping markdown code fences or quotes) and sets `repo.inputBox.value`.

---

## 4. OpenRouter Free Models & Auto-Fallback
 
OpenRouter provides free models identified by the `:free` suffix or pricing set to `0`.
Because free models rotate and providers can decommission or convert free slugs to paid at any time, the extension implements an **Auto-Fallback Mechanism**:
1. **Default Mode (`auto:free`)**: Dynamically queries the public `https://openrouter.ai/api/v1/models` endpoint for the top active free model.
2. **Auto-Recovery**: If a requested model responds with `unavailable for free` or `no endpoints found`, the extension catches the error, fetches the live list of currently active free models, and seamlessly retries with an active free alternative.
3. **Live Selector**: The model picker lists real-time active free models fetched live from OpenRouter.

---

## 5. Development & Build Workflow

- **Package Manager**: `pnpm` (Corepack managed).
- **Compile**: `pnpm run compile` (bundles `src/extension.ts` into `dist/extension.js` via `esbuild`).
- **Watch**: `pnpm run watch`.
- **Type Check**: `pnpm run typecheck` (`tsc --noEmit`).
- **Debugging**: Press `F5` in VS Code / VSCodium to start an *Extension Development Host* window.
