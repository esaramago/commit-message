import * as vscode from 'vscode';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}

export interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

export interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export interface GitExtension {
  getAPI(version: number): GitAPI;
}

export interface GitAPI {
  repositories: GitRepository[];
}

export interface GitRepository {
  rootUri: vscode.Uri;
  inputBox: {
    value: string;
  };
  state: {
    HEAD?: {
      name?: string;
    };
    indexChanges: GitChange[];
    workingTreeChanges: GitChange[];
  };
  ui: {
    selected: boolean;
  };
  diff(cached?: boolean): Promise<string>;
}

export interface GitChange {
  uri: vscode.Uri;
  status: number;
}

