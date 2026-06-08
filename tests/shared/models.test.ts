import { describe, expect, it } from 'vitest';
import {
  HAIKU_MODEL,
  SONNET_MODEL,
  assertAutonomousAgentModel,
} from '../../src/shared/models.js';

describe('Model constants', () => {
  it('HAIKU_MODEL is claude-haiku-4-5', () => {
    expect(HAIKU_MODEL).toBe('claude-haiku-4-5');
  });

  it('SONNET_MODEL is claude-sonnet-4-6', () => {
    expect(SONNET_MODEL).toBe('claude-sonnet-4-6');
  });
});

describe('assertAutonomousAgentModel()', () => {
  it('allows HAIKU_MODEL without throwing', () => {
    expect(() => assertAutonomousAgentModel(HAIKU_MODEL)).not.toThrow();
  });

  it('allows SONNET_MODEL without throwing', () => {
    expect(() => assertAutonomousAgentModel(SONNET_MODEL)).not.toThrow();
  });

  it('throws for opus-4-7', () => {
    expect(() => assertAutonomousAgentModel('claude-opus-4-7')).toThrow(
      /not allowed for autonomous agents/,
    );
  });

  it('throws for any opus variant', () => {
    const opusModels = ['claude-opus-4-7', 'claude-3-opus-20240229', 'claude-opus-4-5'];
    for (const model of opusModels) {
      expect(() => assertAutonomousAgentModel(model)).toThrow();
    }
  });

  it('throws for unknown model names', () => {
    expect(() => assertAutonomousAgentModel('gpt-4o')).toThrow(/not allowed/);
    expect(() => assertAutonomousAgentModel('gemini-pro')).toThrow(/not allowed/);
  });

  it('error message mentions allowed models', () => {
    try {
      assertAutonomousAgentModel('claude-opus-4-7');
    } catch (err) {
      expect(String(err)).toContain('claude-haiku-4-5');
      expect(String(err)).toContain('claude-sonnet-4-6');
    }
  });
});
