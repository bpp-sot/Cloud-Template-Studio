// Azure internal-model builder — Development Brief §10.1, §10.4.
//
// Produces a fully-propertied, provider-specific InternalModel for Azure from a
// LabSpecification. Inclusion decisions and evidence come from the data-driven
// dependency engine; concrete resource configuration is attached under
// properties.azure for the Bicep and ARM generators to render identically.

import type {
  ComputeRequirement,
  EvidenceReference,
  GeneratedResource,
  InternalModel,
  LabSpecification,
  NetworkRequirement,
  OutputDef,
  ParameterDef,
  ReviewFinding,
} from '@/types';
import { findComputeSize, findResource, findAzureImage } from '@/lib/data';
import { evidenceRefFromId, resolveDependencies } from './dependencies';
import { findingFromCostRule, findingFromSecurityRule } from './findings';
import type {
  AzureAppServiceProps,
  AzureContainerInstanceProps,
  AzureFunctionProps,
  AzureImageReference,
  AzureManagedDiskProps,
  AzureManagedIdentityProps,
  AzureNsgSecurityRule,
  AzureResourceProps,
  AzureStorageAccountProps,
} from '@/lib/generators/azure/types';

const API = {
  vnet: '2023-11-01',
  nsg: '2023-11-01',
  publicIp: '2023-11-01',
  nic: '2023-11-01',
  vm: '2024-07-01',
  storage: '2023-05-01',
  disk: '2023-10-02',
  identity: '2023-07-31-preview',
  web: '2023-12-01',
  containerInstance: '2023-05-01',
} as const;

const ADMIN_USERNAME_PARAM = 'adminUsername';
const ADMIN_SECRET_PARAM = 'adminAuthSecret';
const LOCATION_PARAM = 'location';

function appDefaultEvidence(rationale: string): EvidenceReference {
  return {
    classification: 'E',
    sourceTitle: 'Application-generated default',
    sourcePath: null,
    sourceUrl: null,
    rationale,
    provenance: 'application-generated',
    confidence: 'medium',
    schemaOrApiVersion: null,
  };
}

function defaultImage(osFamily: 'linux' | 'windows'): AzureImageReference {
  return osFamily === 'linux'
    ? {
        publisher: 'Canonical',
        offer: '0001-com-ubuntu-server-jammy',
        sku: '22_04-lts-gen2',
        version: 'latest',
      }
    : {
        publisher: 'MicrosoftWindowsServer',
        offer: 'WindowsServer',
        sku: '2022-datacenter-azure-edition',
        version: 'latest',
      };
}

function nsgRulesFromNetwork(net: NetworkRequirement | undefined): AzureNsgSecurityRule[] {
  if (!net) return [];
  return net.inboundRules.map((rule, i) => ({
    name: `allow-${rule.protocol}-${rule.port}`,
    priority: 1000 + i * 10,
    direction: 'Inbound' as const,
    access: 'Allow' as const,
    protocol: rule.protocol === 'tcp' ? ('Tcp' as const) : ('Udp' as const),
    destinationPortRange: String(rule.port),
    sourceAddressPrefix: rule.sourceCidr,
  }));
}

function base64(text: string): string {
  if (typeof btoa === 'function') return btoa(text);
  return Buffer.from(text, 'utf-8').toString('base64');
}

interface BuiltCompute {
  resources: GeneratedResource[];
  findings: ReviewFinding[];
  outputs: OutputDef[];
}

