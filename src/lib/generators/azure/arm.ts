// Azure ARM JSON generator — Development Brief §10.2.
//
// IMPORTANT: this ARM template is generated INDEPENDENTLY from the same
// InternalModel as the Bicep output. It is NOT compiled from the displayed
// Bicep. Equivalence between the Bicep and ARM outputs is asserted by
// fixture-based tests (see arm.test.ts / bicep.test.ts).

import type { GeneratedResource, InternalModel, ParameterDef } from '@/types';
import { APP_INFO } from '@/lib/app-info';
import type {
  AzureAppServiceProps,
  AzureContainerInstanceProps,
  AzureFunctionProps,
  AzureManagedDiskProps,
  AzureManagedIdentityProps,
  AzureNicProps,
  AzureNsgProps,
  AzurePublicIpProps,
  AzureResourceProps,
  AzureStorageAccountProps,
  AzureVmProps,
  AzureVnetProps,
} from './types';

const ARM_TYPE = {
  vnet: 'Microsoft.Network/virtualNetworks',
  nsg: 'Microsoft.Network/networkSecurityGroups',
  publicIp: 'Microsoft.Network/publicIPAddresses',
  storageAccount: 'Microsoft.Storage/storageAccounts',
  nic: 'Microsoft.Network/networkInterfaces',
  vm: 'Microsoft.Compute/virtualMachines',
  managedDisk: 'Microsoft.Compute/disks',
  managedIdentity: 'Microsoft.ManagedIdentity/userAssignedIdentities',
  appService: 'Microsoft.Web/sites',
  functionApp: 'Microsoft.Web/sites',
  containerInstance: 'Microsoft.ContainerInstance/containerGroups',
} as const;

function azureProps(r: GeneratedResource): AzureResourceProps | undefined {
  return (r.properties as { azure?: AzureResourceProps }).azure;
}

/** Map logical ids to their ARM { type, name } for resourceId() references. */
function buildLookup(model: InternalModel): Map<string, { type: string; name: string }> {
  const map = new Map<string, { type: string; name: string }>();
  for (const r of model.resources) {
    const p = azureProps(r);
    if (!p || p.kind === 'osDisk') continue;
    map.set(r.logicalId, { type: ARM_TYPE[p.kind], name: p.name });
  }
  return map;
}

function resourceIdExpr(ref: { type: string; name: string }): string {
  return `resourceId('${ref.type}', '${ref.name}')`;
}

function armParameters(params: ParameterDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of params) {
    const type = p.type === 'securestring' ? 'securestring' : p.type;
    const entry: Record<string, unknown> = { type, metadata: { description: p.description } };
    if (p.defaultValue !== undefined && !p.secure) entry.defaultValue = p.defaultValue;
    out[p.name] = entry;
  }
  return out;
}

function vnetResource(
  p: AzureVnetProps,
  lookup: ReturnType<typeof buildLookup>,
  dependsOn: string[],
) {
  const nsg = lookup.get(p.nsgLogicalId);
  return {
    type: ARM_TYPE.vnet,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    dependsOn,
    properties: {
      addressSpace: { addressPrefixes: [p.addressSpace] },
      subnets: [
        {
          name: p.subnetName,
          properties: {
            addressPrefix: p.subnetPrefix,
            networkSecurityGroup: nsg ? { id: `[${resourceIdExpr(nsg)}]` } : undefined,
          },
        },
      ],
    },
  };
}

function nsgResource(p: AzureNsgProps) {
  return {
    type: ARM_TYPE.nsg,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    properties: {
      securityRules: p.securityRules.map((rule) => ({
        name: rule.name,
        properties: {
          priority: rule.priority,
          direction: rule.direction,
          access: rule.access,
          protocol: rule.protocol,
          sourcePortRange: '*',
          destinationPortRange: rule.destinationPortRange,
          sourceAddressPrefix: rule.sourceAddressPrefix,
          destinationAddressPrefix: '*',
        },
      })),
    },
  };
}

function publicIpResource(p: AzurePublicIpProps) {
  return {
    type: ARM_TYPE.publicIp,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    sku: { name: p.sku },
    properties: { publicIPAllocationMethod: p.allocationMethod },
  };
}

