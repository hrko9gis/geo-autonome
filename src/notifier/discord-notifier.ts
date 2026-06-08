import type { Draft } from '../generators/types.js';
import type { INotifier } from './types.js';

function buildContent(title: string, summary: string, approvalUrl: string): string {
  return `📝 **${title}**\n───────────────\n${summary}\n───────────────\n🔗 承認URL: ${approvalUrl}`;
}

export class DiscordNotifier implements INotifier {
  constructor(private readonly webhookUrl: string) {}

  async notifyDraftReady(draft: Draft, approvalUrl: string): Promise<void> {
    const content = buildContent(
      draft.frontmatter.title,
      draft.frontmatter.description || '(no summary)',
      approvalUrl,
    );
    await this.post({ content });
  }

  async notifyPublishError(draftId: string, error: string): Promise<void> {
    const content = `⚠️ **投稿エラー**\nDraft ID: ${draftId}\nエラー: ${error}`;
    await this.post({ content });
  }

  private async post(payload: { content: string }): Promise<void> {
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // silently ignore — notification failure must not stop the main pipeline
    }
  }
}
