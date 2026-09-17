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
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'NVIDIA: Nemotron 3.5 Lightning',
    description: 'Fast and reliable free model from NVIDIA',
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'Cohere: North Mini Code',
    description: 'Specialized for code and developer tasks',
  },
  {
    id: 'nex-agi/nex-n2.5-mini:free',
    name: 'Nex AGI: Nex-N2.5-Mini',
    description: 'Fast instruction model',
  },
  {
    id: 'inclusionai/ling-3.0-flash-vl:free',
    name: 'inclusionAI: Ling 3.0 Flash VL',
    description: 'Fast general-purpose flash model',
  },
  {
    id: 'z-ai/glm-5.2:free',
    name: 'Z.ai: GLM 5.2',
    description: 'Conversational and code reasoning model',
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
    lower.includes('decommissioned')
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

export async function getLiveFreeModelIds(apiKey?: string): Promise<string[]> {
  const now = Date.now();
  if (cachedFreeModels && now - cachedFreeModels.timestamp < CACHE_TTL_MS) {
    return cachedFreeModels.models;
  }

  const models = await fetchAvailableModels(apiKey);
  const freeIds = models.filter((m) => isModelFree(m)).map((m) => m.id);

  if (freeIds.length > 0) {
    cachedFreeModels = { models: freeIds, timestamp: now };
    return freeIds;
  }

  // Fallback if network failed or empty list returned
  return POPULAR_FREE_MODELS.map((m) => m.id);
}

export async function generateCommitMessageWithOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  cancellationToken?: { isCancellationRequested: boolean }
): Promise<string> {
  const payload: ChatCompletionRequest = {
    model,
    messages,
    temperature: 0.2,
  };

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/emanuelsaramago/generate-commit-message',
      'X-Title': 'Generate Commit Message VSCode Extension',
    },
    body: JSON.stringify(payload),
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
}

export interface GenerationResult {
  commitMessage: string;
  usedModel: string;
  fallbackUsed: boolean;
  originalModel: string;
}

export async function generateCommitMessageWithAutoFallback(
  apiKey: string,
  requestedModel: string,
  messages: ChatMessage[],
  onStatusUpdate?: (status: string) => void,
  cancellationToken?: { isCancellationRequested: boolean }
): Promise<GenerationResult> {
  let targetModel = requestedModel?.trim();

  // If user selected "auto" or "auto:free", get the first active free model
  if (!targetModel || targetModel === 'auto' || targetModel === 'auto:free') {
    const liveFree = await getLiveFreeModelIds(apiKey);
    targetModel = liveFree[0] || POPULAR_FREE_MODELS[0].id;
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
      fallbackUsed: targetModel !== requestedModel && requestedModel !== 'auto' && requestedModel !== 'auto:free',
      originalModel: requestedModel,
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

    // Model is unavailable for free or offline. Initiate automatic fallback.
    onStatusUpdate?.(`Model "${targetModel}" is unavailable for free. Finding active free model...`);

    const liveFreeModels = await getLiveFreeModelIds(apiKey);
    const candidates = liveFreeModels.filter((m) => m !== targetModel);

    let lastError: any = err;
    for (const candidate of candidates.slice(0, 3)) {
      if (cancellationToken?.isCancellationRequested) {
        throw new Error('Operation was cancelled.');
      }

      try {
        onStatusUpdate?.(`Retrying with free model: ${candidate}...`);
        const fallbackMessage = await generateCommitMessageWithOpenRouter(
          apiKey,
          candidate,
          messages,
          cancellationToken
        );
        return {
          commitMessage: fallbackMessage,
          usedModel: candidate,
          fallbackUsed: true,
          originalModel: targetModel,
        };
      } catch (retryErr: any) {
        lastError = retryErr;
        if (!isModelUnavailableError(retryErr?.message || '')) {
          throw retryErr;
        }
      }
    }

    throw new Error(
      `Model "${targetModel}" is unavailable for free, and automatic fallbacks failed: ${lastError?.message || errorMsg}`
    );
  }
}