function storageResource(p: AzureStorageAccountProps) {
  return {
    type: ARM_TYPE.storageAccount,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    sku: { name: p.sku },
    kind: 'StorageV2',
    properties: { allowBlobPublicAccess: p.allowBlobPublicAccess, minimumTlsVersion: 'TLS1_2' },
  };
}

function managedDiskResource(p: AzureManagedDiskProps) {
  return {
    type: ARM_TYPE.managedDisk,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    sku: { name: p.sku },
    properties: { creationData: { createOption: 'Empty' }, diskSizeGB: p.diskSizeGb },
  };
}

function managedIdentityResource(p: AzureManagedIdentityProps) {
  return {
    type: ARM_TYPE.managedIdentity,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
  };
}

function appServiceResource(p: AzureAppServiceProps) {
  return {
    type: ARM_TYPE.appService,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    properties: {
      siteConfig: { linuxFxVersion: `${p.runtime}|${p.imageRef}` },
      appSettings: p.environmentVariables.map((e) => ({ name: e.key, value: e.value })),
    },
  };
}

function functionAppResource(p: AzureFunctionProps) {
  return {
    type: ARM_TYPE.functionApp,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    kind: 'functionApp',
    properties: {
      siteConfig: { linuxFxVersion: p.runtime },
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: p.runtime },
        ...p.environmentVariables.map((e) => ({ name: e.key, value: e.value })),
      ],
    },
  };
}

function containerInstanceResource(p: AzureContainerInstanceProps) {
  return {
    type: ARM_TYPE.containerInstance,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    properties: {
      osType: 'Linux',
      containers: [
        {
          name: p.name,
          properties: {
            image: p.image,
            resources: { requests: { cpu: p.cpuCores, memoryInGB: p.memoryGb } },
            ports: [{ port: p.port, protocol: 'TCP' }],
            environmentVariables: p.environmentVariables.map((e) => ({
              name: e.key,
              value: e.value,
            })),
          },
        },
      ],
      ipAddress: {
        type: p.publicEndpointRequested ? 'Public' : 'Private',
        ports: [{ port: p.port, protocol: 'TCP' }],
      },
    },
  };
}

function nicResource(
  p: AzureNicProps,
  lookup: ReturnType<typeof buildLookup>,
  dependsOn: string[],
) {
  const vnet = lookup.get(p.vnetLogicalId);
  const pip = p.publicIpLogicalId ? lookup.get(p.publicIpLogicalId) : null;
  return {
    type: ARM_TYPE.nic,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    dependsOn,
    properties: {
      ipConfigurations: [
        {
          name: 'ipconfig1',
          properties: {
            subnet: vnet
              ? { id: `[concat(${resourceIdExpr(vnet)}, '/subnets/${p.subnetName}')]` }
              : undefined,
            privateIPAllocationMethod: 'Dynamic',
            publicIPAddress: pip ? { id: `[${resourceIdExpr(pip)}]` } : undefined,
          },
        },
      ],
    },
  };
}

function vmResource(p: AzureVmProps, lookup: ReturnType<typeof buildLookup>, dependsOn: string[]) {
  const nic = lookup.get(p.nicLogicalId);
  const storage = p.bootDiagnosticsStorageLogicalId
    ? lookup.get(p.bootDiagnosticsStorageLogicalId)
    : null;

  const osProfile: Record<string, unknown> = {
    computerName: p.computerName,
    adminUsername: `[parameters('${p.adminUsernameParam}')]`,
  };
  if (p.auth === 'ssh-public-key') {
    osProfile.linuxConfiguration = {
      disablePasswordAuthentication: true,
      ssh: {
        publicKeys: [
          {
            path: `[format('/home/{0}/.ssh/authorized_keys', parameters('${p.adminUsernameParam}'))]`,
            keyData: `[parameters('${p.adminSecretParam}')]`,
          },
        ],
      },
    };
  } else {
    osProfile.adminPassword = `[parameters('${p.adminSecretParam}')]`;
  }
  if (p.customDataBase64) osProfile.customData = p.customDataBase64;

  const properties: Record<string, unknown> = {
    hardwareProfile: { vmSize: p.size },
    storageProfile: {
      imageReference: {
        publisher: p.imageReference.publisher,
        offer: p.imageReference.offer,
        sku: p.imageReference.sku,
        version: p.imageReference.version,
      },
      osDisk: {
        createOption: 'FromImage',
        managedDisk: { storageAccountType: p.osDiskStorageAccountType },
      },
    },
    osProfile,
    networkProfile: {
      networkInterfaces: nic ? [{ id: `[${resourceIdExpr(nic)}]` }] : [],
    },
  };
  if (storage) {
    properties.diagnosticsProfile = {
      bootDiagnostics: {
        enabled: true,
        storageUri: `[reference(${resourceIdExpr(storage)}).primaryEndpoints.blob]`,
      },
    };
  }

  return {
    type: ARM_TYPE.vm,
    apiVersion: p.apiVersion,
    name: p.name,
    location: "[parameters('location')]",
    dependsOn,
    properties,
  };
}

