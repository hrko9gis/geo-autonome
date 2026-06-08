export type ApprovalAction = 'approved' | 'rejected' | 'revision_requested';

export interface Approval {
  id: string;
  draftId: string;
  action: ApprovalAction;
  targets?: string[];
  revisionNote?: string;
  approvedAt: Date;
}

export interface ApprovalRequest {
  draftId: string;
  action: ApprovalAction;
  targets?: string[];
  revisionNote?: string;
}

export interface ApprovalResponse {
  approvalId: string;
  status: 'saved' | 'publishing';
}
