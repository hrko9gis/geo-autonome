import type { Draft } from '../generators/types.js';
import type { INotifier } from '../notifier/types.js';
import { DEFAULT_DELAYS_MS, withRetry } from '../shared/retry.js';
import type { BlogPublisher } from './blog-publisher.js';
import type { DevToPublisher } from './devto-publisher.js';
import type { IPostRepository } from './repository.js';
import type { Post, PublishTarget } from './types.js';
import type { URLShortenerClient } from './url-shortener.js';

export class Publisher {
  constructor(
    private readonly devto: DevToPublisher | null,
    private readonly blog: BlogPublisher | null,
    private readonly shortener: URLShortenerClient,
    private readonly notifier: INotifier,
    private readonly retryDelays: number[] = DEFAULT_DELAYS_MS,
  ) {}

  async publish(
    draft: Draft,
    targets: PublishTarget[],
    postRepo: IPostRepository,
  ): Promise<Post[]> {
    const tempId = crypto.randomUUID();
    const content = await this.shortener.replaceLinks(draft.contentMd, tempId);

    const posts: Post[] = [];

    if (targets.includes('devto') && this.devto) {
      try {
        const url = await withRetry(
          () => this.devto!.publish(draft, content),
          3,
          this.retryDelays,
        );
        const post: Post = {
          id: crypto.randomUUID(),
          draftId: draft.id,
          platform: 'devto',
          externalUrl: url,
          publishedAt: new Date(),
        };
        await postRepo.save(post);
        posts.push(post);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.notifier.notifyPublishError(draft.id, `dev.to: ${message}`);
      }
    }

    if (targets.includes('blog') && this.blog) {
      try {
        const filePath = await withRetry(
          () => this.blog!.publish(draft, content),
          3,
          this.retryDelays,
        );
        const post: Post = {
          id: crypto.randomUUID(),
          draftId: draft.id,
          platform: 'blog',
          externalUrl: filePath,
          publishedAt: new Date(),
        };
        await postRepo.save(post);
        posts.push(post);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.notifier.notifyPublishError(draft.id, `blog: ${message}`);
      }
    }

    return posts;
  }
}