function buildCompute(
  compute: ComputeRequirement,
  index: number,
  spec: LabSpecification,
): BuiltCompute {
  const resources: GeneratedResource[] = [];
  const findings: ReviewFinding[] = [];
  const outputs: OutputDef[] = [];

  const catalogue = findResource('azure', 'azure-vm');
  if (!catalogue) throw new Error('Missing Azure VM catalogue entry (azure-vm).');

  const baseId = compute.name || `azure-compute-${index + 1}`;
  const size = findComputeSize('azure', compute.sizeId);
  const net = spec.network[index] ?? spec.network[0];
  const addressSpace = net?.addressSpace || '10.0.0.0/16';
  const subnetPrefix = net?.subnetPrefix || '10.0.0.0/24';
  const subnetName = net?.subnetName || `${baseId}-subnet`;

  const azureCfg = spec.providerConfig.kind === 'azure' ? spec.providerConfig.azure : null;
  const bootDiagnostics = azureCfg?.bootDiagnosticsEnabled ?? false;
  // Resolve image: explicit imageReference > imageId from catalogue > default.
  const catalogueImage = azureCfg?.imageId ? findAzureImage(azureCfg.imageId) : null;
  const image =
    azureCfg?.imageReference ??
    (catalogueImage
      ? {
          publisher: catalogueImage.publisher,
          offer: catalogueImage.offer,
          sku: catalogueImage.sku,
          version: catalogueImage.version,
        }
      : defaultImage(compute.osFamily));
  const usingDefaultImage = !azureCfg?.imageReference && !catalogueImage;

  const optedIn = new Set<string>();
  if (compute.publicIpRequested) optedIn.add('azure-public-ip');
  if (bootDiagnostics) optedIn.add('azure-diagnostics-storage');
  const resolved = resolveDependencies(catalogue, optedIn);
  const isIncluded = (id: string) => resolved.find((r) => r.dependency.identifier === id)?.included;
  const depEvidence = (id: string): EvidenceReference =>
    resolved.find((r) => r.dependency.identifier === id)?.evidence ??
    evidenceRefFromId('safety-secure-input');

  const vnetId = `${baseId}-vnet`;
  const nsgId = `${baseId}-nsg`;
  const pipId = `${baseId}-pip`;
  const nicId = `${baseId}-nic`;
  const storageId = `${baseId}-diag`;

  const auth: 'ssh-public-key' | 'password' =
    compute.osFamily === 'linux' && compute.authMethod === 'ssh-public-key'
      ? 'ssh-public-key'
      : 'password';

  const osDiskType = String(
    catalogue.defaults.osDiskManagedDiskStorageAccountType ?? 'StandardSSD_LRS',
  );

  // Initialisation (cloud-init) targeting this VM → customData.
  const initScript = spec.initialisation.find(
    (i) =>
      i.targetComputeId === compute.id && (i.kind === 'cloud-init' || i.kind === 'aws-user-data'),
  );
  const customDataBase64 = initScript ? base64(initScript.script) : null;

  // ── Network security group ──
  resources.push({
    logicalId: nsgId,
    providerResourceType: 'Microsoft.Network/networkSecurityGroups',
    purpose:
      'Network security group attached to the subnet. Denies inbound traffic unless an explicit rule is added.',
    origin: 'safety-recommended',
    autoIncluded: true,
    dependsOn: [],
    evidence: [depEvidence('azure-nsg')],
    apiVersionOrSpec: API.nsg,
    securityNotes: ['Default posture denies inbound internet traffic; rules are opt-in.'],
    costNotes: ['No direct charge.'],
    warnings: [],
    properties: {
      dependencyIdentifier: 'azure-nsg',
      forCompute: baseId,
      azure: {
        kind: 'nsg',
        name: nsgId,
        apiVersion: API.nsg,
        securityRules: nsgRulesFromNetwork(net),
      } satisfies AzureResourceProps,
    },
  });

  // ── Virtual network + subnet ──
  resources.push({
    logicalId: vnetId,
    providerResourceType: 'Microsoft.Network/virtualNetworks',
    purpose: 'Virtual network and subnet providing the private address space for the VM.',
    origin: 'provider-required',
    autoIncluded: true,
    dependsOn: [nsgId],
    evidence: [depEvidence('azure-vnet')],
    apiVersionOrSpec: API.vnet,
    securityNotes: ['Private network boundary; no inbound internet access by default.'],
    costNotes: ['No direct charge.'],
    warnings: [],
    properties: {
      dependencyIdentifier: 'azure-vnet',
      forCompute: baseId,
      azure: {
        kind: 'vnet',
        name: vnetId,
        apiVersion: API.vnet,
        addressSpace,
        subnetName,
        subnetPrefix,
        nsgLogicalId: nsgId,
      } satisfies AzureResourceProps,
    },
  });

  // ── Optional public IP (opt-in only) ──
  if (isIncluded('azure-public-ip')) {
    resources.push({
      logicalId: pipId,
      providerResourceType: 'Microsoft.Network/publicIPAddresses',
      purpose:
        'Public IP address explicitly requested to expose the VM to inbound internet access.',
      origin: 'user',
      autoIncluded: false,
      dependsOn: [],
      evidence: [depEvidence('azure-public-ip')],
      apiVersionOrSpec: API.publicIp,
      securityNotes: ['Exposes the VM to the public internet; restrict inbound rules.'],
      costNotes: ['Standard public IPv4 incurs an hourly charge.'],
      warnings: [],
      properties: {
        dependencyIdentifier: 'azure-public-ip',
        forCompute: baseId,
        azure: {
          kind: 'publicIp',
          name: pipId,
          apiVersion: API.publicIp,
          sku: 'Standard',
          allocationMethod: 'Static',
        } satisfies AzureResourceProps,
      },
    });
  }

  // ── Optional boot-diagnostics storage account (opt-in only) ──
  if (isIncluded('azure-diagnostics-storage')) {
    resources.push({
      logicalId: storageId,
      providerResourceType: 'Microsoft.Storage/storageAccounts (boot diagnostics)',
      purpose:
        'Storage Account for VM boot diagnostics (explicitly enabled). This is NOT a managed disk.',
      origin: 'user',
      autoIncluded: false,
      dependsOn: [],
      evidence: [depEvidence('azure-diagnostics-storage')],
      apiVersionOrSpec: API.storage,
      securityNotes: ['Should not be publicly accessible.'],
      costNotes: ['Incurs Storage Account transaction and capacity charges.'],
      warnings: [],
      properties: {
        dependencyIdentifier: 'azure-diagnostics-storage',
        forCompute: baseId,
        azure: {
          kind: 'storageAccount',
          name: `${baseId
            .replace(/[^a-z0-9]/gi, '')
            .toLowerCase()
            .slice(0, 18)}diag`,
          apiVersion: API.storage,
          sku: 'Standard_LRS',
          purpose: 'boot-diagnostics',
          allowBlobPublicAccess: false,
        } satisfies AzureResourceProps,
      },
    });
  }

  // ── Network interface ──
  resources.push({
    logicalId: nicId,
    providerResourceType: 'Microsoft.Network/networkInterfaces',
    purpose: 'Network interface connecting the VM to the subnet.',
    origin: 'provider-required',
    autoIncluded: true,
    dependsOn: isIncluded('azure-public-ip') ? [vnetId, pipId] : [vnetId],
    evidence: [depEvidence('azure-nic')],
    apiVersionOrSpec: API.nic,
    securityNotes: ['Binds the VM to a subnet governed by the network security group.'],
    costNotes: ['No direct charge.'],
    warnings: [],
    properties: {
      dependencyIdentifier: 'azure-nic',
      forCompute: baseId,
      azure: {
        kind: 'nic',
        name: nicId,
        apiVersion: API.nic,
        vnetLogicalId: vnetId,
        subnetName,
        publicIpLogicalId: isIncluded('azure-public-ip') ? pipId : null,
      } satisfies AzureResourceProps,
    },
  });

  // ── Intrinsic managed OS disk (part of the VM; not a standalone resource) ──
  resources.push({
    logicalId: `${baseId}-azure-vm-osdisk`,
    providerResourceType: 'storageProfile.osDisk (managed disk)',
    purpose:
      'Managed OS disk, created with the VM as part of its storageProfile. This is a managed disk, NOT a Storage Account.',
    origin: 'provider-required',
    autoIncluded: true,
    dependsOn: [baseId],
    evidence: [depEvidence('azure-vm-osdisk')],
    apiVersionOrSpec: API.vm,
    securityNotes: ['Encrypted at rest with platform-managed keys by default.'],
    costNotes: ['Incurs managed-disk storage cost for the lab duration.'],
    warnings: [],
    properties: {
      dependencyIdentifier: 'azure-vm-osdisk',
      forCompute: baseId,
      azure: {
        kind: 'osDisk',
        intrinsic: true,
        storageAccountType: osDiskType,
      } satisfies AzureResourceProps,
    },
  });

  // ── Virtual machine (primary) ──
  const vmDependsOn = [nicId];
  if (isIncluded('azure-diagnostics-storage')) vmDependsOn.push(storageId);
  const vmEvidence = usingDefaultImage
    ? [
        ...catalogue.evidence,
        appDefaultEvidence(
          `Default ${compute.osFamily} image reference applied; review and change if a specific image is required.`,
        ),
      ]
    : catalogue.evidence;

  resources.push({
    logicalId: baseId,
    providerResourceType: 'Microsoft.Compute/virtualMachines',
    purpose: `Primary virtual machine for the lab (${compute.osFamily}).`,
    origin: 'user',
    autoIncluded: false,
    dependsOn: vmDependsOn,
    evidence: vmEvidence,
    apiVersionOrSpec: API.vm,
    securityNotes: [
      auth === 'ssh-public-key'
        ? 'Linux SSH public-key authentication; no password stored.'
        : 'Password/secret supplied via a secure parameter; never embedded.',
    ],
    costNotes: size?.costFlag ? ['Selected size carries elevated cost risk.'] : [],
    warnings: size ? [] : [`Compute size "${compute.sizeId}" was not found in the catalogue.`],
    properties: {
      sizeId: compute.sizeId,
      osFamily: compute.osFamily,
      count: compute.count,
      authMethod: compute.authMethod,
      publicIpRequested: compute.publicIpRequested,
      azure: {
        kind: 'vm',
        name: baseId,
        apiVersion: API.vm,
        computerName: (compute.name || baseId).replace(/[^a-z0-9-]/gi, '').slice(0, 15) || 'labvm',
        size: compute.sizeId,
        osFamily: compute.osFamily,
        imageReference: image,
        osDiskStorageAccountType: osDiskType,
        nicLogicalId: nicId,
        auth,
        adminUsernameParam: ADMIN_USERNAME_PARAM,
        adminSecretParam: ADMIN_SECRET_PARAM,
        customDataBase64,
        bootDiagnosticsStorageLogicalId: isIncluded('azure-diagnostics-storage') ? storageId : null,
      } satisfies AzureResourceProps,
    },
  });

  // ── Findings ──
  for (const id of ['azure-nsg', 'azure-vnet', 'azure-nic', 'azure-vm-osdisk'] as const) {
    const dep = catalogue.dependencies.find((d) => d.identifier === id);
    if (dep) {
      findings.push({
        id: `auto-included:${baseId}-${id}`,
        kind: 'dependency',
        severity: 'info',
        category: 'Auto-included dependency',
        description: `"${dep.resourceType}" was automatically included because ${dep.reason}`,
        recommendation: 'Review the auto-included resource. You can inspect why it was added here.',
        affectedResource: `${baseId}-${id}`,
        evidence: depEvidence(id),
      });
    }
  }

  if (compute.publicIpRequested) {
    const sec = findingFromSecurityRule('sec-public-ip', baseId);
    if (sec) findings.push(sec);
    const cost = findingFromCostRule('cost-public-ipv4', baseId);
    if (cost) findings.push(cost);
    outputs.push({
      name: `${baseId}PublicIpResourceId`,
      description: 'Resource id of the public IP address.',
      valueExpression: `resourceId('Microsoft.Network/publicIPAddresses', '${pipId}')`,
    });
  }

  if (size?.costFlag) {
    const cost = findingFromCostRule('cost-gpu-oversized', baseId);
    if (cost) findings.push(cost);
  }

  outputs.push({
    name: `${baseId}Name`,
    description: 'Name of the virtual machine.',
    valueExpression: `'${baseId}'`,
  });

  return { resources, findings, outputs };
}

