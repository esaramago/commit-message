# Changelog

All notable changes to this project will be documented in this file.

## [1.5.1] - 2026-10-23

### Added
- Added `CONTRIBUTING.md` guide covering local development setup, testing, packaging, and release procedures.
- Added animated hero demo GIF (`resources/shot.gif`) to `README.md` showcasing extension usage.

### Changed
- Streamlined `README.md` for marketplace visitors by moving developer and release documentation to `CONTRIBUTING.md`.
- Documented `generateCommitMessage.enableTelemetry` setting and aligned command names in `README.md`.
- Simplified CI/CD release workflow for Node.js and pnpm setup.

## [1.5.0] - 2026-10-08

### Added
- Added detection for reasoning models (e.g., DeepSeek R1, QwQ) to automatically adjust token budgets and prevent unsupported reasoning disable requests.
- Added automatic retry mechanism when endpoints report that reasoning is mandatory and cannot be disabled.
- Added sanitization of `<think>` and `<thought>` tags to prevent reasoning tokens from appearing in commit messages.
- Added unit tests for reasoning model detection, tag sanitization, and mandatory reasoning error handling.

### Fixed
- Fixed `Failed to generate commit message: Reasoning is mandatory for this endpoint and cannot be disabled` error.
- Fixed model unavailability error detection to treat mandatory reasoning errors as recoverable during automatic fallback.

## [1.4.0] - 2026-10-04

### Added
- Added `frequency_penalty` to OpenRouter API requests to minimize repetitive generated text.
- Added unit tests for commit message deduplication and sanitization logic.

### Fixed
- Fixed duplicated commit messages and stripped redundant quotes from AI responses.

## [1.3.0] - 2026-10-04

### Added
- Added robust network error detection and handling during API calls.
- Added informative error notification with a *Retry* action on network failure.

### Changed
- Updated automatic fallback logic to prevent switching models during network/connectivity outages.

## [1.2.0] - 2026-09-24

### Added
- Added anonymous telemetry and usage analytics via a self-hosted Umami instance (can be disabled via settings).
- Added telemetry configuration settings to `package.json`.

## [1.1.0] - 2026-09-17

### Changed
- Refined prompt instructions for more concise messages adhering strictly to Conventional Commits.
- Updated extension icon and repository URLs.

### Fixed
- Handled OpenRouter provider failures as model unavailability with graceful fallback transitions.

## [1.0.0] - 2026-09-17

### Added
- Initial release of the extension.
- Automatic Conventional Commits message generation via OpenRouter API based on Git diff (staged and unstaged).
- `auto:free` mode with persistent caching and dynamic selection of active free models.
- Built-in VS Code commands to set/clear API keys and select models.
- Shortcut button integrated directly into the Source Control (SCM) title bar.