import http from 'node:http';
import type { IDraftRepository } from '../generators/repository.js';
import type { INotifier } from '../notifier/types.js';
import type { IApprovalRepository } from './repository.js';
import { assertTailscaleOnly, TailscaleGuardError } from './tailscale-guard.js';
import type { ApprovalRequest, ApprovalResponse } from './types.js';

const HTML_HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GeoAutonome Approval</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 1rem; }
  h1 { font-size: 1.25rem; }
  a { color: #0070f3; }
  button { padding: 0.75rem 1.5rem; font-size: 1rem; border: none; border-radius: 6px; cursor: pointer; margin: 0.25rem; }
  .approve { background: #0070f3; color: white; }
  .reject { background: #e53e3e; color: white; }
  .revise { background: #dd6b20; color: white; }
  textarea { width: 100%; min-height: 80px; margin-top: 0.5rem; padding: 0.5rem; font-size: 1rem; }
  details summary { cursor: pointer; color: #555; }
  pre { background: #f4f4f4; padding: 0.75rem; overflow-x: auto; white-space: pre-wrap; font-size: 0.85rem; }
  .draft-item { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
</style>
</head>
<body>`;

const HTML_FOOT = `</body></html>`;

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function htmlResponse(res: http.ServerResponse, html: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function isValidApprovalRequest(body: unknown): body is ApprovalRequest {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b['draftId'] !== 'string') return false;
  const validActions = ['approved', 'rejected', 'revision_requested'];
  if (typeof b['action'] !== 'string' || !validActions.includes(b['action'])) return false;
  return true;
}

export interface ApprovalServerOptions {
  ipGuard?: (ip: string | undefined) => void;
}

export function createApprovalServer(
  draftRepo: IDraftRepository,
  approvalRepo: IApprovalRepository,
  _notifier: INotifier,
  options: ApprovalServerOptions = {},
): http.Server {
  const ipGuard = options.ipGuard ?? assertTailscaleOnly;

  return http.createServer(async (req, res) => {
    const remoteIp = req.socket.remoteAddress ?? '';

    try {
      ipGuard(remoteIp);
    } catch (err) {
      if (err instanceof TailscaleGuardError) {
        return jsonResponse(res, 403, { error: 'Forbidden: Tailscale access required' });
      }
      throw err;
    }

    const method = req.method ?? 'GET';
    const url = req.url ?? '/';
    const urlParts = url.split('?')[0].split('/').filter(Boolean);

    if (method === 'GET' && url === '/health') {
      return jsonResponse(res, 200, { status: 'ok' });
    }

    if (method === 'GET' && url.startsWith('/drafts') && urlParts.length === 1) {
      const pending = await draftRepo.findByStatus('pending');
      const items = pending
        .map(
          (d) =>
            `<div class="draft-item">
              <strong>${escapeHtml(d.frontmatter.title)}</strong>
              <p>${escapeHtml(d.frontmatter.description)}</p>
              <a href="/drafts/${d.id}">Review →</a>
            </div>`,
        )
        .join('\n');
      const html =
        `${HTML_HEAD}<h1>Pending Drafts (${pending.length})</h1>` +
        (pending.length === 0 ? '<p>No pending drafts.</p>' : items) +
        HTML_FOOT;
      return htmlResponse(res, html);
    }

    if (method === 'GET' && urlParts.length === 2 && urlParts[0] === 'drafts') {
      const draftId = urlParts[1];
      const allDrafts = await draftRepo.findAll();
      const draft = allDrafts.find((d) => d.id === draftId);
      if (!draft) {
        return jsonResponse(res, 404, { error: 'Draft not found' });
      }
      const html =
        `${HTML_HEAD}
        <h1>${escapeHtml(draft.frontmatter.title)}</h1>
        <p>${escapeHtml(draft.frontmatter.description)}</p>
        <details><summary>Preview</summary><pre>${escapeHtml(draft.contentMd.slice(0, 2000))}</pre></details>
        <form method="POST" action="/approvals" onsubmit="return submitApproval(event, this)">
          <input type="hidden" name="draftId" value="${escapeHtml(draft.id)}">
          <div>
            <button type="button" class="approve" onclick="setAction(this.form,'approved')">✅ Approve</button>
            <button type="button" class="reject" onclick="setAction(this.form,'rejected')">❌ Reject</button>
            <button type="button" class="revise" onclick="setAction(this.form,'revision_requested')">✏️ Revise</button>
          </div>
          <div id="targets" style="display:none;margin-top:0.5rem">
            <label><input type="checkbox" name="targets" value="devto" checked> dev.to</label>
            <label><input type="checkbox" name="targets" value="blog" checked> Blog</label>
          </div>
          <div id="revisionDiv" style="display:none">
            <textarea name="revisionNote" placeholder="Revision instructions..."></textarea>
          </div>
          <input type="hidden" name="action" id="actionField" value="">
          <button type="submit" id="submitBtn" style="margin-top:0.5rem;display:none" class="approve">Submit</button>
        </form>
        <script>
        function setAction(form, action) {
          form.querySelector('#actionField').value = action;
          form.querySelector('#targets').style.display = action === 'approved' ? 'block' : 'none';
          form.querySelector('#revisionDiv').style.display = action === 'revision_requested' ? 'block' : 'none';
          form.querySelector('#submitBtn').style.display = 'block';
        }
        async function submitApproval(e, form) {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(form));
          const targets = form.querySelectorAll('[name=targets]:checked');
          const body = { draftId: data.draftId, action: data.action };
          if (targets.length) body.targets = [...targets].map(t => t.value);
          if (data.revisionNote) body.revisionNote = data.revisionNote;
          const r = await fetch('/approvals', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
          const j = await r.json();
          alert('Saved: ' + j.status);
          location.href = '/drafts';
        }
        </script>
        ${HTML_FOOT}`;
      return htmlResponse(res, html);
    }

    if (method === 'POST' && url === '/approvals') {
      let rawBody: string;
      try {
        rawBody = await readBody(req);
      } catch {
        return jsonResponse(res, 400, { error: 'Failed to read request body' });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return jsonResponse(res, 400, { error: 'Invalid JSON body' });
      }

      if (!isValidApprovalRequest(parsed)) {
        return jsonResponse(res, 400, { error: 'Missing or invalid draftId/action' });
      }

      const approval = {
        id: crypto.randomUUID(),
        draftId: parsed.draftId,
        action: parsed.action,
        targets: parsed.targets,
        revisionNote: parsed.revisionNote,
        approvedAt: new Date(),
      };
      await approvalRepo.save(approval);

      const response: ApprovalResponse = { approvalId: approval.id, status: 'saved' };
      return jsonResponse(res, 200, response);
    }

    return jsonResponse(res, 404, { error: 'Not found' });
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
