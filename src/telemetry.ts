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

export function getUserAgent(platform: string = process.platform, version: string = vscode.version || 'unknown'): string {
  if (platform === 'win32') {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) VSCode/${version} commit-message`
  }
  if (platform === 'darwin') {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) VSCode/${version} commit-message`
  }
  return `Mozilla/5.0 (X11; Linux x86_64) VSCode/${version} commit-message`
}

export function buildEventPayload(data: TelemetryData): Record<string, string | number> {
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

  return eventPayload
}

let telemetryOutputChannel: vscode.OutputChannel | undefined

export function getTelemetryOutputChannel(): vscode.OutputChannel {
  if (!telemetryOutputChannel) {
    telemetryOutputChannel = vscode.window.createOutputChannel('OpenRouter Commit Message')
  }
  return telemetryOutputChannel
}

export function logTelemetry(message: string, data?: any): void {
  const line = data !== undefined
    ? `[telemetry] ${message} ${typeof data === 'object' ? JSON.stringify(data) : data}`
    : `[telemetry] ${message}`
  console.log(line)
  try {
    getTelemetryOutputChannel().appendLine(line)
  } catch {
    // Ignore channel errors
  }
}

/**
 * Sends anonymous usage telemetry to self-hosted Umami instance.
 * Completely non-blocking and fails silently to prevent any disruption.
 * Respects VS Code's global telemetry setting and user preference.
 */
export async function trackCommitGeneration(
  data: TelemetryData,
  extensionMode?: vscode.ExtensionMode,
): Promise<void> {
  try {
    logTelemetry('trackCommitGeneration invoked with:', data)

    const config = vscode.workspace.getConfiguration('generateCommitMessage')
    const telemetryEnabled = config.get<boolean>('enableTelemetry', true)
    if (!telemetryEnabled) {
      logTelemetry('Skipped: generateCommitMessage.enableTelemetry is disabled')
      return
    }

    const appName = (vscode.env.appName || '').toLowerCase()
    const isVSCodium = appName.includes('codium') || appName.includes('oss')
    const isDev = extensionMode === vscode.ExtensionMode.Development

    // Respect global telemetry settings in production VS Code, but allow in VSCodium or development
    if (vscode.env.isTelemetryEnabled === false && !isVSCodium && !isDev) {
      logTelemetry('Skipped: vscode.env.isTelemetryEnabled is false in production')
      return
    }

    if (!UMAMI_URL || !UMAMI_WEBSITE_ID) {
      logTelemetry('Skipped: UMAMI_URL or UMAMI_WEBSITE_ID not configured')
      return
    }

    const eventPayload = buildEventPayload(data)

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

    logTelemetry(`Sending event "${body.payload.name}" to ${UMAMI_URL}/api/send`, eventPayload)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    timeoutId.unref?.()

    const res = await fetch(`${UMAMI_URL}/api/send`, {
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

    const resText = await res.text()
    logTelemetry(`Umami server response (${res.status}):`, resText)
  } catch (err: any) {
    logTelemetry('Error sending telemetry:', err?.message || String(err))
  }
}
