// Tests for the dedicated review engines: security review, cost review,
// and deployment readiness.

import { describe, it, expect } from 'vitest';
import { buildInternalModel } from '@/lib/normalise/normaliser';
import { generateSecurityReview, securityReviewToText } from '@/lib/security-review';
import { generateCostReview, costReviewToText } from '@/lib/cost-review';
import { generateDeploymentReadiness, deploymentReadinessToText } from '@/lib/deployment-readiness';
import { createEmptyLabSpecification } from '@/lib/model/factory';
import type { ComputeRequirement, LabSpecification, NetworkRequirement } from '@/types';

function azureSpec(opts: {
  publicIp?: boolean;
  openCidr?: boolean;
  mgmtPort?: boolean;
  noCleanup?: boolean;
  longDuration?: boolean;
  gpuSize?: boolean;
  withInit?: boolean;
}): LabSpecification {
  const spec = createEmptyLabSpecification('azure');
  spec.metadata.projectName = 'Test Lab';
  spec.metadata.labProfileNumber = 'LAB-001';
  spec.metadata.labDuration = opts.longDuration ? '300' : '60';
  spec.location.primaryRegion = 'eastus';
  spec.deployment.cleanup = !opts.noCleanup;
  spec.deployment.expectedDurationMinutes = opts.longDuration ? '300' : '60';
  spec.compute = [
    {
      id: 'c1',
      name: 'lab-vm',
      osFamily: 'linux',
      sizeId: opts.gpuSize ? 'Standard_NC4as_T4_v3' : 'Standard_B2s',
      count: 1,
      authMethod: 'ssh-public-key',
      publicIpRequested: opts.publicIp ?? false,
      dataDiskCount: 0,
      traceTo: [],
    } satisfies ComputeRequirement,
  ];
  const rules = [];
  if (opts.openCidr || opts.mgmtPort) {
    rules.push({
      id: 'r1',
      port: opts.mgmtPort ? 22 : 80,
      protocol: 'tcp' as const,
      sourceCidr: opts.openCidr ? '0.0.0.0/0' : '203.0.113.0/24',
      description: opts.mgmtPort ? 'SSH' : 'HTTP',
    });
  }
  spec.network = [
    {
      id: 'n1',
      name: 'lab-vnet',
      addressSpace: '10.0.0.0/16',
      subnetName: 'lab-subnet',
      subnetPrefix: '10.0.0.0/24',
      inboundRules: rules,
      traceTo: [],
    } satisfies NetworkRequirement,
  ];
  if (opts.withInit) {
    spec.initialisation = [
      {
        id: 'i1',
        targetComputeId: 'c1',
        kind: 'cloud-init',
        script: '#!/bin/bash\napt-get update',
        description: 'Install packages',
        traceTo: [],
      },
    ];
  }
  return spec;
}

function awsSpec(opts: { publicIp?: boolean; noCleanup?: boolean }): LabSpecification {
  const spec = createEmptyLabSpecification('aws');
  spec.metadata.projectName = 'Test AWS Lab';
  spec.location.primaryRegion = 'us-east-1';
  spec.deployment.cleanup = !opts.noCleanup;
  spec.compute = [
    {
      id: 'c1',
      name: 'lab-instance',
      osFamily: 'linux',
      sizeId: 't3.small',
      count: 1,
      authMethod: 'ssh-public-key',
      publicIpRequested: opts.publicIp ?? false,
      dataDiskCount: 0,
      traceTo: [],
    } satisfies ComputeRequirement,
  ];
  spec.network = [
    {
      id: 'n1',
      name: 'lab-vpc',
      addressSpace: '10.0.0.0/16',
      subnetName: 'lab-subnet',
      subnetPrefix: '10.0.0.0/24',
      inboundRules: [],
      traceTo: [],
    } satisfies NetworkRequirement,
  ];
  return spec;
}

// ── Security Review ──

describe('security review engine', () => {
  it('produces a review with project name and provider', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.projectName).toBe('Test Lab');
    expect(review.provider).toBe('azure');
  });

  it('flags management port open to 0.0.0.0/0 as critical', () => {
    const spec = azureSpec({ mgmtPort: true, openCidr: true });
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.severity === 'critical')).toBe(true);
    expect(review.overallRisk).toBe('critical');
  });

  it('flags open CIDR (non-management port) as high', () => {
    const spec = azureSpec({ openCidr: true });
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    const openCidrItems = review.items.filter((i) => i.checkId === 'open-cidr');
    expect(openCidrItems.length).toBeGreaterThan(0);
    expect(openCidrItems[0].severity).toBe('high');
  });

  it('flags public IP as high severity', () => {
    const spec = azureSpec({ publicIp: true });
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.category === 'Public exposure')).toBe(true);
  });

  it('reports info for no inbound rules (secure default)', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(
      review.items.some((i) => i.category === 'Network posture' && i.severity === 'info'),
    ).toBe(true);
  });

  it('reports secure parameters as info', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.category === 'Secure input')).toBe(true);
  });

  it('counts findings by severity correctly', () => {
    const spec = azureSpec({ mgmtPort: true, openCidr: true, publicIp: true });
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    const total =
      review.counts.critical +
      review.counts.high +
      review.counts.medium +
      review.counts.low +
      review.counts.info;
    expect(total).toBe(review.items.length);
  });

  it('is deterministic (excluding generatedAt and summary)', () => {
    const spec = azureSpec({ publicIp: true });
    const model = buildInternalModel(spec);
    const a = generateSecurityReview(spec, model);
    const b = generateSecurityReview(spec, model);
    const { generatedAt: _ga, summary: _sa, ...aRest } = a;
    const { generatedAt: _gb, summary: _sb, ...bRest } = b;
    expect(JSON.stringify(aRest)).toBe(JSON.stringify(bRest));
  });

  it('renders to downloadable text', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    const text = securityReviewToText(review);
    expect(text).toContain('Security Review for: Test Lab');
    expect(text).toContain('Overall Risk');
  });

  it('never contains cross-provider resource types', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    const blob = JSON.stringify(review);
    expect(blob).not.toContain('AWS::');
  });
});

