import { ChatMessage } from './types'

const MAX_DIFF_LENGTH = 16000

export function preprocessDiff(diff: string): string {
  if (!diff.includes('diff --git ')) {
    return diff
  }

  const lines = diff.split(/\r?\n/)
  const result: string[] = []
  let hunkLines: string[] = []

  const flushHunk = () => {
    if (hunkLines.length === 0) {
      return
    }

    // Count removed lines (trimmed) so we can cancel out identical -/+ pairs
    // caused by EOF newline additions or whitespace/indentation shifts.
    const removedCounts = new Map<string, number>()
    for (const l of hunkLines) {
      if (l.startsWith('-')) {
        const key = l.slice(1).trim()
        if (key) {
          removedCounts.set(key, (removedCounts.get(key) || 0) + 1)
        }
      }
    }

    const cancelCounts = new Map<string, number>()
    for (const l of hunkLines) {
      if (l.startsWith('+')) {
        const key = l.slice(1).trim()
        const rem = removedCounts.get(key) || 0
        const can = cancelCounts.get(key) || 0
        if (key && rem > can) {
          cancelCounts.set(key, can + 1)
        }
      }
    }

    const skipRemoved = new Map(cancelCounts)
    const skipAdded = new Map(cancelCounts)

    for (const l of hunkLines) {
      if (l.startsWith('-')) {
        const key = l.slice(1).trim()
        if (!key) {
          continue
        }
        const left = skipRemoved.get(key) || 0
        if (left > 0) {
          skipRemoved.set(key, left - 1)
          continue
        }
        result.push(l)
      } else if (l.startsWith('+')) {
        const key = l.slice(1).trim()
        if (!key) {
          continue
        }
        const left = skipAdded.get(key) || 0
        if (left > 0) {
          skipAdded.set(key, left - 1)
          continue
        }
        result.push(l)
      }
    }

    hunkLines = []
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      flushHunk()
      result.push(line)
    } else if (
      line.startsWith('new file mode') ||
      line.startsWith('deleted file mode') ||
      line.startsWith('rename from') ||
      line.startsWith('rename to') ||
      line.startsWith('Binary files ')
    ) {
      flushHunk()
      result.push(line)
    } else if (line.startsWith('@@ ')) {
      flushHunk()
    } else if (
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('index ') ||
      line.startsWith('\\ No newline')
    ) {
      continue
    } else if (line.startsWith('+') || line.startsWith('-')) {
      hunkLines.push(line)
    }
    // Unchanged context lines (starting with ' ') are intentionally omitted
    // so the LLM never confuses surrounding untouched code with actual changes.
  }

  flushHunk()

  const cleaned = result.join('\n').trim()
  return cleaned.length > 0 ? cleaned : diff
}

