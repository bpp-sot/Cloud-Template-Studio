// Azure deployment parameters file generator — Development Brief §10 (parameters).
//
// Produces an ARM parameters JSON file. Secure parameters are emitted with an
// empty value for the lab author to supply at deployment time; secrets are
// never written into the file.

import type { InternalModel } from '@/types';

export function generateAzureParametersJson(model: InternalModel): string {
  const parameters: Record<string, { value: unknown }> = {};
  for (const p of model.parameters) {
    parameters[p.name] = { value: p.secure ? '' : (p.defaultValue ?? '') };
  }
  const file = {
    $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
    contentVersion: '1.0.0.0',
    parameters,
  };
  return JSON.stringify(file, null, 2) + '\n';
}
