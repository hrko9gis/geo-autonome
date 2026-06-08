import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApprovalServer } from '../../src/approval/server.js';
import { InMemoryApprovalRepository } from '../../src/approval/repository.js';
import { InMemoryDraftRepository } from '../../src/generators/repository.js';
import { TailscaleGuardError } from '../../src/approval/tailscale-guard.js';
import type { INotifier } from '../../src/notifier/types.js';
import type { Draft } from '../../src/generators/types.js';

function makeNoop(): INotifier {
  return {
    notifyDraftReady: vi.fn().mockResolvedValue(undefined),
    notifyPublishError: vi.fn().mockResolvedValue(undefined),
  };
}

function makeDraft(id: string, status: Draft['status'] = 'pending'): Draft {
  return {
    id,
    scoredItemId: 'scored-1',
    frontmatter: {
      title: 'Test Article',
      description: 'A test article',
      tags: ['geospatial'],
      published: false,
    },
    contentMd: '---\ntitle: Test Article\n---\n\nContent here.',
    status,
    createdAt: new Date(),
  };
}

const noGuard = () => {};

function makeRequest(
  server: http.Server,
  opts: { method: string; path: string; body?: unknown },
): Promise<{ status: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const bodyStr = opts.body ? JSON.stringify(opts.body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: opts.path,
        method: opts.method,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: data,
            contentType: String(res.headers['content-type'] ?? ''),
          }),
        );
      },
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('createApprovalServer (Tailscale guard bypassed)', () => {
  let server: http.Server;
  let draftRepo: InMemoryDraftRepository;
  let approvalRepo: InMemoryApprovalRepository;

  beforeEach(async () => {
    draftRepo = new InMemoryDraftRepository();
    approvalRepo = new InMemoryApprovalRepository();
    server = createApprovalServer(draftRepo, approvalRepo, makeNoop(), { ipGuard: noGuard });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /health returns 200 JSON {"status":"ok"}', async () => {
    const res = await makeRequest(server, { method: 'GET', path: '/health' });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('GET /drafts returns 200 HTML', async () => {
    await draftRepo.save(makeDraft('d-1', 'pending'));
    const res = await makeRequest(server, { method: 'GET', path: '/drafts' });
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('text/html');
    expect(res.body).toContain('Test Article');
  });

  it('GET /drafts returns 200 HTML even with no pending drafts', async () => {
    const res = await makeRequest(server, { method: 'GET', path: '/drafts' });
    expect(res.status).toBe(200);
    expect(res.body).toContain('No pending drafts');
  });

  it('POST /approvals (approved) saves and returns 200', async () => {
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/approvals',
      body: { draftId: 'd-1', action: 'approved', targets: ['devto', 'blog'] },
    });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty('approvalId');
    expect(json.status).toBe('saved');

    const approvals = await approvalRepo.findAll();
    expect(approvals).toHaveLength(1);
    expect(approvals[0].action).toBe('approved');
    expect(approvals[0].targets).toContain('devto');
  });

  it('POST /approvals (rejected) returns 200', async () => {
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/approvals',
      body: { draftId: 'd-2', action: 'rejected' },
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).status).toBe('saved');
    const approvals = await approvalRepo.findAll();
    expect(approvals[0].action).toBe('rejected');
  });

  it('POST /approvals (revision_requested) saves revision note', async () => {
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/approvals',
      body: { draftId: 'd-3', action: 'revision_requested', revisionNote: 'Fix the intro' },
    });
    expect(res.status).toBe(200);
    const approvals = await approvalRepo.findAll();
    expect(approvals[0].revisionNote).toBe('Fix the intro');
  });

  it('POST /approvals with invalid JSON returns 400', async () => {
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const address = server.address() as { port: number };
      const req = http.request(
        { hostname: '127.0.0.1', port: address.port, path: '/approvals', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': 8 } },
        (r) => {
          let data = '';
          r.on('data', (c: Buffer) => { data += c.toString(); });
          r.on('end', () => resolve({ status: r.statusCode ?? 0, body: data }));
        },
      );
      req.on('error', reject);
      req.write('not-json');
      req.end();
    });
    expect(res.status).toBe(400);
  });

  it('POST /approvals with missing draftId returns 400', async () => {
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/approvals',
      body: { action: 'approved' },
    });
    expect(res.status).toBe(400);
  });

  it('GET /drafts/:id returns 200 HTML with draft detail', async () => {
    await draftRepo.save(makeDraft('d-detail', 'pending'));
    const res = await makeRequest(server, { method: 'GET', path: '/drafts/d-detail' });
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('text/html');
    expect(res.body).toContain('Test Article');
    expect(res.body).toContain('Approve');
    expect(res.body).toContain('Reject');
  });

  it('GET /drafts/:id returns 404 for unknown draft', async () => {
    const res = await makeRequest(server, { method: 'GET', path: '/drafts/nonexistent-id' });
    expect(res.status).toBe(404);
  });

  it('unknown route returns 404', async () => {
    const res = await makeRequest(server, { method: 'GET', path: '/unknown' });
    expect(res.status).toBe(404);
  });
});

describe('createApprovalServer (Tailscale guard active)', () => {
  it('returns 403 when ipGuard throws TailscaleGuardError', async () => {
    const draftRepo = new InMemoryDraftRepository();
    const approvalRepo = new InMemoryApprovalRepository();
    const server = createApprovalServer(
      draftRepo,
      approvalRepo,
      makeNoop(),
      { ipGuard: () => { throw new TailscaleGuardError('Not a Tailscale IP'); } },
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const res = await makeRequest(server, { method: 'GET', path: '/health' });
      expect(res.status).toBe(403);
      expect(JSON.parse(res.body)).toHaveProperty('error');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
