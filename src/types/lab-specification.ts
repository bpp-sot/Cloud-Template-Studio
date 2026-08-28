// Provider-neutral Lab Specification — Development Brief §2, §8, §10.4.
//
// This is the shared, importable/exportable educational specification. It holds
// provider-neutral information where possible; all provider-specific
// configuration lives in the `providerConfig` discriminated union so Azure and
// AWS fields can never leak into one another (Brief §3.5, §22 acceptance).
//
// The same LabSpecification shape is intended to be exchangeable with SoT
// Policy Studio in a future integration (Brief §2).

import type { CloudProvider } from './evidence';

export const LAB_SPEC_SCHEMA_VERSION = 'cloud-template-studio/v1' as const;

export type LabStatus = 'development' | 'production';

/** Step 1 — Template Project. */
export interface ProjectMetadata {
  projectName: string;
  labProfileName: string;
  labProfileNumber: string;
  author: string;
  version: string;
  description: string;
  programme: string;
  module: string;
  intendedAudience: string;
  /** Expected lab duration in minutes (kept as string for form fidelity). */
  labDuration: string;
  status: LabStatus;
  /** Free-text statement of the lab's purpose. */
  purpose: string;
}

export interface LearningOutcome {
  id: string;
  outcome: string;
}

/** A learner-facing task. Requirements trace back to these via `traceTo`. */
export interface LearnerTask {
  id: string;
  task: string;
}

/** A technical/infrastructure task (Brief §2 step 2). */
export interface TechnicalTask {
  id: string;
  task: string;
}

export type ResourceLifecycle =
  'pre-deployed' | 'learner-created' | 'modified' | 'read-only' | 'deleted';

/** Step 2 — Learning Purpose. */
export interface LearningPurpose {
  outcomes: LearningOutcome[];
  learnerTasks: LearnerTask[];
  technicalTasks: TechnicalTask[];
  requiredSoftware: string;
  operatingSystems: string;
  datasets: string;
  expectedOutputs: string;
  /** How the infrastructure is used across its lifecycle. */
  lifecycle: ResourceLifecycle[];
}

export type DeploymentModel = 'pre-entry' | 'background' | 'learner-created' | 'mixed';

export type FailureBehaviour = 'unspecified' | 'fail-lab' | 'continue' | 'retry';

/** Step 4 — Deployment Behaviour. Only evidence-backed Skillable behaviour is stated. */
export interface DeploymentRequirement {
  model: DeploymentModel;
  cleanup: boolean;
  validation: boolean;
  labSaveEnabled: boolean;
  failureBehaviour: FailureBehaviour;
  /** Expected deployment duration in minutes (string for form fidelity). */
  expectedDurationMinutes: string;
  /** Names of parameters intentionally exposed to the lab author / platform. */
  exposedParameters: string[];
}

/** Step 5 — Region and Location. */
export interface RegionRequirement {
  approvedRegions: string[];
  primaryRegion: string;
  fallbackRegions: string[];
  globalResourcesRequired: boolean;
  dataResidencyRequired: boolean;
  residencyNotes: string;
}

/** Step 6 — Architecture Pattern. Patterns suggest resources but require review. */
export type ArchitecturePatternId =
  | 'single-vm'
  | 'multiple-vms'
  | 'client-server'
  | 'multi-tier-web'
  | 'data-science-workstation'
  | 'data-engineering'
  | 'secure-network'
  | 'containers'
  | 'serverless'
  | 'storage-focused'
  | 'custom';

export type OperatingSystemFamily = 'linux' | 'windows';
export type VmAuthMethod = 'ssh-public-key' | 'password-prompt' | 'platform-managed';

/**
 * Provider-neutral compute requirement (Step 7). Provider-specific sizing is
 * referenced by `sizeId` (resolved against compute-sizes.json for the chosen
 * provider). Detailed provider fields live in providerConfig.
 */
export interface ComputeRequirement {
  id: string;
  name: string;
  osFamily: OperatingSystemFamily;
  /** Catalogue size id, e.g. an Azure VM size or an AWS instance type. */
  sizeId: string;
  count: number;
  authMethod: VmAuthMethod;
  /** Opt-in only. Never enabled silently (Brief §3.4). */
  publicIpRequested: boolean;
  dataDiskCount: number;
  /** Learner task / technical task ids this compute traces to (Brief §8). */
  traceTo: string[];
}

