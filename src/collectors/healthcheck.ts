export interface IHealthcheckNotifier {
  ping(checkUuid: string): Promise<void>;
  fail(checkUuid: string, message: string): Promise<void>;
}

export class HealthcheckNotifier implements IHealthcheckNotifier {
  constructor(private readonly baseUrl: string = 'https://hc-ping.com') {}

  async ping(checkUuid: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/${checkUuid}`);
    } catch {
      // silently ignore — notification failure must not stop collection
    }
  }

  async fail(checkUuid: string, message: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/${checkUuid}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: message,
      });
    } catch {
      // silently ignore — notification failure must not stop collection
    }
  }
}

export class NoopHealthcheckNotifier implements IHealthcheckNotifier {
  async ping(_checkUuid: string): Promise<void> {}
  async fail(_checkUuid: string, _message: string): Promise<void> {}
}
