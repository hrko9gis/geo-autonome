import type { Draft } from '../generators/types.js';
import type { INotifier } from './types.js';

function buildDraftReadyPayload(draft: Draft, approvalUrl: string): unknown {
  const title = draft.frontmatter.title;
  const summary = draft.frontmatter.description || '(no summary)';
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📝 ${title}*\n───────────────\n${summary}\n───────────────\n🔗 <${approvalUrl}|承認画面を開く>`,
        },
      },
    ],
  };
}

function buildPublishErrorPayload(draftId: string, error: string): unknown {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *投稿エラー*\nDraft ID: ${draftId}\nエラー: ${error}`,
        },
      },
    ],
  };
}

export class SlackNotifier implements INotifier {
  constructor(private readonly webhookUrl: string) {}

  async notifyDraftReady(draft: Draft, approvalUrl: string): Promise<void> {
    await this.post(buildDraftReadyPayload(draft, approvalUrl));
  }

  async notifyPublishError(draftId: string, error: string): Promise<void> {
    await this.post(buildPublishErrorPayload(draftId, error));
  }

  private async post(payload: unknown): Promise<void> {
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
