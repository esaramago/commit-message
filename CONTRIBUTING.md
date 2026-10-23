# Contributing to OpenRouter Commit Message

Thank you for your interest in contributing to **OpenRouter Commit Message**! This guide outlines how to set up your local development environment, run tests, and handle releases.

---

## 🛠️ Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or newer recommended)
- [pnpm](https://pnpm.io/) (Corepack enabled: `corepack enable`)
- [VS Code](https://code.visualstudio.com/) or [VSCodium](https://vscodium.com/)

### Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/esaramago/commit-message.git
   cd commit-message
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build commands:**
   ```bash
   # Compile extension into dist/extension.js
   pnpm run compile

   # Watch mode (automatically rebuilds on save)
   pnpm run watch

   # Run TypeScript type check
   pnpm run typecheck

   # Run test suite
   pnpm run test
   ```

4. **Debugging the Extension:**
   - Open the project folder in VS Code or VSCodium.
   - Press `F5` (or go to **Run and Debug** -> **Run Extension**).
   - A new *Extension Development Host* window will open with the extension loaded for testing.

---

## 📦 Packaging

To test local packaging without publishing:

```bash
pnpm run package
```

This generates a `.vsix` file in the project root that can be installed manually using `code --install-extension <filename>.vsix`.

---

## 🚀 Releasing & Publishing

Publishing to the [Open VSX Registry](https://open-vsx.org) is automated with GitHub Actions using **Open VSX Trusted Publishing** (OIDC authentication without static access tokens).

### Automated Release (via Git Tag)

1. Bump the version in `package.json` and update `CHANGELOG.md`.
2. Commit the changes:
   ```bash
   git commit -am "chore(release): v0.1.6"
   ```
3. Create and push a version tag:
   ```bash
   git tag v0.1.6
   git push origin v0.1.6
   ```
4. The CI workflow (`.github/workflows/release.yml`) will automatically:
   - Run type checks and tests.
   - Package the `.vsix` bundle.
   - Publish to Open VSX via Trusted Publishing (`--trusted-publishing`).
   - Create a GitHub Release with the `.vsix` artifact attached.

### Manual Release

You can also trigger publication manually from GitHub:
1. Go to the repository's **Actions** tab.
2. Select the **Release & Publish** workflow.
3. Click **Run workflow** on the `main` branch.

---

## 📜 Code & Commit Guidelines

- **Language**: All code, comments, documentation, and commits must be in English.
- **Commit Style**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