export function buildCommitPrompt(
  diff: string,
  customPrompt?: string,
): ChatMessage[] {
  const cleanedDiff = preprocessDiff(diff)
  let truncatedDiff = cleanedDiff
  if (cleanedDiff.length > MAX_DIFF_LENGTH) {
    truncatedDiff =
      cleanedDiff.slice(0, MAX_DIFF_LENGTH) +
      '\n\n[... diff truncated due to length ...]'
  }

  const systemInstructions = [
    'You are an expert software developer and Git assistant.',
    'Your task is to write a concise, direct, and accurate Git commit message based on the provided git diff.',
    '',
    'Follow the Conventional Commits specification strictly:',
    'Format: <type>(<optional scope>): <description>',
    'Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.',
    '',
    'Rules:',
    '1. Language MUST be English.',
    '2. Group changes by high-level FEATURE or INTENT across the entire diff, NEVER by file or diff hunk.',
    '3. Definition + Export/Import + Usage = 1 FEATURE: If a function, class, variable, or component is created/modified in one place, exported/imported, and called in other files, treat all of those hunks as ONE single feature and write ONLY 1 line for it. NEVER write separate lines for exporting, importing, or calling a symbol.',
    '4. Only describe lines that were actually added (+) or removed (-). Ignore unchanged surrounding context lines in the diff.',
    '5. If all changes in the diff belong to a single logical feature, output ONLY 1 line.',
    '6. Only when the diff contains truly unrelated features (e.g., adding a UI/CSS style AND adding an unrelated backend/logic function), write 1 "<type>(<optional scope>): <description>" line per unrelated feature (do NOT chain unrelated features in one line with "and ... and ..."; maximum 3-4 lines total, no blank lines between them).',
    '7. Do NOT use bullet points ("- ") and do NOT repeat or rephrase the same feature across multiple lines.',
    '8. Use the imperative present tense (e.g., "add", "fix", "change", not "added", "fixed", "changes"), do NOT capitalize the first letter after the colon, do NOT put a period at the end, and keep each line under 72 characters.',
    '9. Return ONLY the raw commit message. Do NOT wrap in markdown codeblocks (no ```), do NOT add any introductions, explanations, or quotes.',
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

const CONVENTIONAL_PREFIX_RE =
  /^(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([^)]+\))?!?:\s*/i

const MAX_COMMIT_LINES = 4

function normalizeTopicForDedup(line: string): string {
  return line
    .trim()
    .replace(/^[-*•]\s*/, '')
    .replace(CONVENTIONAL_PREFIX_RE, '')
    .toLowerCase()
    .replace(/[.;,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanCommitMessage(rawMessage: string): string {
  let cleaned = rawMessage.trim()

  // Strip <think>...</think> and <thought>...</thought> reasoning tags from reasoning models (e.g. DeepSeek R1, QwQ)
  cleaned = cleaned.replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think>/gi, '').trim()
  cleaned = cleaned.replace(/<thought(?:\s[^>]*)?>[\s\S]*?<\/thought>/gi, '').trim()
  cleaned = cleaned.replace(/^<(?:think|thought)(?:\s[^>]*)?>[\s\S]*/gi, '').trim()

  // Strip wrapping markdown code blocks if the LLM outputted them anyway
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\r?\n/, '')
    cleaned = cleaned.replace(/\r?\n```$/, '')
    cleaned = cleaned.trim()
  }

  // Helper to strip surrounding quotes if wrapped in single or double quotes
  const stripQuotes = (str: string): string => {
    let s = str.trim()
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith('`') && s.endsWith('`'))
    ) {
      s = s.slice(1, -1).trim()
    }
    return s
  }

  cleaned = stripQuotes(cleaned)

  // 1. If entire message is an exact or whitespace-separated repetition (e.g. "feat: foo...feat: foo..." or "feat: foo\n\nfeat: foo")
  const wholeMatch = /^(.{8,}?)(\s*\1)+$/s.exec(cleaned)
  if (wholeMatch) {
    cleaned = wholeMatch[1].trim()
  }

  // 2. Line by line deduplication:
  // - clean within each line if a single line repeats itself (e.g. "feat: foo feat: foo" or "feat: foofeat: foo")
  const rawLines = cleaned.split(/\r?\n/)
  const processedLines = rawLines.map((line) => {
    let trimmed = line.trim()
    trimmed = stripQuotes(trimmed)
    const lineMatch = /^(.{8,}?)(\s*\1)+$/.exec(trimmed)
    return lineMatch ? lineMatch[1].trim() : line
  })

  // - remove duplicate topics globally (even if non-adjacent or with different prefixes)
  // - limit total non-empty lines to prevent verbose multi-topic walls
  const deduplicatedLines: string[] = []
  const seenTopics = new Set<string>()
  let nonEmptyCount = 0

  for (let i = 0; i < processedLines.length; i++) {
    const current = processedLines[i]
    const trimmed = current.trim()
    if (trimmed !== '') {
      const topic = normalizeTopicForDedup(trimmed)
      if (!topic || seenTopics.has(topic)) {
        continue
      }

      if (nonEmptyCount >= MAX_COMMIT_LINES) {
        break
      }

      seenTopics.add(topic)
      nonEmptyCount++
      deduplicatedLines.push(current)
    } else {
      if (
        deduplicatedLines.length > 0 &&
        deduplicatedLines[deduplicatedLines.length - 1].trim() !== ''
      ) {
        deduplicatedLines.push(current)
      }
    }
  }

  cleaned = stripQuotes(deduplicatedLines.join('\n').trim())

  return cleaned
}
