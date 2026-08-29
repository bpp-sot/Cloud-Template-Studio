// Generation orchestrator.
//
// Builds the provider InternalModel from a LabSpecification and renders the
// provider-appropriate output artifacts. Azure produces Bicep + ARM + parameters;
// AWS produces CloudFormation YAML + JSON + parameters.

import type { GeneratedArtifacts, LabSpecification } from '@/types';
import { buildInternalModel } from '@/lib/normalise/normaliser';
import { generateBicep } from '@/lib/generators/azure/bicep';
import { generateArmTemplate } from '@/lib/generators/azure/arm';
import { generateAzureParametersJson } from '@/lib/generators/azure/parameters';
import { generateCloudFormationYaml } from '@/lib/generators/aws/cloudformation-yaml';
import { generateCloudFormationJson } from '@/lib/generators/aws/cloudformation-json';
import { generateAwsParametersJson } from '@/lib/generators/aws/parameters';

export function generateArtifacts(spec: LabSpecification): GeneratedArtifacts {
  const internalModel = buildInternalModel(spec);
  const generatedAt = new Date().toISOString();
  const prof = spec.professional;
  const azureFragments = prof?.azureFragments ?? [];
  const awsFragments = prof?.awsFragments ?? [];

  if (spec.provider === 'azure') {
    return {
      provider: 'azure',
      generatedAt,
      bicep: generateBicep(internalModel, azureFragments),
      armJson: generateArmTemplate(internalModel, azureFragments),
      parametersJson: generateAzureParametersJson(internalModel),
      internalModel,
    };
  }

  if (spec.provider === 'aws') {
    return {
      provider: 'aws',
      generatedAt,
      cloudFormationYaml: generateCloudFormationYaml(internalModel, awsFragments),
      cloudFormationJson: generateCloudFormationJson(internalModel, awsFragments),
      parametersJson: generateAwsParametersJson(internalModel.parameters),
      internalModel,
    };
  }

  // Fallback (no provider-specific generators yet).
  return {
    provider: spec.provider,
    generatedAt,
    internalModel,
  };
}
