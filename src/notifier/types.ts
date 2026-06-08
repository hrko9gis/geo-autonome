import type { Draft } from '../generators/types.js';

export type { Draft };

export interface INotifier {
  notifyDraftReady(draft: Draft, approvalUrl: string): Promise<void>;
  notifyPublishError(draftId: string, error: string): Promise<void>;
}
