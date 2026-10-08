import { describe, it } from 'node:test'
import assert from 'node:assert'
import { buildCommitPrompt, cleanCommitMessage } from '../src/prompt'
import {
  isModelFree,
  isModelUnavailableError,
  isProviderNotFeatured,
  prioritizeFreeModels,
  POPULAR_PAID_MODELS,
  isReasoningMandatoryError,
  isKnownReasoningModel,
} from '../src/openrouter'

describe('Prompt & Message Formatting', () => {
  it('should clean wrapped markdown codeblocks', () => {
    const raw = '```\nfeat: add login functionality\n```'
    assert.strictEqual(cleanCommitMessage(raw), 'feat: add login functionality')

    const rawWithLang = '```git\nfix: resolve race condition\n```'
    assert.strictEqual(
      cleanCommitMessage(rawWithLang),
      'fix: resolve race condition',
    )
  })

  it('should clean surrounding quotes', () => {
    assert.strictEqual(
      cleanCommitMessage('"feat: new feature"'),
      'feat: new feature',
    )
    assert.strictEqual(cleanCommitMessage("'fix: bug fix'"), 'fix: bug fix')
    assert.strictEqual(
      cleanCommitMessage('`chore: update deps`'),
      'chore: update deps',
    )
  })

  it('should clean <think> and <thought> reasoning blocks', () => {
    const raw =
      '<think>\nAnalyzing the changes in openrouter.ts\nWe need a fix commit.\n</think>\nfix: resolve reasoning mandatory issue'
    assert.strictEqual(
      cleanCommitMessage(raw),
      'fix: resolve reasoning mandatory issue',
    )

    const rawThought =
      '<thought>\nSome internal reasoning\n</thought>\nfeat: add reasoning support'
    assert.strictEqual(
      cleanCommitMessage(rawThought),
      'feat: add reasoning support',
    )

    const rawWithCodeBlock =
      '<think>Thinking</think>\n```\nfix: handle reasoning endpoint\n```'
    assert.strictEqual(
      cleanCommitMessage(rawWithCodeBlock),
      'fix: handle reasoning endpoint',
    )

    const unclosed = '<think>I ran out of tokens before finishing'
    assert.strictEqual(cleanCommitMessage(unclosed), '')
  })

  it('should deduplicate exact repeated messages without separator', () => {
    const repeated =
      'feat: add telemetry configuration and update version to 0.1.2feat: add telemetry configuration and update version to 0.1.2'
    assert.strictEqual(
      cleanCommitMessage(repeated),
      'feat: add telemetry configuration and update version to 0.1.2',
    )
  })

  it('should deduplicate messages repeated with spaces or newlines', () => {
    assert.strictEqual(
      cleanCommitMessage('feat: add feature\nfeat: add feature'),
      'feat: add feature',
    )
    assert.strictEqual(
      cleanCommitMessage('feat: add feature\n\nfeat: add feature'),
      'feat: add feature',
    )
    assert.strictEqual(
      cleanCommitMessage('feat: add feature feat: add feature'),
      'feat: add feature',
    )
  })

  it('should deduplicate consecutive duplicate lines and clean within lines', () => {
    const input =
      'feat: add user profile\nfeat: add user profile\n\n- add avatar upload\n- add avatar upload\n\n- add bio field'
    const expected =
      'feat: add user profile\n\n- add avatar upload\n\n- add bio field'
    assert.strictEqual(cleanCommitMessage(input), expected)
  })

  it('should not alter legitimate non-repeated messages', () => {
    const single = 'fix(auth): fix password validation check'
    assert.strictEqual(cleanCommitMessage(single), single)

    const multi =
      'feat(api): add new endpoints\n\n- add GET /users\n- add POST /users'
    assert.strictEqual(cleanCommitMessage(multi), multi)
  })

  it('should build prompt with diff and Conventional Commits instructions', () => {
    const diff = 'diff --git a/index.ts b/index.ts\n+console.log("hello");'
    const messages = buildCommitPrompt(diff)

    assert.strictEqual(messages.length, 2)
    assert.strictEqual(messages[0].role, 'system')
    assert.ok(messages[0].content.includes('Conventional Commits'))
    assert.ok(messages[0].content.includes('English'))
    assert.strictEqual(messages[1].role, 'user')
    assert.ok(messages[1].content.includes(diff))
  })

  it('should truncate excessively large diffs', () => {
    const largeDiff = 'a'.repeat(25000)
    const messages = buildCommitPrompt(largeDiff)

    assert.ok(
      messages[1].content.includes('[... diff truncated due to length ...]'),
    )
  })

  it('should include custom prompt instructions when provided', () => {
    const diff = 'diff --git a/a b/a'
    const custom = 'Do not mention documentation changes.'
    const messages = buildCommitPrompt(diff, custom)

    assert.ok(messages[0].content.includes(custom))
  })
})

