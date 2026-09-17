import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  OpenRouterModel,
  OpenRouterModelsResponse
} from './types';
import { cleanCommitMessage } from './prompt';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

export const POPULAR_FREE_MODELS = [
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Meta: Llama 3.3 70B Instruct',
    description: 'High quality and fast general model'
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Google: Gemini 2.0 Flash Experimental',
    description: 'Very fast with great reasoning'
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'Qwen: Qwen 2.5 Coder 32B Instruct',
    description: 'Specialized for programming and code understanding'
  },
  {
    id: 'deepseek/deepseek-chat:free',
    name: 'DeepSeek: DeepSeek V3',
    description: 'Powerful coding and reasoning model'
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral: Mistral 7B Instruct',
    description: 'Lightweight and quick'
  }
];

export async function generateCommitMessageWithOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  cancellationToken?: { isCancellationRequested: boolean }
): Promise<string> {
  const payload: ChatCompletionRequest = {
    model: model || 'meta-llama/llama-3.3-70b-instruct:free',
    messages,
    temperature: 0.2
  };

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/emanuelsaramago/generate-commit-message',
      'X-Title': 'Generate Commit Message VSCode Extension'
    },
    body: JSON.stringify(payload)
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
      throw new Error(`Invalid OpenRouter API Key. Please verify your key with the 'Set OpenRouter API Key' command.`);
    }

    if (response.status === 429) {
      throw new Error(`OpenRouter rate limit reached. Free models may have hourly limits or queues: ${errorMessage}`);
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

export function isModelFree(model: OpenRouterModel): boolean {
  if (model.id.endsWith(':free')) {
    return true;
  }
  const promptPrice = model.pricing?.prompt;
  const completionPrice = model.pricing?.completion;
  return promptPrice === '0' && completionPrice === '0';
}

export async function fetchAvailableModels(apiKey?: string): Promise<OpenRouterModel[]> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
      method: 'GET',
      headers
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

