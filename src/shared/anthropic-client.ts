import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages.js';

export interface IAnthropicClient {
  messages: {
    create(params: MessageCreateParamsNonStreaming): Promise<{
      content: Array<{ type: string; text?: string }>;
    }>;
  };
}
