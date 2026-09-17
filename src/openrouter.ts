import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  OpenRouterModel,
  OpenRouterModelsResponse,
} from './types';
import { cleanCommitMessage } from './prompt';
import settings from './settings.json';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

export const POPULAR_FREE_MODELS = [
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google: Gemma 4 26B A4B',
    description: 'Fast, high-quality instruction model hosted on Google infrastructure',
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'Cohere: North Mini Code',
    description: 'Fast specialized model for code and developer tasks',
  },
  {
    id: 'liquid/lfm-2.5-2.6b:free',
    name: 'LiquidAI: LFM 2.5 2.6B',
    description: 'Ultra-lightweight 2.6B model with instant response time',
  },
  {
    id: 'nex-agi/nex-n2.5-mini:free',
    name: 'Nex AGI: Nex-N2.5-Mini',
    description: 'Fast instruction model',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google: Gemma 4 31B',
    description: 'Larger Google instruction model with strong code reasoning',
  },
  {
    id: 'z-ai/glm-5.2:free',
    name: 'Z.ai: GLM 5.2',
    description: 'Conversational and code reasoning model',
  },
  {
    id: 'inclusionai/ling-3.0-flash-vl:free',
    name: 'inclusionAI: Ling 3.0 Flash VL',
    description: 'Fast general-purpose flash model',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'NVIDIA: Nemotron 3.5 Lightning',
    description: 'MoE model from NVIDIA',
  },
];

export const POPULAR_PAID_MODELS = [
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Anthropic: Claude 3.5 Haiku',
    description: 'Fast, high-quality coding model with low cost',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Anthropic: Claude 3.5 Sonnet',
    description: 'Industry-leading intelligence and coding performance',
  },
  {
    id: 'mistralai/codestral-2501',
    name: 'Mistral: Codestral 2501',
    description: 'State-of-the-art model specialized in code generation',
  },
];

export function isProviderNotFeatured(
  modelId: string,
  notFeaturedList: string[] = settings.providersNotFeatured || []
): boolean {
  if (!modelId || !notFeaturedList || notFeaturedList.length === 0) {
    return false;
  }
  const normalizedId = modelId.toLowerCase().trim();
  const provider = normalizedId.split('/')[0];

  return notFeaturedList.some((excluded) => {
    const normExcluded = excluded.toLowerCase().trim();
    return (
      provider === normExcluded ||
      normalizedId.startsWith(`${normExcluded}/`) ||
      normalizedId === normExcluded
    );
  });
}

let cachedFreeModels: { models: string[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function isModelFree(model: OpenRouterModel): boolean {
  if (model.id.endsWith(':free')) {
    return true;
  }
  const promptPrice = model.pricing?.prompt;
  const completionPrice = model.pricing?.completion;
  return promptPrice === '0' && completionPrice === '0';
}

export function isModelUnavailableError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes('unavailable for free') ||
    lower.includes('no endpoints found') ||
    lower.includes('not found') ||
    lower.includes('does not exist') ||
    lower.includes('is not available') ||
    lower.includes('is disabled') ||
    lower.includes('decommissioned') ||
    lower.includes('provider is unavailable') ||
    lower.includes('provider returned error') ||
    lower.includes('provider error') ||
    lower.includes('free models may have hourly limits or queues') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('overloaded') ||
    lower.includes('capacity')
  );
}

export async function fetchAvailableModels(apiKey?: string): Promise<OpenRouterModel[]> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as OpenRouterModelsResponse;
    return json.data || [];
  } catch {
    return [];
  }
}

export function prioritizeFreeModels(
  liveModelIds: string[],
  excludedModelId?: string,
): string[] {
  const excludedSet = new Set(excludedModelId ? [excludedModelId] : []);
  const liveSet = new Set(liveModelIds);

  // 1. First prioritize known fast and reliable free models in defined order
  const popularIds = POPULAR_FREE_MODELS.map((m) => m.id).filter(
    (id) => !excludedSet.has(id) && !isProviderNotFeatured(id) && liveSet.has(id),
  );

  const chosenSet = new Set(popularIds);

  // 2. Then add other live models that explicitly have :free in their slug
  const otherWithFreeSuffix = liveModelIds.filter(
    (id) =>
      !excludedSet.has(id) &&
      !chosenSet.has(id) &&
      !isProviderNotFeatured(id) &&
      id.endsWith(':free'),
  );

  for (const id of otherWithFreeSuffix) {
    chosenSet.add(id);
  }

  // 3. Finally any other remaining free models (e.g. pricing 0 without :free suffix)
  const remaining = liveModelIds.filter(
    (id) =>
      !excludedSet.has(id) &&
      !chosenSet.has(id) &&
      !isProviderNotFeatured(id),
  );

  return [...popularIds, ...otherWithFreeSuffix, ...remaining];
}

