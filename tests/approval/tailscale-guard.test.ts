import { describe, expect, it } from 'vitest';
import {
  TailscaleGuardError,
  assertTailscaleOnly,
  isTailscaleAddress,
} from '../../src/approval/tailscale-guard.js';

describe('isTailscaleAddress()', () => {
  it('returns true for 100.x.x.x addresses', () => {
    expect(isTailscaleAddress('100.64.0.1')).toBe(true);
    expect(isTailscaleAddress('100.100.200.50')).toBe(true);
    expect(isTailscaleAddress('100.0.0.0')).toBe(true);
  });

  it('returns false for non-Tailscale addresses', () => {
    expect(isTailscaleAddress('192.168.1.1')).toBe(false);
    expect(isTailscaleAddress('127.0.0.1')).toBe(false);
    expect(isTailscaleAddress('10.0.0.1')).toBe(false);
    expect(isTailscaleAddress('172.16.0.1')).toBe(false);
    expect(isTailscaleAddress('8.8.8.8')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isTailscaleAddress('')).toBe(false);
  });
});

describe('assertTailscaleOnly()', () => {
  it('does not throw for valid Tailscale address', () => {
    expect(() => assertTailscaleOnly('100.64.0.1')).not.toThrow();
  });

  it('throws TailscaleGuardError for non-Tailscale IP', () => {
    expect(() => assertTailscaleOnly('192.168.1.1')).toThrow(TailscaleGuardError);
    expect(() => assertTailscaleOnly('127.0.0.1')).toThrow(TailscaleGuardError);
  });

  it('throws TailscaleGuardError when ip is undefined', () => {
    expect(() => assertTailscaleOnly(undefined)).toThrow(TailscaleGuardError);
  });

  it('error message mentions Tailscale VPN', () => {
    try {
      assertTailscaleOnly('1.2.3.4');
    } catch (err) {
      expect(String(err)).toContain('Tailscale');
    }
  });
});
