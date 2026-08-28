// Azure Bicep generator — Development Brief §10.1.
//
// Deterministic, readable Bicep rendered from the InternalModel. Secure inputs
// use @secure() parameters; sensitive values are never embedded. Symbolic names
// are derived from logical ids.

import type { GeneratedResource, InternalModel, ParameterDef } from '@/types';
import type {
  AzureNicProps,
  AzureNsgProps,
  AzurePublicIpProps,
  AzureResourceProps,
  AzureStorageAccountProps,
  AzureVmProps,
  AzureVnetProps,
} from './types';

function symbol(logicalId: string): string {
  const s = logicalId.replace(/[^a-zA-Z0-9]/g, '_');
  return /^[0-9]/.test(s) ? `r_${s}` : s;
}

function azureProps(r: GeneratedResource): AzureResourceProps | undefined {
  const p = (r.properties as { azure?: AzureResourceProps }).azure;
  return p;
}

function paramType(p: ParameterDef): string {
  switch (p.type) {
    case 'int':
      return 'int';
    case 'bool':
      return 'bool';
    case 'array':
      return 'array';
    default:
      return 'string';
  }
}

function renderParam(p: ParameterDef): string {
  const lines: string[] = [];
  lines.push(`@description('${p.description.replace(/'/g, "\\'")}')`);
  if (p.secure) lines.push('@secure()');
  const def = p.defaultValue !== undefined && !p.secure ? ` = '${String(p.defaultValue)}'` : '';
  lines.push(`param ${p.name} ${paramType(p)}${def}`);
  return lines.join('\n');
}

function renderVnet(sym: string, p: AzureVnetProps): string {
  return `resource ${sym} 'Microsoft.Network/virtualNetworks@${p.apiVersion}' = {
  name: '${p.name}'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '${p.addressSpace}'
      ]
    }
    subnets: [
      {
        name: '${p.subnetName}'
        properties: {
          addressPrefix: '${p.subnetPrefix}'
          networkSecurityGroup: {
            id: ${symbol(p.nsgLogicalId)}.id
          }
        }
      }
    ]
  }
}`;
}

function renderNsg(sym: string, p: AzureNsgProps): string {
  const rules = p.securityRules
    .map(
      (rule) => `      {
        name: '${rule.name}'
        properties: {
          priority: ${rule.priority}
          direction: '${rule.direction}'
          access: '${rule.access}'
          protocol: '${rule.protocol}'
          sourcePortRange: '*'
          destinationPortRange: '${rule.destinationPortRange}'
          sourceAddressPrefix: '${rule.sourceAddressPrefix}'
          destinationAddressPrefix: '*'
        }
      }`,
    )
    .join('\n');
  const rulesBlock = p.securityRules.length ? `[\n${rules}\n    ]` : '[]';
  return `resource ${sym} 'Microsoft.Network/networkSecurityGroups@${p.apiVersion}' = {
  name: '${p.name}'
  location: location
  properties: {
    securityRules: ${rulesBlock}
  }
}`;
}

function renderPublicIp(sym: string, p: AzurePublicIpProps): string {
  return `resource ${sym} 'Microsoft.Network/publicIPAddresses@${p.apiVersion}' = {
  name: '${p.name}'
  location: location
  sku: {
    name: '${p.sku}'
  }
  properties: {
    publicIPAllocationMethod: '${p.allocationMethod}'
  }
}`;
}

function renderStorage(sym: string, p: AzureStorageAccountProps): string {
  return `resource ${sym} 'Microsoft.Storage/storageAccounts@${p.apiVersion}' = {
  name: '${p.name}'
  location: location
  sku: {
    name: '${p.sku}'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
  }
}`;
}