export async function getLiveFreeModelIds(apiKey?: string): Promise<string[]> {
  const now = Date.now();
  if (cachedFreeModels && now - cachedFreeModels.timestamp < CACHE_TTL_MS) {
    return cachedFreeModels.models;
  }

  const models = await fetchAvailableModels(apiKey);
  const freeIds = models
    .filter((m) => isModelFree(m) && !isProviderNotFeatured(m.id))
    .map((m) => m.id);

  if (freeIds.length > 0) {
    cachedFreeModels = { models: freeIds, timestamp: now };
    return freeIds;
  }

  // Fallback if network failed or empty list returned
  return POPULAR_FREE_MODELS.map((m) => m.id).filter((id) => !isProviderNotFeatured(id));
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 12000; // 12 seconds

export async function generateCommitMessageWithOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  cancellationToken?: { isCancellationRequested: boolean },
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<string> {
  const payload: ChatCompletionRequest = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: 300,
    reasoning: { effort: 'none' },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs / 1000}s`));
  }, timeoutMs);

  let checkCancellationInterval: NodeJS.Timeout | undefined;
  if (cancellationToken) {
    checkCancellationInterval = setInterval(() => {
      if (cancellationToken.isCancellationRequested) {
        controller.abort(new Error('Operation was cancelled.'));
      }
    }, 150);
  }

  try {
    const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/emanuelsaramago/generate-commit-message',
        'X-Title': 'Generate Commit Message VSCode Extension',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (cancellationToken?.isCancellationRequested) {
      throw new Error('Operation was cancelled.');
    }

    if (!response.ok) {
      let errorMessage = `OpenRouter API error (status ${response.status})`;
      try {
        const errorJson = (await response.json()) as ChatCompletionResponse;
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        const text = await response.text();
        if (text) {
          errorMessage = `${errorMessage}: ${text}`;
        }
      }

      if (response.status === 401) {
        throw new Error(
          `Invalid OpenRouter API Key. Please verify your key with the 'Set OpenRouter API Key' command.`
        );
      }

      if (response.status === 429) {
        throw new Error(
          `OpenRouter rate limit reached. Free models may have hourly limits or queues: ${errorMessage}`
        );
      }

      throw new Error(errorMessage);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Received an empty response from OpenRouter.');
    }

    return cleanCommitMessage(content);
  } catch (err: any) {
    if (cancellationToken?.isCancellationRequested || err?.message === 'Operation was cancelled.') {
      throw new Error('Operation was cancelled.');
    }
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s. The model took too long to respond.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (checkCancellationInterval) {
      clearInterval(checkCancellationInterval);
    }
  }
}

export interface GenerationResult {
  commitMessage: string;
  usedModel: string;
  fallbackUsed: boolean;
  originalModel: string;
  isAutoMode: boolean;
}

export async function generateCommitMessageWithAutoFallback(
  apiKey: string,
  requestedModel: string,
  messages: ChatMessage[],
  onStatusUpdate?: (status: string) => void,
  cancellationToken?: { isCancellationRequested: boolean },
  savedAutoModel?: string,
): Promise<GenerationResult> {
  const isAuto =
    !requestedModel ||
    requestedModel.trim() === '' ||
    requestedModel.trim() === 'auto' ||
    requestedModel.trim() === 'auto:free';

  let targetModel: string;

  if (isAuto) {
    if (savedAutoModel && savedAutoModel.trim().length > 0) {
      // Fast path: use previously verified working auto model directly without querying /models
      targetModel = savedAutoModel.trim();
    } else {
      // First run in auto mode: query and pick top prioritized free model
      onStatusUpdate?.('Finding active free model on OpenRouter...');
      const liveFree = await getLiveFreeModelIds(apiKey);
      const prioritized = prioritizeFreeModels(liveFree);
      targetModel = prioritized[0] || POPULAR_FREE_MODELS[0].id;
    }
  } else {
    targetModel = requestedModel.trim();
  }

  try {
    const message = await generateCommitMessageWithOpenRouter(
      apiKey,
      targetModel,
      messages,
      cancellationToken
    );
    return {
      commitMessage: message,
      usedModel: targetModel,
      fallbackUsed: false,
      originalModel: isAuto ? (savedAutoModel || requestedModel) : requestedModel,
      isAutoMode: isAuto,
    };
  } catch (err: any) {
    if (cancellationToken?.isCancellationRequested) {
      throw err;
    }

    const errorMsg = err?.message || String(err);
    if (!isModelUnavailableError(errorMsg)) {
      // Don't fallback on auth errors or user cancellation
      throw err;
    }

    // Target model failed. Initiate automatic fallback.
    onStatusUpdate?.(`Model "${targetModel}" is unavailable. Finding active free model...`);

    const liveFreeModels = await getLiveFreeModelIds(apiKey);
    const candidates = prioritizeFreeModels(liveFreeModels, targetModel);

    let lastError: any = err;
    for (const candidate of candidates.slice(0, 5)) {
      if (cancellationToken?.isCancellationRequested) {
        throw new Error('Operation was cancelled.');
      }

      try {
        onStatusUpdate?.(`Retrying with free model: ${candidate}...`);
        const fallbackMessage = await generateCommitMessageWithOpenRouter(
          apiKey,
          candidate,
          messages,
          cancellationToken,
          10000,
        );
        return {
          commitMessage: fallbackMessage,
          usedModel: candidate,
          fallbackUsed: true,
          originalModel: targetModel,
          isAutoMode: isAuto,
        };
      } catch (retryErr: any) {
        lastError = retryErr;
        if (!isModelUnavailableError(retryErr?.message || '')) {
          throw retryErr;
        }
      }
    }

    throw new Error(
      `Model "${targetModel}" is unavailable, and automatic fallbacks failed: ${lastError?.message || errorMsg}`
    );
  }
}
