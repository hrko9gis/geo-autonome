export class TailscaleGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TailscaleGuardError';
  }
}

export function isTailscaleAddress(ip: string): boolean {
  return ip.startsWith('100.');
}

export function assertTailscaleOnly(ip: string | undefined): void {
  if (!ip || !isTailscaleAddress(ip)) {
    throw new TailscaleGuardError(
      `Access denied: "${ip ?? 'unknown'}" is not a Tailscale address (expected 100.x.x.x). ` +
        'The approval server is only accessible via Tailscale VPN.',
    );
  }
}
