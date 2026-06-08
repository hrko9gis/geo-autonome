import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Draft } from '../generators/types.js';
import { PublisherError } from './devto-publisher.js';

export interface IGitExecutor {
  exec(args: string[], cwd?: string): Promise<string>;
}

export class NodeGitExecutor implements IGitExecutor {
  exec(args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '');
}

function datePrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

export class BlogPublisher {
  constructor(
    private readonly blogDir: string = 'blog',
    private readonly git: IGitExecutor = new NodeGitExecutor(),
  ) {}

  async publish(draft: Draft, content: string): Promise<string> {
    const slug = slugify(draft.frontmatter.title);
    const fileName = `${datePrefix()}-${slug}.md`;
    const postsDir = path.join(this.blogDir, 'src', 'content', 'posts');
    const filePath = path.join(postsDir, fileName);

    try {
      await mkdir(postsDir, { recursive: true });
      await writeFile(filePath, content, 'utf8');
    } catch (cause) {
      throw new PublisherError(`Failed to write blog file: ${String(cause)}`, cause);
    }

    try {
      await this.git.exec(['add', filePath], this.blogDir);
      await this.git.exec(
        ['commit', '-m', `feat: add ${draft.frontmatter.title}`],
        this.blogDir,
      );
      await this.git.exec(['push'], this.blogDir);
    } catch (cause) {
      throw new PublisherError(`Failed to git push blog: ${String(cause)}`, cause);
    }

    return filePath;
  }
}
