// Generation orchestrator.
//
// Builds the provider InternalModel from a LabSpecification and renders the
// provider-appropriate output artifacts. Azure is implemented (Bicep + ARM +
// parameters); AWS CloudFormation lands in Phase 3.

import type { GeneratedArtifacts, LabSpecification } from '@/types';
import { buildInternalModel } from '@/lib/normalise/normaliser';
import { generateBicep } from '@/lib/generators/azure/bicep';
import { generateArmTemplate } from '@/lib/generators/azure/arm';
import { generateAzureParametersJson } from '@/lib/generators/azure/parameters';

export function generateArtifacts(spec: LabSpecification): GeneratedArtifacts {
  const internalModel = buildInternalModel(spec);
  const generatedAt = new Date().toISOString();

  if (spec.provider === 'azure') {
    return {
      provider: 'azure',
      generatedAt,
      bicep: generateBicep(internalModel),
      armJson: generateArmTemplate(internalModel),
      parametersJson: generateAzureParametersJson(internalModel),
      internalModel,
    };
  }

  // AWS CloudFormation generation is delivered in Phase 3.
  return {
    provider: 'aws',
    generatedAt,
    internalModel,
  };
}