// ── Phase 5: Advanced resource builders ──

function buildStorage(spec: LabSpecification): {
  resources: GeneratedResource[];
  findings: ReviewFinding[];
} {
  const resources: GeneratedResource[] = [];
  const findings: ReviewFinding[] = [];

  for (const storage of spec.storage) {
    if (storage.kind === 'azure-managed-disk') {
      const catalogue = findResource('azure', 'azure-managed-disk');
      const diskName = storage.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      const props: AzureManagedDiskProps = {
        kind: 'managedDisk',
        name: diskName,
        apiVersion: API.disk,
        sku: 'StandardSSD_LRS',
        diskSizeGb: storage.sizeGb ?? 64,
        attachedToVmLogicalId: null,
      };
      resources.push({
        logicalId: storage.id,
        providerResourceType: 'Microsoft.Compute/disks',
        purpose: `Standalone managed data disk (${storage.sizeGb ?? 64} GB).`,
        origin: 'user',
        autoIncluded: false,
        dependsOn: [],
        evidence: catalogue?.evidence ?? [evidenceRefFromId('az-managed-disk-doc')],
        apiVersionOrSpec: API.disk,
        securityNotes: [
          'Managed disks are encrypted at rest with platform-managed keys by default.',
        ],
        costNotes: [
          `Incurs managed-disk storage cost for ${storage.sizeGb ?? 64} GB for the lab duration.`,
        ],
        warnings: [],
        properties: { azure: props satisfies AzureResourceProps },
      });
    }

    if (storage.kind === 'azure-storage-account') {
      const catalogue = findResource('azure', 'azure-storage-account');
      const accountName = storage.name
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()
        .slice(0, 24);
      const props: AzureStorageAccountProps = {
        kind: 'storageAccount',
        name: accountName || 'labstorage',
        apiVersion: API.storage,
        sku: 'Standard_LRS',
        purpose: 'general-purpose',
        allowBlobPublicAccess: !storage.publicAccessBlocked,
      };
      resources.push({
        logicalId: storage.id,
        providerResourceType: 'Microsoft.Storage/storageAccounts',
        purpose: `General-purpose storage account${storage.publicAccessBlocked ? ' (public access blocked)' : ' (public access enabled — review required)'}.`,
        origin: 'user',
        autoIncluded: false,
        dependsOn: [],
        evidence: catalogue?.evidence ?? [evidenceRefFromId('az-storage-account-doc')],
        apiVersionOrSpec: API.storage,
        securityNotes: [
          storage.publicAccessBlocked
            ? 'Public blob access is blocked. This is the secure default.'
            : 'Public blob access is enabled. This is a security risk; confirm it is intentional.',
        ],
        costNotes: ['Incurs Storage Account transaction and capacity charges.'],
        warnings: storage.publicAccessBlocked
          ? []
          : ['Public access is enabled on this storage account.'],
        properties: { azure: props satisfies AzureResourceProps },
      });

      if (!storage.publicAccessBlocked) {
        const sec = findingFromSecurityRule('sec-public-storage', storage.id);
        if (sec) findings.push(sec);
      }
    }
  }

  return { resources, findings };
}

