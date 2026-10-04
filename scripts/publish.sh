#!/usr/bin/env bash

set -e

# Change directory to the project root
cd "$(dirname "$0")/.."

# Load environment variables from .env if present
if [ -f ".env" ]; then
  ENV_TOKEN=$(grep -E '^(OPEN_VSX_TOKEN|OVSX_PAT|OPENVSX_TOKEN)=' .env | head -n 1 | cut -d '=' -f2- | tr -d ' "'\''')
  if [ -n "$ENV_TOKEN" ]; then
    OPEN_VSX_TOKEN="$ENV_TOKEN"
  fi
fi

TOKEN=""
VSIX_FILE=""
REBUILD=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--pat|--token)
      TOKEN="$2"
      shift 2
      ;;
    -b|--build|--package)
      REBUILD=true
      shift
      ;;
    *.vsix)
      VSIX_FILE="$1"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [extension.vsix] [-p <token>] [-b|--build]"
      echo ""
      echo "Options:"
      echo "  -p, --pat, --token <token>   Open VSX Personal Access Token"
      echo "  -b, --build, --package       Force rebuilding the VSIX package before publishing"
      echo "  -h, --help                   Show this help message"
      echo ""
      echo "Token can also be provided via OPEN_VSX_TOKEN in .env or as environment variable."
      exit 0
      ;;
    *)
      if [ -z "$TOKEN" ]; then
        TOKEN="$1"
      fi
      shift
      ;;
  esac
done

# Fallback to environment variable
if [ -z "$TOKEN" ]; then
  TOKEN="${OPEN_VSX_TOKEN:-${OVSX_PAT:-$OPENVSX_TOKEN}}"
fi

# Determine default VSIX file from package.json if not specified
if [ -z "$VSIX_FILE" ]; then
  NAME=$(node -p "require('./package.json').name")
  VERSION=$(node -p "require('./package.json').version")
  VSIX_FILE="${NAME}-${VERSION}.vsix"
fi

# If rebuild requested or VSIX file doesn't exist, generate it
if [ "$REBUILD" = true ] || [ ! -f "$VSIX_FILE" ]; then
  echo "📦 Packaging extension ($VSIX_FILE)..."
  if command -v pnpm >/dev/null 2>&1; then
    pnpm run generate
  elif command -v npm >/dev/null 2>&1; then
    npm run generate
  else
    npx --yes @vscode/vsce package
  fi
fi

if [ ! -f "$VSIX_FILE" ]; then
  echo "❌ Error: Package file '$VSIX_FILE' not found." >&2
  exit 1
fi

# Check if ovsx is available
if ! command -v ovsx >/dev/null 2>&1; then
  echo "❌ Error: 'ovsx' command was not found in PATH." >&2
  echo "Ensure ovsx is installed (e.g. npm install -g ovsx or pnpm add -g ovsx)." >&2
  exit 1
fi

# Prompt for token if still missing
if [ -z "$TOKEN" ]; then
  read -s -p "Enter Open VSX Personal Access Token (PAT): " TOKEN
  echo ""
fi

if [ -z "$TOKEN" ]; then
  echo "❌ Error: Open VSX token is required to publish." >&2
  echo "Usage: $0 [file.vsix] [-p <token>]" >&2
  echo "Or define OPEN_VSX_TOKEN in your .env file." >&2
  exit 1
fi

echo "🚀 Publishing $VSIX_FILE to Open VSX..."
ovsx publish "$VSIX_FILE" -p "$TOKEN"

echo "✅ Successfully published $VSIX_FILE to Open VSX!"
