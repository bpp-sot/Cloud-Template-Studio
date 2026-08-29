// Policy Studio export — Phase 6.
//
// Exports the provider-neutral LabSpecification as a JSON document compatible
// with the planned shared Lab Specification exchange format between
// SoT Cloud Template Studio and SoT Policy Studio.
//
// The export is strictly provider-neutral: no provider-specific configuration
// (providerConfig.azure / providerConfig.aws) is included. The schema version
// is preserved so the receiving tool can validate compatibility.

import { APP_INFO } from '@/lib/app-info';
import type { LabSpecification } from '@/types';

/**
 * The shape of the exported Lab Specification for Policy Studio exchange.
 *
 * This is a strict subset of LabSpecification with all provider-specific
 * configuration removed. It is intended to be consumed by SoT Policy Studio
 * or any tool that understands the shared Lab Specification format.
 */
export interface PolicyStudioExport {
  /** Schema version of the Lab Specification exchange format. */
  schemaVersion: string;
  /** Export metadata identifying the source tool and export time. */
  export: {
    sourceTool: string;
    sourceVersion: string;
    exportedAt: string;
    format: 'lab-specification';
  };
  /** The provider-neutral LabSpecification (providerConfig stripped). */
  specification: ProviderNeutralLabSpec;
}

/**
 * A LabSpecification with provider-specific configuration removed.
 * The `provider` field is retained so the receiving tool knows which
 * provider the lab targets, but no provider-specific fields are included.
 */
export type ProviderNeutralLabSpec = Omit<LabSpecification, 'providerConfig'>;

/**
 * Export a LabSpecification as a provider-neutral JSON document for
 * Policy Studio or any compatible consumer.
 *
 * Provider-specific configuration (providerConfig.azure / providerConfig.aws)
 * is stripped. The schema version is preserved.
 */
export function exportForPolicyStudio(spec: LabSpecification): PolicyStudioExport {
  // Strip providerConfig to ensure no provider-specific field leakage.
  const { providerConfig: _providerConfig, ...neutral } = spec;

  return {
    schemaVersion: spec.schemaVersion,
    export: {
      sourceTool: APP_INFO.name,
      sourceVersion: APP_INFO.version,
      exportedAt: new Date().toISOString(),
      format: 'lab-specification',
    },
    specification: neutral,
  };
}

/**
 * Serialize the Policy Studio export as a downloadable JSON string.
 */
export function exportForPolicyStudioAsJson(spec: LabSpecification): string {
  return JSON.stringify(exportForPolicyStudio(spec), null, 2);
}

/**
 * Validate that a parsed object is a valid Policy Studio export.
 * Returns an error message string if invalid, or null if valid.
 */
export function validatePolicyStudioExport(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return 'Export is not an object';
  const exportObj = obj as Record<string, unknown>;
  if (typeof exportObj.schemaVersion !== 'string') return 'Missing or invalid schemaVersion';
  if (!exportObj.export || typeof exportObj.export !== 'object') return 'Missing export metadata';
  const exportMeta = exportObj.export as Record<string, unknown>;
  if (exportMeta.format !== 'lab-specification') return `Unexpected format: ${exportMeta.format}`;
  if (!exportObj.specification || typeof exportObj.specification !== 'object')
    return 'Missing specification';
  const spec = exportObj.specification as Record<string, unknown>;
  if (typeof spec.schemaVersion !== 'string') return 'Specification missing schemaVersion';
  if (spec.providerConfig) return 'Provider-specific configuration must not be present in export';
  return null;
}