function buildIdentity(spec: LabSpecification): {
  resources: GeneratedResource[];
  findings: ReviewFinding[];
} {
  const resources: GeneratedResource[] = [];
  const findings: ReviewFinding[] = [];

  for (const identity of spec.identity) {
    if (identity.kind !== 'azure-managed-identity') continue;
    const catalogue = findResource('azure', 'azure-managed-identity');
    const idName = identity.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const props: AzureManagedIdentityProps = {
      kind: 'managedIdentity',
      name: idName,
      apiVersion: API.identity,
      purpose: identity.purpose,
    };
    resources.push({
      logicalId: identity.id,
      providerResourceType: 'Microsoft.ManagedIdentity/userAssignedIdentities',
      purpose: `User-assigned managed identity: ${identity.purpose}`,
      origin: 'user',
      autoIncluded: false,
      dependsOn: [],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('az-managed-identity-doc')],
      apiVersionOrSpec: API.identity,
      securityNotes: [
        'Eliminates embedded credentials. Role assignments must be configured separately.',
      ],
      costNotes: ['No direct charge for the managed identity.'],
      warnings: [
        'Role assignments must be configured separately; this tool generates the identity resource only.',
      ],
      properties: { azure: props satisfies AzureResourceProps },
    });
    findings.push({
      id: `identity-least-privilege:${identity.id}`,
      kind: 'security',
      severity: 'info',
      category: 'Identity',
      description: `Managed identity "${identity.name}" was created. Role assignments are not generated.`,
      recommendation:
        'Assign the minimum required roles to this identity. Avoid Owner or broad Contributor roles.',
      affectedResource: identity.id,
      evidence: evidenceRefFromId('safety-least-privilege-identity'),
    });
  }

  return { resources, findings };
}

