// Evidence model — Development Brief §4 and §3 (Evidence before generation).
//
// Every generated resource and important property must carry at least one
// evidence reference. Nothing is presented as a provider or Skillable
// requirement unless it is backed by Classification A–D. Unverified behaviour
// is Classification G; application safety constraints are Classification E;
// user-supplied custom configuration is Classification F.

export type CloudProvider = 'azure' | 'aws';

/**
 * Evidence classification (A–G). Mirrors SoT Policy Studio so the two sister
 * products share one evidence vocabulary.
 */
export type EvidenceClassification =
  | 'A' // Official Skillable example (LearnOnDemandSystems / Skillable source)
  | 'B' // Official Skillable documentation
  | 'C' // Native Microsoft Azure documentation (Microsoft Learn / ARM schemas)
  | 'D' // Native AWS documentation (AWS docs / CloudFormation resource spec)
  | 'E' // Application safety constraint (added by this tool, transparent)
  | 'F' // User-supplied custom configuration (Professional Mode)
  | 'G'; // Unverified / requires manual review

export type ConfidenceStatus = 'high' | 'medium' | 'low';

/**
 * How the generated fragment relates to its source. Carried forward from
 * Policy Studio and reused unchanged so both tools trace provenance the same
 * way.
 */
export type Provenance = 'copied' | 'parameterised' | 'combined' | 'application-generated';

export interface EvidenceReference {
  classification: EvidenceClassification;
  sourceTitle: string;
  sourcePath: string | null;
  sourceUrl: string | null;
  rationale: string;
  provenance: Provenance;
  confidence: ConfidenceStatus;
  /**
   * Provider schema / API version the evidence was recorded against, where
   * relevant (e.g. an Azure resource apiVersion or a CloudFormation resource
   * specification version). Null when not applicable.
   */
  schemaOrApiVersion?: string | null;
}

/** A single row in the evidence index data file (src/data/evidence-index.json). */
export interface EvidenceIndexEntry {
  id: string;
  classification: EvidenceClassification;
  provider: CloudProvider | 'neutral';
  sourceTitle: string;
  sourcePath: string | null;
  sourceUrl: string | null;
  rationale: string;
  confidence: ConfidenceStatus;
  reviewDate: string;
}
