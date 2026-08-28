// Tests for learner instructions and validation checklist generators.

import { describe, it, expect } from 'vitest';
import { buildInternalModel } from '@/lib/normalise/normaliser';
import { generateLearnerInstructions } from '@/lib/instructions';
import { generateValidationChecklist } from '@/lib/checklist';
import { createEmptyLabSpecification } from '@/lib/model/factory';
import type { ComputeRequirement, LabSpecification, NetworkRequirement } from '@/types';

function azureSpec(): LabSpecification {
  const spec = createEmptyLabSpecification('azure');
  spec.metadata.projectName = 'Test Azure Lab';
  spec.metadata.labDuration = '90';
  spec.location.primaryRegion = 'eastus';
  spec.compute = [
    {
      id: 'c1',
      name: 'lab-vm',
      osFamily: 'linux',
      sizeId: 'Standard_B2s',
      count: 1,
      authMethod: 'ssh-public-key',
      publicIpRequested: false,
      dataDiskCount: 0,
      traceTo: [],
    } satisfies ComputeRequirement,
  ];
  spec.network = [
    {
      id: 'n1',
      name: 'lab-vnet',
      addressSpace: '10.0.0.0/16',
      subnetName: 'lab-subnet',
      subnetPrefix: '10.0.0.0/24',
      inboundRules: [
        { id: 'r1', port: 22, protocol: 'tcp', sourceCidr: '203.0.113.0/24', description: 'SSH' },
      ],
      traceTo: [],
    } satisfies NetworkRequirement,
  ];
  spec.learningPurpose.learnerTasks = [{ id: 'lt1', task: 'Connect to the VM and install nginx' }];
  spec.learningPurpose.outcomes = [{ id: 'o1', outcome: 'Deploy a Linux VM in Azure' }];
  return spec;
}

function awsSpec(): LabSpecification {
  const spec = createEmptyLabSpecification('aws');
  spec.metadata.projectName = 'Test AWS Lab';
  spec.location.primaryRegion = 'us-east-1';
  spec.compute = [
    {
      id: 'c1',
      name: 'lab-instance',
      osFamily: 'linux',
      sizeId: 't3.small',
      count: 1,
      authMethod: 'ssh-public-key',
      publicIpRequested: true,
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

describe('learner instructions generator', () => {
  it('produces Markdown with the project name as the title', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const md = generateLearnerInstructions(spec, model);
    expect(md).toContain('# Test Azure Lab — Learner Instructions');
  });

  it('includes the temporary environment warning', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const md = generateLearnerInstructions(spec, model);
    expect(md).toContain('Temporary environment warning');
  });

  it('lists provided resources from the internal model', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const md = generateLearnerInstructions(spec, model);
    expect(md).toContain('lab-vm');
    expect(md).toContain('Microsoft.Compute/virtualMachines');
  });

  it('includes region and size from the specification', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const md = generateLearnerInstructions(spec, model);
    expect(md).toContain('eastus');
    expect(md).toContain('Standard_B2s');
  });

  it('includes learner tasks and outcomes', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const md = generateLearnerInstructions(spec, model);
    expect(md).toContain('Connect to the VM and install nginx');
    expect(md).toContain('Deploy a Linux VM in Azure');
  });

  it('mentions SSM Session Manager for AWS private instances', () => {
    const spec = awsSpec();
    spec.compute[0].publicIpRequested = false;
    const model = buildInternalModel(spec);
    const md = generateLearnerInstructions(spec, model);
    expect(md).toContain('SSM');
  });

  it('is deterministic — identical input produces identical output', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const a = generateLearnerInstructions(spec, model);
    const b = generateLearnerInstructions(spec, model);
    expect(a).toBe(b);
  });
});

describe('validation checklist generator', () => {
  it('produces Markdown with the project name', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const cl = generateValidationChecklist(spec, model);
    expect(cl).toContain('# Deployment Validation Checklist');
    expect(cl).toContain('Test Azure Lab');
  });

  it('includes the non-production testing warning', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const cl = generateValidationChecklist(spec, model);
    expect(cl).toContain('not');
    expect(cl).toContain('penetration-tested');
  });

  it('lists all resources from the internal model', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const cl = generateValidationChecklist(spec, model);
    expect(cl).toContain('lab-vm');
    expect(cl).toContain('lab-vm-vnet');
  });

  it('includes ACP guidance for Azure', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const cl = generateValidationChecklist(spec, model);
    expect(cl).toContain('Azure ACP');
  });

  it('includes IAM guidance for AWS', () => {
    const spec = awsSpec();
    const model = buildInternalModel(spec);
    const cl = generateValidationChecklist(spec, model);
    expect(cl).toContain('IAM');
  });

  it('is deterministic', () => {
    const spec = azureSpec();
    const model = buildInternalModel(spec);
    const a = generateValidationChecklist(spec, model);
    const b = generateValidationChecklist(spec, model);
    expect(a).toBe(b);
  });
});
