// Typed accessors over the normalised catalogue data files (src/data).
// Centralising the `as` casts here keeps the rest of the code fully typed.

import type {
  ComputeSizeDef,
  ComputeSizesFile,
  CostRulesFile,
  EvidenceIndexEntry,
  EvidenceIndexFile,
  NamingRulesFile,
  PatternFile,
  RegionDef,
  RegionsFile,
  ResourceCatalogueEntry,
  ResourceCatalogueFile,
  SecurityRulesFile,
  SourceManifest,
  CloudProvider,
} from '@/types';

import azureResourceCatalogue from '@data/azure-resource-catalogue.json';
import awsResourceCatalogue from '@data/aws-resource-catalogue.json';
import azurePatterns from '@data/azure-patterns.json';
import awsPatterns from '@data/aws-patterns.json';
import regionsData from '@data/regions.json';
import computeSizesData from '@data/compute-sizes.json';
import securityRulesData from '@data/security-rules.json';
import costRulesData from '@data/cost-risk-rules.json';
import namingRulesData from '@data/naming-rules.json';
import evidenceIndexData from '@data/evidence-index.json';
import sourceManifestData from '@data/source-manifest.json';

const azureCatalogue = azureResourceCatalogue as ResourceCatalogueFile;
const awsCatalogue = awsResourceCatalogue as ResourceCatalogueFile;
const regions = regionsData as RegionsFile;
const computeSizes = computeSizesData as ComputeSizesFile;
const evidenceIndex = evidenceIndexData as EvidenceIndexFile;

export const sourceManifest = sourceManifestData as SourceManifest;
export const securityRules = (securityRulesData as SecurityRulesFile).rules;
export const costRules = (costRulesData as CostRulesFile).rules;
export const namingRules = (namingRulesData as NamingRulesFile).rules;
export const azurePatternList = (azurePatterns as PatternFile).patterns;
export const awsPatternList = (awsPatterns as PatternFile).patterns;

export function getResourceCatalogue(provider: CloudProvider): ResourceCatalogueEntry[] {
  return provider === 'azure' ? azureCatalogue.resources : awsCatalogue.resources;
}

export function findResource(
  provider: CloudProvider,
  id: string,
): ResourceCatalogueEntry | undefined {
  return getResourceCatalogue(provider).find((r) => r.id === id);
}

export function getRegions(provider: CloudProvider): RegionDef[] {
  return provider === 'azure' ? regions.azure : regions.aws;
}

export function getComputeSizes(provider: CloudProvider): ComputeSizeDef[] {
  return provider === 'azure' ? computeSizes.azure : computeSizes.aws;
}

export function findComputeSize(provider: CloudProvider, id: string): ComputeSizeDef | undefined {
  return getComputeSizes(provider).find((s) => s.id === id);
}

export function getEvidenceEntries(): EvidenceIndexEntry[] {
  return evidenceIndex.entries;
}

export function findEvidence(id: string): EvidenceIndexEntry | undefined {
  return evidenceIndex.entries.find((e) => e.id === id);
}