describe('OpenRouter Free Model Detection', () => {
  it('should detect models with :free suffix', () => {
    assert.strictEqual(
      isModelFree({ id: 'meta-llama/llama-3.3-70b-instruct:free' }),
      true,
    )
    assert.strictEqual(
      isModelFree({ id: 'google/gemini-2.0-flash-exp:free' }),
      true,
    )
  })

  it('should detect models with pricing 0', () => {
    assert.strictEqual(
      isModelFree({
        id: 'some/custom-model',
        pricing: { prompt: '0', completion: '0' },
      }),
      true,
    )
  })

  it('should return false for paid models', () => {
    assert.strictEqual(
      isModelFree({ id: 'anthropic/claude-3.5-sonnet' }),
      false,
    )
    assert.strictEqual(
      isModelFree({
        id: 'openai/gpt-4o',
        pricing: { prompt: '0.000005', completion: '0.000015' },
      }),
      false,
    )
  })
})

describe('Model Unavailability Error Detection', () => {
  it('should detect "unavailable for free" errors', () => {
    const error =
      'This model is unavailable for free. The paid version is available now - use this slug instead: meta-llama/llama-3.3-70b-instruct'
    assert.strictEqual(isModelUnavailableError(error), true)
  })

  it('should detect "no endpoints found" errors', () => {
    assert.strictEqual(
      isModelUnavailableError('No endpoints found for this model'),
      true,
    )
  })

  it('should detect timeout errors as model unavailability', () => {
    assert.strictEqual(
      isModelUnavailableError('Request timed out after 12s. The model took too long to respond.'),
      true,
    )
    assert.strictEqual(
      isModelUnavailableError('Gateway Timeout (504)'),
      true,
    )
  })

  it('should not detect authentication or generic account rate limit errors as model unavailability', () => {
    assert.strictEqual(
      isModelUnavailableError('Invalid OpenRouter API Key'),
      false,
    )
    assert.strictEqual(
      isModelUnavailableError('Rate limit exceeded (429)'),
      false,
    )
  })

  it('should detect provider errors and free model queue/rate limit errors as model unavailability', () => {
    assert.strictEqual(
      isModelUnavailableError(
        'OpenRouter rate limit reached. Free models may have hourly limits or queues: Provider returned error',
      ),
      true,
    )
    assert.strictEqual(
      isModelUnavailableError('Provider returned error'),
      true,
    )
    assert.strictEqual(
      isModelUnavailableError('The provider is overloaded. Please try again later.'),
      true,
    )
  })

  it('should detect mandatory reasoning errors as model unavailability', () => {
    assert.strictEqual(
      isModelUnavailableError(
        'Reasoning is mandatory for this endpoint and cannot be disabled.',
      ),
      true,
    )
  })
})

