# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4] - 2026-10-04

### Added
- Added `frequency_penalty` to OpenRouter API requests to minimize repetitive generated text.
- Added unit tests for commit message deduplication and sanitization logic.

### Fixed
- Fixed duplicated commit messages and stripped redundant quotes from AI responses.

## [0.1.3] - 2026-10-04

### Added
- Added robust network error detection and handling during API calls.
- Added informative error notification with a *Retry* action on network failure.

### Changed
- Updated automatic fallback logic to prevent switching models during network/connectivity outages.

## [0.1.2] - 2026-09-24

### Added
- Added anonymous telemetry and usage analytics via a self-hosted Umami instance (can be disabled via settings).
- Added telemetry configuration settings to `package.json`.

## [0.1.1] - 2026-09-17

### Changed
- Refined prompt instructions for more concise messages adhering strictly to Conventional Commits.
- Updated extension icon and repository URLs.

### Fixed
- Handled OpenRouter provider failures as model unavailability with graceful fallback transitions.

## [0.1.0] - 2026-09-17

### Added
- Initial release of the extension.
- Automatic Conventional Commits message generation via OpenRouter API based on Git diff (staged and unstaged).
- `auto:free` mode with persistent caching and dynamic selection of active free models.
- Built-in VS Code commands to set/clear API keys and select models.
- Shortcut button integrated directly into the Source Control (SCM) title bar.