// Internal generation model — Development Brief §10.4.
//
// The InternalModel is the *only* input the provider generator engines read.
// It is produced by the normaliser from a validated LabSpecification plus the
// resource/dependency catalogues. Reviews and learner instructions also derive
// from the InternalModel, which is why generated templates and instructions
// cannot drift apart (Brief §15).

import type { CloudProvider, EvidenceReference } from './evidence';

/** Why a resource ended up in the model. Mirrors dependency origins. */
export type ResourceOrigin =
  'user' | 'provider-required' | 'pattern-required' | 'skillable-required' | 'safety-recommended';

export interface GeneratedResource {
  logicalId: string;
  /** Provider-native type, e.g. Microsoft.Compute/virtualMachines | AWS::EC2::Instance. */
  providerResourceType: string;
  purpose: string;
  origin: ResourceOrigin;
  autoIncluded: boolean;
  dependsOn: string[];
  evidence: EvidenceReference[];
  /** Azure apiVersion or CloudFormation resource-spec version. */
  apiVersionOrSpec: string;
  securityNotes: string[];
  costNotes: string[];
  warnings: string[];
  /** Opaque, provider-specific property bag consumed by that provider's generator. */
  properties: Record<string, unknown>;
}

export type ParameterType = 'string' | 'securestring' | 'int' | 'bool' | 'array';

export interface ParameterDef {
  name: string;
  type: ParameterType;
  description: string;
  defaultValue?: unknown;
  allowedValues?: unknown[];
  /** True for values that must never be persisted/echoed (e.g. admin secrets). */
  secure: boolean;
}

export interface OutputDef {
  name: string;
  description: string;
  /** Provider-native value expression (e.g. a Bicep/CFN reference). */
  valueExpression: string;
}

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** A review finding seeded during normalisation or produced by a review engine. */
export interface ReviewFinding {
  id: string;
  kind: 'security' | 'cost' | 'dependency' | 'deployment' | 'evidence' | 'professional';
  severity: FindingSeverity;
  category: string;
  description: string;
  recommendation: string;
  affectedResource?: string;
  evidence?: EvidenceReference;
}

export interface InternalModel {
  provider: CloudProvider;
  resources: GeneratedResource[];
  parameters: ParameterDef[];
  outputs: OutputDef[];
  /** Findings seeded during normalisation (e.g. auto-included dependency notes). */
  findings: ReviewFinding[];
}
