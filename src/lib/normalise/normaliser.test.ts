import { describe, it, expect } from 'vitest';
import { buildInternalModel } from './normaliser';
import { createEmptyLabSpecification } from '@/lib/model/factory';
import type { ComputeRequirement, LabSpecification } from '@/types';

function azureVmSpec(overrides: Partial<ComputeRequirement> = {}): LabSpecification {
  const spec = createEmptyLabSpecification('azure');
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
      ...overrides,
    },
  ];
  return spec;
}

function awsEc2Spec(overrides: Partial<ComputeRequirement> = {}): LabSpecification {
  const spec = createEmptyLabSpecification('aws');
  spec.compute = [
    {
      id: 'c1',
      name: 'lab-ec2',
      osFamily: 'linux',
      sizeId: 't3.small',
      count: 1,
      authMethod: 'platform-managed',
      publicIpRequested: false,
      dataDiskCount: 0,
      traceTo: [],
      ...overrides,
    },
  ];
  return spec;
}

describe('normaliser — Azure VM', () => {
  it('produces a virtual machine as the primary resource', () => {
    const model = buildInternalModel(azureVmSpec());
    expect(model.provider).toBe('azure');
    const primary = model.resources.find((r) => r.origin === 'user');
    expect(primary?.providerResourceType).toBe('Microsoft.Compute/virtualMachines');
  });

  it('includes a managed OS disk that is NOT a Storage Account (managed-disk lesson)', () => {
    const model = buildInternalModel(azureVmSpec());
    const disk = model.resources.find(
      (r) => r.properties.dependencyIdentifier === 'azure-vm-osdisk',
    );
    expect(disk).toBeDefined();
    expect(disk?.autoIncluded).toBe(true);
    expect(disk?.providerResourceType.toLowerCase()).toContain('managed disk');
    // The managed disk must never be represented as a Storage Account.
    expect(disk?.providerResourceType).not.toContain('Microsoft.Storage/storageAccounts');
  });

  it('auto-includes NIC, VNet and NSG as required dependencies', () => {
    const model = buildInternalModel(azureVmSpec());
    const ids = model.resources.map((r) => r.properties.dependencyIdentifier);
    expect(ids).toContain('azure-nic');
    expect(ids).toContain('azure-vnet');
    expect(ids).toContain('azure-nsg');
  });

  it('does NOT create a public IP unless explicitly requested (never silent)', () => {
    const priv = buildInternalModel(azureVmSpec({ publicIpRequested: false }));
    expect(
      priv.resources.some((r) => r.properties.dependencyIdentifier === 'azure-public-ip'),
    ).toBe(false);

    const pub = buildInternalModel(azureVmSpec({ publicIpRequested: true }));
    expect(pub.resources.some((r) => r.properties.dependencyIdentifier === 'azure-public-ip')).toBe(
      true,
    );
    expect(pub.findings.some((f) => f.category === 'Public exposure')).toBe(true);
  });

  it('does not auto-include boot-diagnostics storage unless enabled', () => {
    const model = buildInternalModel(azureVmSpec());
    expect(
      model.resources.some(
        (r) => r.properties.dependencyIdentifier === 'azure-diagnostics-storage',
      ),
    ).toBe(false);
  });

  it('flags GPU / oversized compute as a cost finding', () => {
    const model = buildInternalModel(azureVmSpec({ sizeId: 'Standard_NC4as_T4_v3' }));
    expect(model.findings.some((f) => f.kind === 'cost' && f.category.includes('GPU'))).toBe(true);
  });

  it('declares admin credentials as a secure parameter, never embedded', () => {
    const model = buildInternalModel(azureVmSpec());
    const secure = model.parameters.find((p) => p.secure);
    expect(secure?.name).toBe('adminAuthSecret');
    expect(secure?.type).toBe('securestring');
  });
});

describe('normaliser — AWS EC2', () => {
  it('produces an EC2 instance with VPC, subnet, security group and root EBS volume', () => {
    const model = buildInternalModel(awsEc2Spec());
    expect(model.provider).toBe('aws');
    const primary = model.resources.find((r) => r.origin === 'user');
    expect(primary?.providerResourceType).toBe('AWS::EC2::Instance');
    const ids = model.resources.map((r) => r.properties.dependencyIdentifier);
    expect(ids).toContain('aws-vpc');
    expect(ids).toContain('aws-subnet');
    expect(ids).toContain('aws-security-group');
    expect(ids).toContain('aws-ebs-root');
  });

  it('does not create an internet gateway/route unless public access requested', () => {
    const priv = buildInternalModel(awsEc2Spec({ publicIpRequested: false }));
    expect(
      priv.resources.some((r) => r.properties.dependencyIdentifier === 'aws-internet-gateway'),
    ).toBe(false);

    const pub = buildInternalModel(awsEc2Spec({ publicIpRequested: true }));
    const ids = pub.resources.map((r) => r.properties.dependencyIdentifier);
    expect(ids).toContain('aws-internet-gateway');
    expect(ids).toContain('aws-route-table');
  });
});

describe('normaliser — provider separation (no cross-provider leakage)', () => {
  it('Azure output never contains AWS resource types', () => {
    const model = buildInternalModel(azureVmSpec());
    const blob = JSON.stringify(model);
    expect(blob).not.toContain('AWS::');
  });

  it('AWS output never contains Azure resource types', () => {
    const model = buildInternalModel(awsEc2Spec());
    const blob = JSON.stringify(model);
    expect(blob).not.toContain('Microsoft.');
  });
});

describe('normaliser — deterministic output', () => {
  it('produces identical models for identical input', () => {
    const a = buildInternalModel(azureVmSpec());
    const b = buildInternalModel(azureVmSpec());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
