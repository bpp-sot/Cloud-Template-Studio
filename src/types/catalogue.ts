// Data-file / catalogue types — Development Brief §9 and §16.
//
// All catalogue data is normalised JSON committed under src/data and validated
// against JSON Schemas in src/data-schemas at test time.

import type {
  CloudProvider,
  EvidenceClassification,
  EvidenceIndexEntry,
  EvidenceReference,
} from './evidence';
import type { ArchitecturePatternId } from './lab-specification';

/**
 * Dependency descriptor (Brief §9). The resolver distinguishes provider-required,
 * pattern-required, Skillable-required, safety-recommended and user-selected
 * dependencies, and whether they are auto-included.
 */
export type DependencyOrigin =
  | 'provider-required'
  | 'pattern-required'
  | 'skillable-required'
  | 'safety-recommended'
  | 'user-selectable';

export interface Dependency {
  identifier: string;
  provider: CloudProvider;
  resourceType: string;
  required: boolean;
  autoIncluded: boolean;
  origin: DependencyOrigin;
  reason: string;
  evidenceClassification: EvidenceClassification;
  evidenceReference: string; // id into evidence-index.json
  securityImpact: string;
  costImpact: string;
  userSelectable: boolean;
}

/** A row in azure-resource-catalogue.json / aws-resource-catalogue.json (Brief §16). */
export interface ResourceCatalogueEntry {
  id: string;
  provider: CloudProvider;
  resourceType: string;
  category: string;
  supportedProperties: string[];
  defaults: Record<string, unknown>;
  dependencies: Dependency[];
  riskProfile: {
    publicExposure: 'none' | 'optional' | 'high';
    identity: 'none' | 'low' | 'medium' | 'high';
    network: 'none' | 'low' | 'medium' | 'high';
    cost: 'low' | 'medium' | 'high';
  };
  costSensitivity: 'low' | 'medium' | 'high';
  evidence: EvidenceReference[];
  limitations: string[];
  documentationUrl: string;
  schemaOrApiVersion: string;
  reviewDate: string;
}

export interface ResourceCatalogueFile {
  provider: CloudProvider;
  resources: ResourceCatalogueEntry[];
}

/** Trusted infrastructure pattern (Brief §7.5 Pattern Explorer). */
export interface PatternDef {
  id: string;
  provider: CloudProvider;
  patternId: ArchitecturePatternId;
  title: string;
  purpose: string;
  /** Catalogue resource ids the pattern suggests (subject to review). */
  suggestedResources: string[];
  securityObservations: string[];
  costConsiderations: string[];
  limitations: string[];
  evidence: EvidenceReference[];
  documentationUrl: string;
}

export interface PatternFile {
  provider: CloudProvider;
  patterns: PatternDef[];
}

/** regions.json */
export interface RegionDef {
  id: string;
  displayName: string;
  provider: CloudProvider;
  isGlobalCapable?: boolean;
}

export interface RegionsFile {
  azure: RegionDef[];
  aws: RegionDef[];
}

/** compute-sizes.json */
export interface ComputeSizeDef {
  id: string;
  provider: CloudProvider;
  displayName: string;
  vcpu: number;
  memoryGb: number;
  /** True if this size carries elevated cost risk (GPU / oversized). */
  costFlag: boolean;
  category: 'general' | 'compute' | 'memory' | 'gpu' | 'burstable';
  evidenceReference: string;
}

export interface ComputeSizesFile {
  azure: ComputeSizeDef[];
  aws: ComputeSizeDef[];
}

/** security-rules.json — declarative security-review rules (Brief §12). */
export interface SecurityRuleDef {
  id: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  provider: CloudProvider | 'neutral';
  description: string;
  recommendation: string;
}

export interface SecurityRulesFile {
  rules: SecurityRuleDef[];
}

/** cost-risk-rules.json — declarative cost-risk rules (Brief §13). */
export interface CostRuleDef {
  id: string;
  category: string;
  provider: CloudProvider | 'neutral';
  description: string;
  guidance: string;
  pricingCalculatorUrl: string;
}

export interface CostRulesFile {
  rules: CostRuleDef[];
}

/** naming-rules.json — provider-appropriate naming guidance (Brief §12). */
export interface NamingRuleDef {
  id: string;
  provider: CloudProvider;
  resourceType: string;
  pattern: string;
  maxLength: number;
  notes: string;
}

export interface NamingRulesFile {
  rules: NamingRuleDef[];
}

/** source-manifest.json — provenance and versioning (Brief §7.7, §20). */
export interface SourceManifest {
  product: string;
  evidenceSyncDate: string;
  providerSchemaVersions: {
    azureResourceManager: string;
    awsCloudFormation: string;
  };
  sources: Array<{
    id: string;
    title: string;
    url: string;
    classification: EvidenceClassification;
    retrievedDate: string;
  }>;
  licenseNote: string;
}

export interface EvidenceIndexFile {
  entries: EvidenceIndexEntry[];
}

/** images.json — curated OS image references (Brief §7.6). */
export interface AzureImageDef {
  id: string;
  displayName: string;
  osFamily: 'linux' | 'windows';
  publisher: string;
  offer: string;
  sku: string;
  version: string;
  evidenceReference: string;
}

export interface AwsImageDef {
  id: string;
  displayName: string;
  osFamily: 'linux' | 'windows';
  /** SSM public parameter alias preferred over hard-coded AMI ids. */
  ssmParameter: string;
  evidenceReference: string;
}

export interface ImagesFile {
  azure: AzureImageDef[];
  aws: AwsImageDef[];
}