/** Step 8 — Networking (provider-neutral surface). */
export interface NetworkRequirement {
  id: string;
  name: string;
  addressSpace: string;
  subnetName: string;
  subnetPrefix: string;
  /** Opt-in inbound rules. Wildcard CIDRs are flagged, never silent (Brief §3.4). */
  inboundRules: InboundRule[];
  traceTo: string[];
}

export interface InboundRule {
  id: string;
  port: number;
  protocol: 'tcp' | 'udp';
  /** Source CIDR. 0.0.0.0/0 triggers a security finding. */
  sourceCidr: string;
  description: string;
}

/** Step 9 — Storage and Data. Azure Managed Disk vs Storage Account, AWS EBS vs S3. */
export type StorageKind =
  'azure-managed-disk' | 'azure-storage-account' | 'aws-ebs-volume' | 'aws-s3-bucket';

export interface StorageRequirement {
  id: string;
  name: string;
  kind: StorageKind;
  sizeGb?: number;
  /** S3 / blob public access. Defaults to blocked (Brief §9). */
  publicAccessBlocked: boolean;
  traceTo: string[];
}

/** Step 10 — Identity and Access. Only where justified (Brief §10). */
export interface IdentityRequirement {
  id: string;
  name: string;
  kind: 'azure-managed-identity' | 'aws-iam-role';
  purpose: string;
  traceTo: string[];
}

export type InitScriptKind =
  'cloud-init' | 'azure-vm-extension' | 'aws-user-data' | 'powershell' | 'shell';

/** Step 11 — Initialisation and Software. User scripts are Classification F. */
export interface InitialisationRequirement {
  id: string;
  targetComputeId: string;
  kind: InitScriptKind;
  /** Raw script content. Always secret-scanned; never allowed to embed secrets. */
  script: string;
  description: string;
  traceTo: string[];
}

/** Security requirement / posture toggle captured during the wizard. */
export interface SecurityRequirement {
  id: string;
  description: string;
}

/** Step 12 — Tags, Naming and Governance. */
export interface GovernanceRequirement {
  namingPrefix: string;
  programmeCode: string;
  moduleCode: string;
  costCentre: string;
  owner: string;
  purposeTag: string;
  expiry: string;
  requiredTags: Array<{ key: string; value: string }>;
}

// ── Provider-specific configuration (isolated; never cross-contaminated) ──

export interface AzureProviderConfig {
  /** Deployment container. Azure uses a Resource Group (Brief §3.5). */
  resourceGroupName: string;
  /** Azure image reference for VMs, e.g. publisher/offer/sku. */
  imageReference: {
    publisher: string;
    offer: string;
    sku: string;
    version: string;
  } | null;
  /** Selected image id from images.json, or null for the default. */
  imageId: string | null;
  /** Opt-in diagnostics storage (never silent). */
  bootDiagnosticsEnabled: boolean;
}

export interface AwsProviderConfig {
  /** Deployment container. AWS uses a CloudFormation Stack (Brief §3.5). */
  stackName: string;
  /** AMI strategy — SSM parameter alias preferred over hard-coded AMI ids. */
  amiStrategy: 'ssm-parameter' | 'explicit-ami';
  /** Selected image id from images.json, or null for the default. */
  imageId: string | null;
  ssmParameterName: string | null;
  explicitAmiId: string | null;
  /** Key-pair strategy. Never embeds private keys. */
  keyPairStrategy: 'existing-name' | 'none';
  keyPairName: string | null;
}

export type ProviderConfig =
  { kind: 'azure'; azure: AzureProviderConfig } | { kind: 'aws'; aws: AwsProviderConfig };

/** The provider-neutral, persisted, importable/exportable specification. */
export interface LabSpecification {
  schemaVersion: typeof LAB_SPEC_SCHEMA_VERSION;
  metadata: ProjectMetadata;
  learningPurpose: LearningPurpose;
  provider: CloudProvider;
  deployment: DeploymentRequirement;
  location: RegionRequirement;
  architecturePattern: ArchitecturePatternId;
  compute: ComputeRequirement[];
  network: NetworkRequirement[];
  storage: StorageRequirement[];
  identity: IdentityRequirement[];
  initialisation: InitialisationRequirement[];
  security: SecurityRequirement[];
  governance: GovernanceRequirement;
  /** Professional Mode additions (Class F), kept separate from guided config. */
  professional?: ProfessionalAdditions;
  providerConfig: ProviderConfig;
}

/** Professional Mode — Development Brief §11. Additions are Classification F. */
export interface ProfessionalAdditions {
  /** Raw provider-native fragments the author supplied. Structurally validated. */
  azureFragments: string[];
  awsFragments: string[];
  notes: string;
}