function buildAppHosting(spec: LabSpecification): {
  resources: GeneratedResource[];
  findings: ReviewFinding[];
} {
  const resources: GeneratedResource[] = [];
  const findings: ReviewFinding[] = [];

  for (const app of spec.appHosting) {
    if (app.kind !== 'azure-app-service') continue;
    const catalogue = findResource('azure', 'azure-app-service');
    const appName = app.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const props: AzureAppServiceProps = {
      kind: 'appService',
      name: appName,
      apiVersion: API.web,
      runtime: app.runtime,
      imageRef: app.imageRef,
      publicEndpointRequested: app.publicEndpointRequested,
      environmentVariables: app.environmentVariables,
    };
    resources.push({
      logicalId: app.id,
      providerResourceType: 'Microsoft.Web/sites',
      purpose: `Azure App Service hosting a ${app.runtime} web application.`,
      origin: 'user',
      autoIncluded: false,
      dependsOn: [],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('az-app-service-doc')],
      apiVersionOrSpec: API.web,
      securityNotes: [
        app.publicEndpointRequested
          ? 'Public endpoint is enabled. Restrict access as needed.'
          : 'No public endpoint requested; private access only.',
      ],
      costNotes: [
        'App Service Plan pricing tier affects cost. Free/Shared tiers have limited features.',
      ],
      warnings: [],
      properties: { azure: props satisfies AzureResourceProps },
    });

    if (app.publicEndpointRequested) {
      const sec = findingFromSecurityRule('sec-public-ip', app.id);
      if (sec) findings.push(sec);
    }
  }

  return { resources, findings };
}

