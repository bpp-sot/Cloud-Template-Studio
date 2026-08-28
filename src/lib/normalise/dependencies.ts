// Dependency engine — Development Brief §9.
//
// Data-driven dependency resolution. Distinguishes provider-required,
// pattern-required, Skillable-required, safety-recommended and user-selected
// dependencies, and whether each is auto-included. Optional dependencies stay
// opt-in; nothing is silently broadened (Brief §3.4).

import type { CloudProvider, Dependency, EvidenceReference, ResourceCatalogueEntry } from '@/types';
import { findEvidence } from '@/lib/data';

export interface ResolvedDependency {
  dependency: Dependency;
  /** True when the author explicitly opted in to an optional dependency. */
  includedByUser: boolean;
  /** Final decision: does this dependency materialise in the model? */
  included: boolean;
  evidence: EvidenceReference;
}

/** Convert an evidence-index id into a full EvidenceReference for the model. */
export function evidenceRefFromId(
  id: string,
  fallbackProvenance: EvidenceReference['provenance'] = 'application-generated',
): EvidenceReference {
  const entry = findEvidence(id);
  if (!entry) {
    return {
      classification: 'G',
      sourceTitle: `Unresolved evidence reference: ${id}`,
      sourcePath: null,
      sourceUrl: null,
      rationale:
        'The referenced evidence id was not found in the evidence index. Treated as unverified pending manual review.',
      provenance: fallbackProvenance,
      confidence: 'low',
      schemaOrApiVersion: null,
    };
  }
  return {
    classification: entry.classification,
    sourceTitle: entry.sourceTitle,
    sourcePath: entry.sourcePath,
    sourceUrl: entry.sourceUrl,
    rationale: entry.rationale,
    provenance: fallbackProvenance,
    confidence: entry.confidence,
    schemaOrApiVersion: null,
  };
}

/**
 * Resolve the dependencies for a catalogue resource, given the set of optional
 * dependency identifiers the author explicitly opted into.
 */
export function resolveDependencies(
  resource: ResourceCatalogueEntry,
  optedInIdentifiers: ReadonlySet<string>,
): ResolvedDependency[] {
  return resource.dependencies.map((dependency) => {
    const includedByUser = optedInIdentifiers.has(dependency.identifier);
    // Required + auto-included dependencies are always included. Optional
    // dependencies are included ONLY when the author opted in.
    const included = dependency.required || dependency.autoIncluded || includedByUser;
    return {
      dependency,
      includedByUser,
      included,
      evidence: evidenceRefFromId(dependency.evidenceReference),
    };
  });
}

/** List the optional, user-selectable dependencies for a resource (for the UI panel). */
export function optionalDependencies(resource: ResourceCatalogueEntry): Dependency[] {
  return resource.dependencies.filter((d) => d.userSelectable && !d.required && !d.autoIncluded);
}

/** List the required/auto-included dependencies for a resource. */
export function requiredDependencies(resource: ResourceCatalogueEntry): Dependency[] {
  return resource.dependencies.filter((d) => d.required || d.autoIncluded);
}

/** Guard: a resource must only be resolved against its own provider's catalogue. */
export function assertProviderMatch(resource: ResourceCatalogueEntry, provider: CloudProvider) {
  if (resource.provider !== provider) {
    throw new Error(
      `Provider mismatch: resource "${resource.id}" is ${resource.provider} but was resolved for ${provider}. Provider models must remain separate (Brief §3.5).`,
    );
  }
}
