// AWS CloudFormation parameters JSON generator — Development Brief §10.3.
//
// Produces a deployable parameters file (JSON) from the AWS InternalModel.
// Secure parameters are emitted with empty values; the application never
// stores or echoes real secret values.

import type { ParameterDef } from '@/types';

export function generateAwsParametersJson(parameters: ParameterDef[]): string {
  const out: Record<string, unknown> = {};
  for (const p of parameters) {
    out[p.name] = p.secure ? '' : (p.defaultValue ?? '');
  }
  return JSON.stringify(out, null, 2) + '\n';
}
