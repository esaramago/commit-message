import { ChatMessage } from './types'

const MAX_DIFF_LENGTH = 16000

export function buildCommitPrompt(
  diff: string,
  customPrompt?: string,
): ChatMessage[] {
  let truncatedDiff = diff
  if (diff.length > MAX_DIFF_LENGTH) {
    truncatedDiff =
      diff.slice(0, MAX_DIFF_LENGTH) +
      '\n\n[... diff truncated due to length ...]'
  }

  const systemInstructions = [
    'You are an expert software developer and Git assistant.',
    'Your task is to write a concise, direct, and accurate Git commit message based on the provided git diff.',
    '',
    'Follow the Conventional Commits specification strictly:',
    'Format: <type>(<optional scope>): <description>',
    '',
    'Allowed types:',
    '- feat: A new feature',
    '- fix: A bug fix',
    '- docs: Documentation only changes',
    '- style: Code style/formatting changes that do not affect code logic',
    '- refactor: Code changes that neither fix a bug nor add a feature',
    '- perf: A code change that improves performance',
    '- test: Adding or correcting tests',
    '- build: Changes that affect the build system or external dependencies',
    '- ci: Changes to CI configuration files and scripts',
    '- chore: Other changes that do not modify src or test files',
    '- revert: Reverts a previous commit',
    '',
    'Rules:',
    '1. Language MUST be English.',
    '2. Keep the commit message short, direct, and to the point. Focus strictly on the primary intent and avoid fluff.',
    '3. Prefer a single-line commit message. Do NOT add a body unless strictly necessary; if essential, keep it to at most 1-2 brief bullet points.',
    '4. The subject line must be in the imperative present tense (e.g., "add", "fix", "change", not "added", "fixed", "changes").',
    '5. Do NOT capitalize the first letter of the subject description after the colon and do NOT put a period at the end.',
    '6. Keep the subject line short (ideally under 50-72 characters).',
    '7. Return ONLY the raw commit message. Do NOT wrap in markdown codeblocks (no ```), do NOT add any introductions, explanations, or quotes.',
  ]

  if (customPrompt && customPrompt.trim().length > 0) {
    systemInstructions.push(
      '',
      'Additional User Instructions:',
      customPrompt.trim(),
    )
  }

  return [
    {
      role: 'system',
      content: systemInstructions.join('\n'),
    },
    {
      role: 'user',
      content: `Analyze the following git diff and generate the commit message:\n\n${truncatedDiff}`,
    },
  ]
}

export function cleanCommitMessage(rawMessage: string): string {
  let cleaned = rawMessage.trim()

  // Strip wrapping markdown code blocks if the LLM outputted them anyway
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\r?\n/, '')
    cleaned = cleaned.replace(/\r?\n```$/, '')
    cleaned = cleaned.trim()
  }

  // Strip surrounding quotes if wrapped in single or double quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('`') && cleaned.endsWith('`'))
  ) {
    cleaned = cleaned.slice(1, -1).trim()
  }

  return cleaned
}
