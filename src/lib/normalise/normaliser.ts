// Normaliser — Development Brief §10.4.
//
// Converts a validated, provider-neutral LabSpecification (plus the resource /
// dependency catalogues) into a provider-specific InternalModel. The generator
// engines and every review artifact read ONLY from the InternalModel, so
// generated templates and learner instructions cannot drift apart (Brief §15).
//
// This is deterministic: logical ids are derived from stable names/indices, not
// random, so generated output can be snapshot-tested via fixtures.

import type {
  CloudProvider,
  ComputeRequirement,
  Dependency,
  GeneratedResource,
  InternalModel,
  LabSpecification,
  ResourceOrigin,
  ReviewFinding,
  ResourceCatalogueEntry,
} from '@/types';
import { findComputeSize, findResource, securityRules, costRules } from '@/lib/data';
import { evidenceRefFromId, resolveDependencies } from './dependencies';

/** The primary catalogue resource id used for a single compute unit, per provider. */
const PRIMARY_COMPUTE_ID: Record<CloudProvider, string> = {
  azure: 'azure-vm',
  aws: 'aws-ec2-instance',
};

function originFromDependency(dep: Dependency, includedByUser: boolean): ResourceOrigin {
  switch (dep.origin) {
    case 'provider-required':
      return 'provider-required';
    case 'pattern-required':
      return 'pattern-required';
    case 'skillable-required':
      return 'skillable-required';
    case 'safety-recommended':
      return 'safety-recommended';
    case 'user-selectable':
      return includedByUser ? 'user' : 'safety-recommended';
  }
}

/** Which optional dependency identifiers the spec opts into for a compute unit. */
function optedInDependencies(
  provider: CloudProvider,
  compute: ComputeRequirement,
  spec: LabSpecification,
): Set<string> {
  const opts = new Set<string>();
  if (compute.publicIpRequested) {
    if (provider === 'azure') opts.add('azure-public-ip');
    if (provider === 'aws') {
      opts.add('aws-internet-gateway');
      opts.add('aws-route-table');
    }
  }
  if (
    provider === 'azure' &&
    spec.providerConfig.kind === 'azure' &&
    spec.providerConfig.azure.bootDiagnosticsEnabled
  ) {
    opts.add('azure-diagnostics-storage');
  }
  return opts;
}

function findingFromSecurityRule(
  id: string,
  affectedResource: string | undefined,
  extra?: Partial<ReviewFinding>,
): ReviewFinding | null {
  const rule = securityRules.find((r) => r.id === id);
  if (!rule) return null;
  return {
    id: `${id}:${affectedResource ?? 'general'}`,
    kind: 'security',
    severity: rule.severity,
    category: rule.category,
    description: rule.description,
    recommendation: rule.recommendation,
    affectedResource,
    ...extra,
  };
}

function findingFromCostRule(id: string, affectedResource?: string): ReviewFinding | null {
  const rule = costRules.find((r) => r.id === id);
  if (!rule) return null;
  return {
    id: `${id}:${affectedResource ?? 'general'}`,
    kind: 'cost',
    severity: 'info',
    category: rule.category,
    description: rule.description,
    recommendation: `${rule.guidance} Pricing calculator: ${rule.pricingCalculatorUrl}`,
    affectedResource,
  };
}

