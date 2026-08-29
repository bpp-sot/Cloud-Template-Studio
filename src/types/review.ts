// Dedicated review engine types — Development Brief §13, §14.
//
// These types support the Phase 4 dedicated review pages: security review,
// cost review, and deployment readiness. They are produced by dedicated
// review engines that read from the InternalModel (and LabSpecification where
// needed), so reviews and templates cannot drift apart.

import type { CloudProvider, EvidenceReference } from './evidence';
import type { ReviewFinding, FindingSeverity } from './internal-model';

// ── Security Review ──

export type OverallRisk = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityReviewItem {
  id: string;
  severity: FindingSeverity;
  category: string;
  description: string;
  recommendation: string;
  affectedResource?: string;
  evidence?: EvidenceReference;
  /** Provider-specific check identifier, e.g. "nsg-open-cidr" or "sg-mgmt-port". */
  checkId: string;
}

export interface SecurityReview {
  projectName: string;
  labProfileNumber: string;
  provider: CloudProvider;
  generatedAt: string;
  overallRisk: OverallRisk;
  items: SecurityReviewItem[];
  summary: string;
  /** Counts by severity. */
  counts: Record<FindingSeverity, number>;
}

// ── Cost Review ──

export type CostRiskLevel = 'high' | 'medium' | 'low';

export interface CostReviewItem {
  id: string;
  category: string;
  description: string;
  recommendation: string;
  affectedResource?: string;
  riskLevel: CostRiskLevel;
  /** Provider pricing calculator URL relevant to this item. */
  pricingCalculatorUrl: string;
}

export interface CostReview {
  projectName: string;
  provider: CloudProvider;
  generatedAt: string;
  overallRisk: CostRiskLevel;
  items: CostReviewItem[];
  /** Per-resource cost notes from the InternalModel. */
  resourceCostNotes: Array<{ logicalId: string; notes: string[] }>;
  /** Estimated lab duration in minutes (from the spec). */
  estimatedDurationMinutes: number;
  summary: string;
}

// ── Deployment Readiness ──

export type ReadinessStatus = 'ready' | 'needs-attention' | 'blocked';

export interface ReadinessCheck {
  id: string;
  label: string;
  description: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface DeploymentReadiness {
  projectName: string;
  provider: CloudProvider;
  generatedAt: string;
  overallStatus: ReadinessStatus;
  checks: ReadinessCheck[];
  /** Findings that contributed to the readiness assessment. */
  blockingFindings: ReviewFinding[];
  warningFindings: ReviewFinding[];
  summary: string;
}