function buildServerless(spec: LabSpecification): {
  resources: GeneratedResource[];
  findings: ReviewFinding[];
} {
  const resources: GeneratedResource[] = [];
  const findings: ReviewFinding[] = [];

  for (const fn of spec.serverless) {
    if (fn.kind !== 'azure-function') continue;
    const catalogue = findResource('azure', 'azure-function');
    const fnName = fn.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const props: AzureFunctionProps = {
      kind: 'functionApp',
      name: fnName,
      apiVersion: API.web,
      runtime: fn.runtime,
      handler: fn.handler,
      codeArtifact: fn.codeArtifact,
      memoryMb: fn.memoryMb,
      timeoutSeconds: fn.timeoutSeconds,
      httpTriggerRequested: fn.httpTriggerRequested,
      environmentVariables: fn.environmentVariables,
    };
    resources.push({
      logicalId: fn.id,
      providerResourceType: 'Microsoft.Web/sites (functionApp)',
      purpose: `Azure Functions app (${fn.runtime}) with ${fn.memoryMb} MB memory and ${fn.timeoutSeconds}s timeout.`,
      origin: 'user',
      autoIncluded: false,
      dependsOn: [],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('az-function-doc')],
      apiVersionOrSpec: API.web,
      securityNotes: [
        fn.httpTriggerRequested
          ? 'HTTP trigger is enabled. Secure the endpoint with authentication.'
          : 'No HTTP trigger; function is invoked by other triggers only.',
      ],
      costNotes: ['Consumption plan charges per execution. Cold start latency applies.'],
      warnings: [],
      properties: { azure: props satisfies AzureResourceProps },
    });

    if (fn.httpTriggerRequested) {
      const sec = findingFromSecurityRule('sec-public-ip', fn.id);
      if (sec) findings.push(sec);
    }
  }

  return { resources, findings };
}

function buildContainers(spec: LabSpecification): {
  resources: GeneratedResource[];
  findings: ReviewFinding[];
} {
  const resources: GeneratedResource[] = [];
  const findings: ReviewFinding[] = [];

  for (const ctr of spec.containers) {
    if (ctr.kind !== 'azure-container-instance') continue;
    const catalogue = findResource('azure', 'azure-container-instance');
    const ctrName = ctr.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const props: AzureContainerInstanceProps = {
      kind: 'containerInstance',
      name: ctrName,
      apiVersion: API.containerInstance,
      image: ctr.image,
      cpuCores: ctr.cpu,
      memoryGb: ctr.memoryGb,
      port: ctr.port,
      publicEndpointRequested: ctr.publicEndpointRequested,
      environmentVariables: ctr.environmentVariables,
    };
    resources.push({
      logicalId: ctr.id,
      providerResourceType: 'Microsoft.ContainerInstance/containerGroups',
      purpose: `Azure Container Instance running ${ctr.image} (${ctr.cpu} CPU, ${ctr.memoryGb} GB RAM).`,
      origin: 'user',
      autoIncluded: false,
      dependsOn: [],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('az-container-instance-doc')],
      apiVersionOrSpec: API.containerInstance,
      securityNotes: [
        ctr.publicEndpointRequested
          ? 'Public port is exposed. Restrict access as needed.'
          : 'No public endpoint; private access only.',
      ],
      costNotes: ['Charges per second while the container group is running.'],
      warnings: [],
      properties: { azure: props satisfies AzureResourceProps },
    });

    if (ctr.publicEndpointRequested) {
      const sec = findingFromSecurityRule('sec-public-ip', ctr.id);
      if (sec) findings.push(sec);
    }
  }

  return { resources, findings };
}