function armResource(
  r: GeneratedResource,
  lookup: ReturnType<typeof buildLookup>,
): Record<string, unknown> | null {
  const p = azureProps(r);
  if (!p || p.kind === 'osDisk') return null;
  const dependsOn = r.dependsOn
    .map((id) => lookup.get(id))
    .filter((x): x is { type: string; name: string } => Boolean(x))
    .map((ref) => `[${resourceIdExpr(ref)}]`);
  switch (p.kind) {
    case 'vnet':
      return vnetResource(p, lookup, dependsOn);
    case 'nsg':
      return nsgResource(p);
    case 'publicIp':
      return publicIpResource(p);
    case 'storageAccount':
      return storageResource(p);
    case 'nic':
      return nicResource(p, lookup, dependsOn);
    case 'vm':
      return vmResource(p, lookup, dependsOn);
    case 'managedDisk':
      return managedDiskResource(p);
    case 'managedIdentity':
      return managedIdentityResource(p);
    case 'appService':
      return appServiceResource(p);
    case 'functionApp':
      return functionAppResource(p);
    case 'containerInstance':
      return containerInstanceResource(p);
  }
}

function armOutputValue(valueExpression: string): string {
  const t = valueExpression.trim();
  if (/^'.*'$/.test(t)) return t.slice(1, -1);
  return `[${t}]`;
}

export function generateArmTemplate(model: InternalModel, fragments: string[] = []): string {
  const lookup = buildLookup(model);
  const resources = model.resources
    .map((r) => armResource(r, lookup))
    .filter((r): r is Record<string, unknown> => r !== null);

  const outputs: Record<string, unknown> = {};
  for (const o of model.outputs) {
    outputs[o.name] = { type: 'string', value: armOutputValue(o.valueExpression) };
  }

  const template: Record<string, unknown> = {
    $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
    contentVersion: '1.0.0.0',
    metadata: {
      _generator: { name: APP_INFO.name, version: APP_INFO.version },
      _note:
        'Generated independently from the InternalModel (not compiled from Bicep). Test in a non-production environment before Skillable use.',
    },
    parameters: armParameters(model.parameters),
    resources,
    outputs,
  };

  // Phase 6: Inject custom fragments (Classification F) with boundary markers.
  // Fragments are expected to be ARM JSON resource objects. They are parsed and
  // added to the resources array with a _classification marker.
  if (fragments.length > 0) {
    const fragmentResources: Record<string, unknown>[] = [];
    for (let i = 0; i < fragments.length; i++) {
      const frag = fragments[i].trim();
      try {
        const parsed = JSON.parse(frag);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            fragmentResources.push({
              ...item,
              _classification: 'F',
              _fragmentIndex: i + 1,
              _warning: 'User-supplied custom fragment — requires manual review',
            });
          }
        } else {
          fragmentResources.push({
            ...parsed,
            _classification: 'F',
            _fragmentIndex: i + 1,
            _warning: 'User-supplied custom fragment — requires manual review',
          });
        }
      } catch {
        // Non-JSON fragments are noted in metadata but not injected as resources.
        fragmentResources.push({
          _classification: 'F',
          _fragmentIndex: i + 1,
          _error: 'Fragment is not valid JSON and was not injected as a resource',
        });
      }
    }
    (template.resources as Record<string, unknown>[]).push(...fragmentResources);
  }

  return JSON.stringify(template, null, 2) + '\n';
}