describe('Excluded Provider Filtering for Featured Models', () => {
  it('should exclude models from providers listed in settings.json', () => {
    assert.strictEqual(isProviderNotFeatured('x-ai/grok-2-1212'), true)
    assert.strictEqual(isProviderNotFeatured('~deepseek/deepseek-chat'), true)
  })

  it('should not exclude models from ethical or unlisted providers', () => {
    assert.strictEqual(
      isProviderNotFeatured('anthropic/claude-3.5-sonnet'),
      false,
    )
    assert.strictEqual(isProviderNotFeatured('mistralai/codestral-2501'), false)
    assert.strictEqual(
      isProviderNotFeatured('cohere/north-mini-code:free'),
      false,
    )
  })

  it('should support custom excluded lists', () => {
    const customList = ['deepseek', 'meta-llama']
    assert.strictEqual(
      isProviderNotFeatured('deepseek/deepseek-chat', customList),
      true,
    )
    assert.strictEqual(
      isProviderNotFeatured('meta-llama/llama-3.3-70b-instruct', customList),
      true,
    )
    assert.strictEqual(
      isProviderNotFeatured('openai/gpt-4o', customList),
      false,
    )
  })

  it('should ensure none of the POPULAR_PAID_MODELS are excluded by default', () => {
    for (const model of POPULAR_PAID_MODELS) {
      assert.strictEqual(
        isProviderNotFeatured(model.id),
        false,
        `Model ${model.id} should not be excluded by default`,
      )
    }
  })
})

describe('Free Model Prioritization & Auto Fallback', () => {
  it('should prioritize known fast popular free models in order', () => {
    const mockLive = [
      'stealth/union-alpha',
      'nex-agi/nex-n2.5-mini:free',
      'google/gemma-4-26b-a4b-it:free',
      'random/obscure-model:free',
    ]

    const prioritized = prioritizeFreeModels(mockLive)

    // Popular models should come before obscure models
    assert.strictEqual(prioritized[0], 'google/gemma-4-26b-a4b-it:free')
    assert.strictEqual(prioritized[1], 'nex-agi/nex-n2.5-mini:free')
    // Then other :free models
    assert.strictEqual(prioritized[2], 'random/obscure-model:free')
    // Obscure non-:free models come last
    assert.strictEqual(prioritized[3], 'stealth/union-alpha')
  })

  it('should exclude specified model from prioritization when falling back', () => {
    const mockLive = [
      'google/gemma-4-26b-a4b-it:free',
      'cohere/north-mini-code:free',
    ]

    const prioritized = prioritizeFreeModels(
      mockLive,
      'google/gemma-4-26b-a4b-it:free',
    )
    assert.strictEqual(prioritized.includes('google/gemma-4-26b-a4b-it:free'), false)
    assert.strictEqual(prioritized[0], 'cohere/north-mini-code:free')
  })

  it('should exclude providers listed in settings.json during prioritization', () => {
    const mockLive = [
      'x-ai/grok-free:free',
      'google/gemma-4-26b-a4b-it:free',
    ]

    const prioritized = prioritizeFreeModels(mockLive)
    assert.strictEqual(prioritized.includes('x-ai/grok-free:free'), false)
    assert.strictEqual(prioritized[0], 'google/gemma-4-26b-a4b-it:free')
  })
})

describe('Reasoning Models & Endpoint Handling', () => {
  it('should detect mandatory reasoning error message', () => {
    assert.strictEqual(
      isReasoningMandatoryError(
        'Reasoning is mandatory for this endpoint and cannot be disabled.',
      ),
      true,
    )
    assert.strictEqual(
      isReasoningMandatoryError(
        'Error: reasoning is mandatory for this model endpoint and cannot be disabled',
      ),
      true,
    )
    assert.strictEqual(isReasoningMandatoryError('Some other error'), false)
  })

  it('should identify known reasoning models', () => {
    assert.strictEqual(isKnownReasoningModel('deepseek/deepseek-r1:free'), true)
    assert.strictEqual(isKnownReasoningModel('deepseek/deepseek-reasoner'), true)
    assert.strictEqual(isKnownReasoningModel('qwen/qwq-32b:free'), true)
    assert.strictEqual(isKnownReasoningModel('google/gemma-4-26b-a4b-it:free'), false)
    assert.strictEqual(isKnownReasoningModel('openai/gpt-4o'), false)
  })
})



