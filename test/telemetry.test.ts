import { describe, it } from 'node:test'
import assert from 'node:assert'
import { buildEventPayload, getUserAgent } from '../src/telemetry'

describe('Telemetry Event Formatting', () => {
  it('should format successful commit generation payload', () => {
    const payload = buildEventPayload({
      model: 'google/gemma-4-26b-a4b-it:free',
      status: 'success',
      isAuto: true,
      fallbackUsed: false,
      durationMs: 1234.56,
    })

    assert.deepStrictEqual(payload, {
      model: 'google/gemma-4-26b-a4b-it:free',
      status: 'success',
      is_auto: 'true',
      fallback_used: 'false',
      duration_ms: 1235,
    })
  })

  it('should include fallback and original model when fallback is used', () => {
    const payload = buildEventPayload({
      model: 'cohere/north-mini-code:free',
      originalModel: 'google/gemma-4-26b-a4b-it:free',
      status: 'success',
      isAuto: true,
      fallbackUsed: true,
      durationMs: 2500,
    })

    assert.strictEqual(payload.model, 'cohere/north-mini-code:free')
    assert.strictEqual(payload.original_model, 'google/gemma-4-26b-a4b-it:free')
    assert.strictEqual(payload.fallback_used, 'true')
  })

  it('should include error_type when status is error', () => {
    const payload = buildEventPayload({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      status: 'error',
      errorType: 'timeout',
      durationMs: 10000,
    })

    assert.strictEqual(payload.status, 'error')
    assert.strictEqual(payload.error_type, 'timeout')
    assert.strictEqual(payload.duration_ms, 10000)
  })

  it('should format user agents correctly across platforms', () => {
    const linuxUA = getUserAgent('linux', '1.85.0')
    assert.strictEqual(linuxUA, 'Mozilla/5.0 (X11; Linux x86_64) VSCode/1.85.0 commit-message')

    const darwinUA = getUserAgent('darwin', '1.85.0')
    assert.strictEqual(darwinUA, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) VSCode/1.85.0 commit-message')

    const winUA = getUserAgent('win32', '1.85.0')
    assert.strictEqual(winUA, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VSCode/1.85.0 commit-message')
  })
})