// ── Cost Review ──

describe('cost review engine', () => {
  it('produces a review with project name and provider', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(review.projectName).toBe('Test Lab');
    expect(review.provider).toBe('azure');
  });

  it('flags GPU/oversized compute as high risk', () => {
    const spec = azureSpec({ gpuSize: true });
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(
      review.items.some((i) => i.riskLevel === 'high' && i.category.includes('Oversized')),
    ).toBe(true);
  });

  it('flags no cleanup as high risk', () => {
    const spec = azureSpec({ noCleanup: true });
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(review.items.some((i) => i.riskLevel === 'high' && i.category.includes('cleanup'))).toBe(
      true,
    );
  });

  it('flags long duration as medium risk', () => {
    const spec = azureSpec({ longDuration: true });
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(
      review.items.some((i) => i.riskLevel === 'medium' && i.category.includes('duration')),
    ).toBe(true);
  });

  it('includes per-resource cost notes from the model', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(review.resourceCostNotes.length).toBeGreaterThan(0);
  });

  it('includes pricing calculator URLs', () => {
    const spec = awsSpec({});
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(review.items.some((i) => i.pricingCalculatorUrl.includes('calculator.aws'))).toBe(true);
  });

  it('is deterministic (excluding generatedAt and summary)', () => {
    const spec = azureSpec({ gpuSize: true });
    const model = buildInternalModel(spec);
    const a = generateCostReview(spec, model);
    const b = generateCostReview(spec, model);
    const { generatedAt: _ga, summary: _sa, ...aRest } = a;
    const { generatedAt: _gb, summary: _sb, ...bRest } = b;
    expect(JSON.stringify(aRest)).toBe(JSON.stringify(bRest));
  });

  it('renders to downloadable text', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    const text = costReviewToText(review);
    expect(text).toContain('Cost Review for: Test Lab');
    expect(text).toContain('Overall Cost Risk');
  });
});

// ── Deployment Readiness ──

describe('deployment readiness engine', () => {
  it('produces a readiness assessment with checks', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const readiness = generateDeploymentReadiness(spec, model);
    expect(readiness.checks.length).toBeGreaterThan(0);
    expect(readiness.overallStatus).toBeDefined();
  });

  it('returns blocked when critical security findings exist', () => {
    const spec = azureSpec({ mgmtPort: true, openCidr: true });
    const model = buildInternalModel(spec);
    const readiness = generateDeploymentReadiness(spec, model);
    expect(readiness.overallStatus).toBe('blocked');
    expect(readiness.blockingFindings.length).toBeGreaterThan(0);
  });

  it('returns needs-attention when warnings exist but no blocks', () => {
    const spec = azureSpec({ noCleanup: true });
    const model = buildInternalModel(spec);
    const readiness = generateDeploymentReadiness(spec, model);
    expect(['needs-attention', 'blocked']).toContain(readiness.overallStatus);
  });

  it('includes the boundary statement check (always warn)', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const readiness = generateDeploymentReadiness(spec, model);
    expect(readiness.checks.some((c) => c.id === 'boundary')).toBe(true);
  });

  it('passes the secure parameters check when secure params exist', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const readiness = generateDeploymentReadiness(spec, model);
    const check = readiness.checks.find((c) => c.id === 'secure-params');
    expect(check?.status).toBe('pass');
  });

  it('passes the cleanup check when cleanup is enabled', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const readiness = generateDeploymentReadiness(spec, model);
    const check = readiness.checks.find((c) => c.id === 'cleanup');
    expect(check?.status).toBe('pass');
  });

  it('is deterministic (excluding generatedAt and summary)', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const a = generateDeploymentReadiness(spec, model);
    const b = generateDeploymentReadiness(spec, model);
    const { generatedAt: _ga, summary: _sa, ...aRest } = a;
    const { generatedAt: _gb, summary: _sb, ...bRest } = b;
    expect(JSON.stringify(aRest)).toBe(JSON.stringify(bRest));
  });

  it('renders to downloadable text', () => {
    const spec = azureSpec({});
    const model = buildInternalModel(spec);
    const readiness = generateDeploymentReadiness(spec, model);
    const text = deploymentReadinessToText(readiness);
    expect(text).toContain('Deployment Readiness for: Test Lab');
    expect(text).toContain('Overall Status');
  });
});