function renderNic(sym: string, p: AzureNicProps): string {
  const publicIpLine = p.publicIpLogicalId
    ? `\n          publicIPAddress: {
            id: ${symbol(p.publicIpLogicalId)}.id
          }`
    : '';
  return `resource ${sym} 'Microsoft.Network/networkInterfaces@${p.apiVersion}' = {
  name: '${p.name}'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: {
            id: '\${${symbol(p.vnetLogicalId)}.id}/subnets/${p.subnetName}'
          }
          privateIPAllocationMethod: 'Dynamic'${publicIpLine}
        }
      }
    ]
  }
}`;
}

function renderVm(sym: string, p: AzureVmProps): string {
  const img = p.imageReference;
  let osProfile: string;
  if (p.auth === 'ssh-public-key') {
    osProfile = `    osProfile: {
      computerName: '${p.computerName}'
      adminUsername: ${p.adminUsernameParam}
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/\${${p.adminUsernameParam}}/.ssh/authorized_keys'
              keyData: ${p.adminSecretParam}
            }
          ]
        }
      }${p.customDataBase64 ? `\n      customData: '${p.customDataBase64}'` : ''}
    }`;
  } else {
    osProfile = `    osProfile: {
      computerName: '${p.computerName}'
      adminUsername: ${p.adminUsernameParam}
      adminPassword: ${p.adminSecretParam}${p.customDataBase64 ? `\n      customData: '${p.customDataBase64}'` : ''}
    }`;
  }
  const diagnostics = p.bootDiagnosticsStorageLogicalId
    ? `\n    diagnosticsProfile: {
      bootDiagnostics: {
        enabled: true
        storageUri: ${symbol(p.bootDiagnosticsStorageLogicalId)}.properties.primaryEndpoints.blob
      }
    }`
    : '';
  return `resource ${sym} 'Microsoft.Compute/virtualMachines@${p.apiVersion}' = {
  name: '${p.name}'
  location: location
  properties: {
    hardwareProfile: {
      vmSize: '${p.size}'
    }
    storageProfile: {
      imageReference: {
        publisher: '${img.publisher}'
        offer: '${img.offer}'
        sku: '${img.sku}'
        version: '${img.version}'
      }
      osDisk: {
        createOption: 'FromImage'
        managedDisk: {
          storageAccountType: '${p.osDiskStorageAccountType}'
        }
      }
    }
${osProfile}
    networkProfile: {
      networkInterfaces: [
        {
          id: ${symbol(p.nicLogicalId)}.id
        }
      ]
    }${diagnostics}
  }
}`;
}

function renderResource(r: GeneratedResource): string | null {
  const p = azureProps(r);
  if (!p) return null;
  const sym = symbol(r.logicalId);
  switch (p.kind) {
    case 'vnet':
      return renderVnet(sym, p);
    case 'nsg':
      return renderNsg(sym, p);
    case 'publicIp':
      return renderPublicIp(sym, p);
    case 'storageAccount':
      return renderStorage(sym, p);
    case 'nic':
      return renderNic(sym, p);
    case 'vm':
      return renderVm(sym, p);
    case 'osDisk':
      return null; // intrinsic — part of the VM's storageProfile
  }
}

export function generateBicep(model: InternalModel): string {
  const header = [
    '// Generated by SoT Cloud Template Studio.',
    '// Design secure cloud lab infrastructure without writing templates from scratch.',
    '//',
    '// Every resource below is traceable to evidence in the review. This template',
    '// must be tested in a non-production environment before Skillable use.',
    '',
    "targetScope = 'resourceGroup'",
  ].join('\n');

  const params = model.parameters.map(renderParam).join('\n\n');

  const resources = model.resources
    .map(renderResource)
    .filter((s): s is string => s !== null)
    .join('\n\n');

  const outputs = model.outputs
    .map(
      (o) =>
        `@description('${o.description.replace(/'/g, "\\'")}')\noutput ${o.name} string = ${o.valueExpression}`,
    )
    .join('\n\n');

  const sections = [header, params, resources];
  if (outputs.trim()) sections.push(outputs);

  return (
    sections
      .map((s) => s.trimEnd())
      .filter((s) => s.length > 0)
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}
