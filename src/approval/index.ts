export type { ApprovalAction, Approval, ApprovalRequest, ApprovalResponse } from './types.js';
export type { IApprovalRepository } from './repository.js';
export { InMemoryApprovalRepository, JsonlApprovalRepository } from './repository.js';
export { TailscaleGuardError, isTailscaleAddress, assertTailscaleOnly } from './tailscale-guard.js';
export { createApprovalServer } from './server.js';
