import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentClientError, createAgentClient } from '../../src/shared/client-factory.js';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

describe('createAgentClient()', () => {
  beforeEach(() => {
    delete process.env['ANTHROPIC_API_KEY'];
  });

  afterEach(() => {
    delete process.env['ANTHROPIC_API_KEY'];
    vi.clearAllMocks();
  });

  it('throws AgentClientError when ANTHROPIC_API_KEY is not set', () => {
    expect(() => createAgentClient()).toThrow(AgentClientError);
  });

  it('error message explains two-system separation', () => {
    try {
      createAgentClient();
    } catch (err) {
      expect(String(err)).toContain('ANTHROPIC_API_KEY');
      expect(String(err)).toContain('Claude Code Pro');
    }
  });

  it('returns an IAnthropicClient when ANTHROPIC_API_KEY is set', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-key';
    const client = createAgentClient();
    expect(client).toBeDefined();
    expect(client.messages).toBeDefined();
    expect(typeof client.messages.create).toBe('function');
  });

  it('passes the api key to the Anthropic SDK constructor', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-key-123';
    const { default: AnthropicMock } = await import('@anthropic-ai/sdk');

    createAgentClient();

    expect(AnthropicMock).toHaveBeenCalledWith({ apiKey: 'sk-test-key-123' });
  });
});
