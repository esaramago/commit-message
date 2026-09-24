import * as vscode from 'vscode'

const rawUrl = process.env.UMAMI_URL
const UMAMI_URL = rawUrl ? rawUrl.replace(/\/$/, '') : undefined
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID

export interface TelemetryData {
  model: string
  status: 'success' | 'error' | 'cancelled'
  errorType?: string
  originalModel?: string
  isAuto?: boolean
  fallbackUsed?: boolean
  durationMs?: number
}

function getUserAgent(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) VSCode/${vscode.version} commit-message`
  }
  if (platform === 'darwin') {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) VSCode/${vscode.version} commit-message`
  }
  return `Mozilla/5.0 (X11; Linux x86_64) VSCode/${vscode.version} commit-message`
}

/**
 * Sends anonymous usage telemetry to self-hosted Umami instance.
 * Completely non-blocking and fails silently to prevent any disruption.
 * Respects VS Code's global telemetry setting and user preference.
 */
export async function trackCommitGeneration(data: TelemetryData): Promise<void> {
  try {
    // Respect user's VS Code telemetry settings
    if (vscode.env.isTelemetryEnabled === false) {
      return
    }

    const config = vscode.workspace.getConfiguration('generateCommitMessage')
    const telemetryEnabled = config.get<boolean>('enableTelemetry', true)
    if (!telemetryEnabled) {
      return
    }

    if (!UMAMI_URL || !UMAMI_WEBSITE_ID) {
      return
    }

    const eventPayload: Record<string, string | number> = {
      model: data.model,
      status: data.status,
    }

    if (data.errorType) {
      eventPayload.error_type = data.errorType
    }
    if (data.originalModel && data.originalModel !== data.model) {
      eventPayload.original_model = data.originalModel
    }
    if (data.isAuto !== undefined) {
      eventPayload.is_auto = data.isAuto ? 'true' : 'false'
    }
    if (data.fallbackUsed !== undefined) {
      eventPayload.fallback_used = data.fallbackUsed ? 'true' : 'false'
    }
    if (typeof data.durationMs === 'number') {
      eventPayload.duration_ms = Math.round(data.durationMs)
    }

    const body = {
      type: 'event',
      payload: {
        website: UMAMI_WEBSITE_ID,
        hostname: 'commit-message.vscode',
        url: '/generate-commit',
        name: 'generate_commit',
        language: vscode.env.language || 'en',
        data: eventPayload,
      },
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    await fetch(`${UMAMI_URL}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId)
    })
  } catch {
    // Silently ignore network / telemetry errors
  }
}