export function buildAzureModel(spec: LabSpecification): InternalModel {
  const resources: GeneratedResource[] = [];
  const findings: ReviewFinding[] = [];
  const outputs: OutputDef[] = [];

  spec.compute.forEach((compute, index) => {
    const built = buildCompute(compute, index, spec);
    resources.push(...built.resources);
    findings.push(...built.findings);
    outputs.push(...built.outputs);
  });

  // Phase 5: Advanced resources.
  const storage = buildStorage(spec);
  resources.push(...storage.resources);
  findings.push(...storage.findings);

  const identity = buildIdentity(spec);
  resources.push(...identity.resources);
  findings.push(...identity.findings);

  const appHosting = buildAppHosting(spec);
  resources.push(...appHosting.resources);
  findings.push(...appHosting.findings);

  const serverless = buildServerless(spec);
  resources.push(...serverless.resources);
  findings.push(...serverless.findings);

  const containers = buildContainers(spec);
  resources.push(...containers.resources);
  findings.push(...containers.findings);

  // Network-level findings (open CIDR / management ports).
  for (const net of spec.network) {
    for (const rule of net.inboundRules) {
      if (rule.sourceCidr.trim() === '0.0.0.0/0') {
        const f = findingFromSecurityRule('sec-open-cidr', net.name);
        if (f)
          findings.push({
            ...f,
            id: `${f.id}:${rule.port}`,
            description: `${f.description} (port ${rule.port} on ${net.name})`,
          });
      }
      if ((rule.port === 22 || rule.port === 3389) && rule.sourceCidr.trim() === '0.0.0.0/0') {
        const f = findingFromSecurityRule('sec-mgmt-port', net.name);
        if (f) findings.push({ ...f, id: `${f.id}:${rule.port}` });
      }
    }
  }

  const totalInstances = spec.compute.reduce((sum, c) => sum + Math.max(1, c.count), 0);
  if (totalInstances > 1) {
    const f = findingFromCostRule('cost-multi-machine');
    if (f) findings.push(f);
  }
  if (Number(spec.deployment.expectedDurationMinutes) > 240) {
    const f = findingFromCostRule('cost-long-duration');
    if (f) findings.push(f);
  }

  const parameters: ParameterDef[] =
    spec.compute.length > 0
      ? [
          {
            name: LOCATION_PARAM,
            type: 'string',
            description: 'Azure region the resources are deployed into.',
            defaultValue: spec.location.primaryRegion || 'eastus',
            secure: false,
          },
          {
            name: ADMIN_USERNAME_PARAM,
            type: 'string',
            description: 'Administrative username for the virtual machine.',
            defaultValue: 'azureuser',
            secure: false,
          },
          {
            name: ADMIN_SECRET_PARAM,
            type: 'securestring',
            description:
              'Administrative password or SSH public key, supplied at deployment time. Never stored in the template.',
            secure: true,
          },
        ]
      : [];

  if (parameters.some((p) => p.secure)) {
    findings.push({
      id: 'secure-input:adminAuthSecret',
      kind: 'security',
      severity: 'info',
      category: 'Secure input',
      description: 'Administrative credentials are declared as a secure parameter, not embedded.',
      recommendation: 'Supply the value at deployment time. Never commit secrets to the template.',
      evidence: evidenceRefFromId('safety-secure-input'),
    });
  }

  return { provider: 'azure', resources, parameters, outputs, findings };
}
