import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildCommitPrompt, cleanCommitMessage } from '../src/prompt';
import { isModelFree } from '../src/openrouter';

describe('Prompt & Message Formatting', () => {
  it('should clean wrapped markdown codeblocks', () => {
    const raw = '```\nfeat: add login functionality\n```';
    assert.strictEqual(cleanCommitMessage(raw), 'feat: add login functionality');

    const rawWithLang = '```git\nfix: resolve race condition\n```';
    assert.strictEqual(cleanCommitMessage(rawWithLang), 'fix: resolve race condition');
  });

  it('should clean surrounding quotes', () => {
    assert.strictEqual(cleanCommitMessage('"feat: new feature"'), 'feat: new feature');
    assert.strictEqual(cleanCommitMessage("'fix: bug fix'"), 'fix: bug fix');
    assert.strictEqual(cleanCommitMessage('`chore: update deps`'), 'chore: update deps');
  });

  it('should build prompt with diff and Conventional Commits instructions', () => {
    const diff = 'diff --git a/index.ts b/index.ts\n+console.log("hello");';
    const messages = buildCommitPrompt(diff);

    assert.strictEqual(messages.length, 2);
    assert.strictEqual(messages[0].role, 'system');
    assert.ok(messages[0].content.includes('Conventional Commits'));
    assert.ok(messages[0].content.includes('English'));
    assert.strictEqual(messages[1].role, 'user');
    assert.ok(messages[1].content.includes(diff));
  });

  it('should truncate excessively large diffs', () => {
    const largeDiff = 'a'.repeat(25000);
    const messages = buildCommitPrompt(largeDiff);

    assert.ok(messages[1].content.includes('[... diff truncated due to length ...]'));
  });

  it('should include custom prompt instructions when provided', () => {
    const diff = 'diff --git a/a b/a';
    const custom = 'Do not mention documentation changes.';
    const messages = buildCommitPrompt(diff, custom);

    assert.ok(messages[0].content.includes(custom));
  });
});

describe('OpenRouter Free Model Detection', () => {
  it('should detect models with :free suffix', () => {
    assert.strictEqual(isModelFree({ id: 'meta-llama/llama-3.3-70b-instruct:free' }), true);
    assert.strictEqual(isModelFree({ id: 'google/gemini-2.0-flash-exp:free' }), true);
  });

  it('should detect models with pricing 0', () => {
    assert.strictEqual(
      isModelFree({
        id: 'some/custom-model',
        pricing: { prompt: '0', completion: '0' }
      }),
      true
    );
  });

  it('should return false for paid models', () => {
    assert.strictEqual(isModelFree({ id: 'anthropic/claude-3.5-sonnet' }), false);
    assert.strictEqual(
      isModelFree({
        id: 'openai/gpt-4o',
        pricing: { prompt: '0.000005', completion: '0.000015' }
      }),
      false
    );
  });
});

