import Anthropic from '@anthropic-ai/sdk';
import type { IAnthropicClient } from './anthropic-client.js';

export class AgentClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentClientError';
  }
}

export function createAgentClient(): IAnthropicClient {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new AgentClientError(
      'ANTHROPIC_API_KEY is not set. ' +
        'Autonomous agents require the Claude API (pay-per-use), ' +
        'which is separate from Claude Code Pro credentials. ' +
        'Set ANTHROPIC_API_KEY in your environment to enable autonomous agent processing.',
    );
  }
  return new Anthropic({ apiKey });
}