function buildComputeResources(
  provider: CloudProvider,
  compute: ComputeRequirement,
  index: number,
  spec: LabSpecification,
  catalogue: ResourceCatalogueEntry,
): { resources: GeneratedResource[]; findings: ReviewFinding[] } {
  const resources: GeneratedResource[] = [];
  const findings: ReviewFinding[] = [];
  const baseId = compute.name || `${provider}-compute-${index + 1}`;

  const size = findComputeSize(provider, compute.sizeId);

  // Primary compute resource.
  const primary: GeneratedResource = {
    logicalId: baseId,
    providerResourceType: catalogue.resourceType,
    purpose: `Primary ${provider === 'azure' ? 'virtual machine' : 'EC2 instance'} for the lab (${compute.osFamily}).`,
    origin: 'user',
    autoIncluded: false,
    dependsOn: [],
    evidence: catalogue.evidence,
    apiVersionOrSpec: catalogue.schemaOrApiVersion,
    securityNotes: [],
    costNotes: size?.costFlag ? ['Selected size carries elevated cost risk.'] : [],
    warnings: size ? [] : [`Compute size "${compute.sizeId}" was not found in the catalogue.`],
    properties: {
      sizeId: compute.sizeId,
      osFamily: compute.osFamily,
      count: compute.count,
      authMethod: compute.authMethod,
      publicIpRequested: compute.publicIpRequested,
    },
  };
  resources.push(primary);

  // Dependencies.
  const optedIn = optedInDependencies(provider, compute, spec);
  const resolved = resolveDependencies(catalogue, optedIn);
  for (const r of resolved) {
    if (!r.included) continue;
    const dep = r.dependency;
    const logicalId = `${baseId}-${dep.identifier}`;
    resources.push({
      logicalId,
      providerResourceType: dep.resourceType,
      purpose: dep.reason,
      origin: originFromDependency(dep, r.includedByUser),
      autoIncluded: dep.autoIncluded,
      dependsOn: [baseId],
      evidence: [r.evidence],
      apiVersionOrSpec: catalogue.schemaOrApiVersion,
      securityNotes: [dep.securityImpact],
      costNotes: [dep.costImpact],
      warnings: [],
      properties: { forCompute: baseId, dependencyIdentifier: dep.identifier },
    });
    primary.dependsOn.push(logicalId);

    if (dep.autoIncluded) {
      findings.push({
        id: `auto-included:${logicalId}`,
        kind: 'dependency',
        severity: 'info',
        category: 'Auto-included dependency',
        description: `"${dep.resourceType}" was automatically included because ${dep.reason}`,
        recommendation: 'Review the auto-included resource. You can inspect why it was added here.',
        affectedResource: logicalId,
        evidence: r.evidence,
      });
    }
  }

  // Public exposure findings (opt-in only, never silent).
  if (compute.publicIpRequested) {
    const sec = findingFromSecurityRule('sec-public-ip', baseId);
    if (sec) findings.push(sec);
    const cost = findingFromCostRule('cost-public-ipv4', baseId);
    if (cost) findings.push(cost);
  }

  // Cost finding for GPU / oversized compute.
  if (size?.costFlag) {
    const cost = findingFromCostRule('cost-gpu-oversized', baseId);
    if (cost) findings.push(cost);
  }

  return { resources, findings };
}

export function buildInternalModel(spec: LabSpecification): InternalModel {
  const provider = spec.provider;
  const resources: GeneratedResource[] = [];
  const findings: ReviewFinding[] = [];

  const catalogue = findResource(provider, PRIMARY_COMPUTE_ID[provider]);
  if (!catalogue) {
    throw new Error(
      `No primary compute catalogue entry for provider "${provider}". Expected id "${PRIMARY_COMPUTE_ID[provider]}".`,
    );
  }

  spec.compute.forEach((compute, index) => {
    const built = buildComputeResources(provider, compute, index, spec, catalogue);
    resources.push(...built.resources);
    findings.push(...built.findings);
  });

  // Inbound-rule network findings (open CIDR / management ports).
  for (const net of spec.network) {
    for (const rule of net.inboundRules) {
      if (rule.sourceCidr.trim() === '0.0.0.0/0') {
        const f = findingFromSecurityRule('sec-open-cidr', net.name);
        if (f)
          findings.push({
            ...f,
            description: `${f.description} (port ${rule.port} on ${net.name})`,
          });
      }
      if ((rule.port === 22 || rule.port === 3389) && rule.sourceCidr.trim() === '0.0.0.0/0') {
        const f = findingFromSecurityRule('sec-mgmt-port', net.name);
        if (f) findings.push(f);
      }
    }
  }

  // Multi-machine and long-duration cost signals.
  const totalInstances = spec.compute.reduce((sum, c) => sum + Math.max(1, c.count), 0);
  if (totalInstances > 1) {
    const f = findingFromCostRule('cost-multi-machine');
    if (f) findings.push(f);
  }
  if (Number(spec.deployment.expectedDurationMinutes) > 240) {
    const f = findingFromCostRule('cost-long-duration');
    if (f) findings.push(f);
  }

  const parameters =
    spec.compute.length > 0
      ? [
          {
            name: 'adminUsername',
            type: 'string' as const,
            description: 'Administrative username for the compute instance.',
            secure: false,
          },
          {
            name: 'adminAuthSecret',
            type: 'securestring' as const,
            description:
              'Administrative password or key material, supplied at deployment time. Never stored in the template.',
            secure: true,
          },
        ]
      : [];

  if (parameters.some((p) => p.secure)) {
    const f: ReviewFinding = {
      id: 'secure-input:adminAuthSecret',
      kind: 'security',
      severity: 'info',
      category: 'Secure input',
      description: 'Administrative credentials are declared as a secure parameter, not embedded.',
      recommendation: 'Supply the value at deployment time. Never commit secrets to the template.',
      evidence: evidenceRefFromId('safety-secure-input'),
    };
    findings.push(f);
  }

  return { provider, resources, parameters, outputs: [], findings };
}
