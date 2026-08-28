import { describe, it, expect } from 'vitest';
import { buildInternalModel } from '@/lib/normalise/normaliser';
import { createEmptyLabSpecification } from '@/lib/model/factory';
import { generateBicep } from './bicep';
import { generateArmTemplate } from './arm';
import { generateAzureParametersJson } from './parameters';
import type { LabSpecification } from '@/types';

function privateLinuxVm(): LabSpecification {
  const spec = createEmptyLabSpecification('azure');
  spec.location.primaryRegion = 'uksouth';
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
    },
  ];
  spec.network = [
    {
      id: 'n1',
      name: 'lab-net',
      addressSpace: '10.10.0.0/16',
      subnetName: 'lab-subnet',
      subnetPrefix: '10.10.1.0/24',
      inboundRules: [],
      traceTo: [],
    },
  ];
  return spec;
}

function publicWindowsVm(): LabSpecification {
  const spec = createEmptyLabSpecification('azure');
  spec.location.primaryRegion = 'eastus';
  if (spec.providerConfig.kind === 'azure') {
    spec.providerConfig.azure.bootDiagnosticsEnabled = true;
  }
  spec.compute = [
    {
      id: 'c1',
      name: 'win-vm',
      osFamily: 'windows',
      sizeId: 'Standard_D2s_v5',
      count: 1,
      authMethod: 'password-prompt',
      publicIpRequested: true,
      dataDiskCount: 0,
      traceTo: [],
    },
  ];
  spec.network = [
    {
      id: 'n1',
      name: 'win-net',
      addressSpace: '10.20.0.0/16',
      subnetName: 'win-subnet',
      subnetPrefix: '10.20.1.0/24',
      inboundRules: [
        {
          id: 'r1',
          port: 3389,
          protocol: 'tcp',
          sourceCidr: '203.0.113.0/24',
          description: 'RDP from lab range',
        },
      ],
      traceTo: [],
    },
  ];
  return spec;
}

describe('Azure Bicep generator', () => {
  it('renders a deterministic, secure private Linux VM template', () => {
    const model = buildInternalModel(privateLinuxVm());
    const bicep = generateBicep(model);
    expect(bicep).toContain("targetScope = 'resourceGroup'");
    expect(bicep).toContain('@secure()');
    expect(bicep).toContain('param adminAuthSecret string');
    expect(bicep).toContain('Microsoft.Compute/virtualMachines@2024-07-01');
    expect(bicep).toContain('managedDisk');
    expect(bicep).toContain('disablePasswordAuthentication: true');
    // Private VM: no public IP resource.
    expect(bicep).not.toContain('publicIPAddresses');
    // No embedded secret literal — credentials come from the secure parameter.
    expect(bicep).toContain('keyData: adminAuthSecret');
    expect(bicep).toMatchSnapshot();
  });

  it('renders a public Windows VM with boot diagnostics and an NSG rule', () => {
    const model = buildInternalModel(publicWindowsVm());
    const bicep = generateBicep(model);
    expect(bicep).toContain('publicIPAddresses');
    expect(bicep).toContain('adminPassword: adminAuthSecret');
    expect(bicep).toContain('Microsoft.Storage/storageAccounts');
    expect(bicep).toContain("destinationPortRange: '3389'");
    expect(bicep).toContain('bootDiagnostics');
    expect(bicep).toMatchSnapshot();
  });

  it('is deterministic', () => {
    const a = generateBicep(buildInternalModel(privateLinuxVm()));
    const b = generateBicep(buildInternalModel(privateLinuxVm()));
    expect(a).toBe(b);
  });
});

describe('Azure ARM generator', () => {
  it('produces valid, parseable ARM JSON with a securestring parameter and no secret default', () => {
    const model = buildInternalModel(privateLinuxVm());
    const armText = generateArmTemplate(model);
    const arm = JSON.parse(armText);
    expect(arm.$schema).toContain('deploymentTemplate.json');
    expect(arm.parameters.adminAuthSecret.type).toBe('securestring');
    expect(arm.parameters.adminAuthSecret.defaultValue).toBeUndefined();
    for (const r of arm.resources) {
      expect(typeof r.apiVersion).toBe('string');
      expect(r.location).toBe("[parameters('location')]");
    }
    expect(armText).toMatchSnapshot();
  });

  it('does not create a public IP for a private VM', () => {
    const arm = JSON.parse(generateArmTemplate(buildInternalModel(privateLinuxVm())));
    expect(
      arm.resources.some((r: { type: string }) => r.type === 'Microsoft.Network/publicIPAddresses'),
    ).toBe(false);
  });
});

describe('Bicep / ARM equivalence (Development Brief §10.2)', () => {
  for (const [label, factory] of [
    ['private Linux VM', privateLinuxVm],
    ['public Windows VM', publicWindowsVm],
  ] as const) {
    it(`renders the same resource set in Bicep and ARM — ${label}`, () => {
      const model = buildInternalModel(factory());
      const bicep = generateBicep(model);
      const arm = JSON.parse(generateArmTemplate(model));

      // Every ARM resource must appear in the Bicep by type and name.
      for (const r of arm.resources as Array<{ type: string; name: string }>) {
        expect(bicep).toContain(`'${r.type}@`);
        expect(bicep).toContain(`name: '${r.name}'`);
      }
      // Same count of declared resources in both outputs.
      const bicepResourceCount = (bicep.match(/^resource /gm) ?? []).length;
      expect(bicepResourceCount).toBe(arm.resources.length);
    });
  }
});

describe('Azure parameters file', () => {
  it('emits secure parameters with an empty value (never a secret)', () => {
    const model = buildInternalModel(privateLinuxVm());
    const params = JSON.parse(generateAzureParametersJson(model));
    expect(params.parameters.adminAuthSecret.value).toBe('');
    expect(params.parameters.location.value).toBe('uksouth');
  });
});
