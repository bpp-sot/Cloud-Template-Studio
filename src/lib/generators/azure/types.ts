// Concrete Azure resource property bags carried on GeneratedResource.properties.azure.
//
// The Azure normaliser (src/lib/normalise/azure-model.ts) produces these, and the
// Bicep / ARM generators consume them. Keeping the shape here means both emitters
// render from exactly the same structured description — no drift between Bicep and
// ARM, and no drift between the generated template and the review/inventory.

export interface AzureVnetProps {
  kind: 'vnet';
  name: string;
  apiVersion: string;
  addressSpace: string;
  subnetName: string;
  subnetPrefix: string;
  /** Logical id of the network security group associated with the subnet. */
  nsgLogicalId: string;
}

export interface AzureNsgSecurityRule {
  name: string;
  priority: number;
  direction: 'Inbound' | 'Outbound';
  access: 'Allow' | 'Deny';
  protocol: 'Tcp' | 'Udp' | '*';
  destinationPortRange: string;
  sourceAddressPrefix: string;
}

export interface AzureNsgProps {
  kind: 'nsg';
  name: string;
  apiVersion: string;
  securityRules: AzureNsgSecurityRule[];
}

export interface AzurePublicIpProps {
  kind: 'publicIp';
  name: string;
  apiVersion: string;
  sku: 'Standard';
  allocationMethod: 'Static';
}

export interface AzureNicProps {
  kind: 'nic';
  name: string;
  apiVersion: string;
  vnetLogicalId: string;
  subnetName: string;
  /** Present only when a public IP was explicitly requested. */
  publicIpLogicalId: string | null;
}

export interface AzureStorageAccountProps {
  kind: 'storageAccount';
  name: string;
  apiVersion: string;
  sku: string;
  purpose: 'boot-diagnostics' | 'general-purpose';
  /** Only true when the author explicitly opted in to public blob access. */
  allowBlobPublicAccess: boolean;
}

/** Intrinsic managed OS disk — part of the VM's storageProfile, never a standalone resource. */
export interface AzureOsDiskProps {
  kind: 'osDisk';
  intrinsic: true;
  storageAccountType: string;
}

export interface AzureImageReference {
  publisher: string;
  offer: string;
  sku: string;
  version: string;
}

export interface AzureVmProps {
  kind: 'vm';
  name: string;
  apiVersion: string;
  computerName: string;
  size: string;
  osFamily: 'linux' | 'windows';
  imageReference: AzureImageReference;
  osDiskStorageAccountType: string;
  nicLogicalId: string;
  /** Authentication model resolved from the spec. */
  auth: 'ssh-public-key' | 'password';
  adminUsernameParam: string;
  adminSecretParam: string;
  /** Base64 cloud-init / custom data, when an initialisation script targets this VM. */
  customDataBase64: string | null;
  /** Logical id of the boot-diagnostics storage account, when enabled. */
  bootDiagnosticsStorageLogicalId: string | null;
}

// ── Phase 5: Advanced resource property bags ──

export interface AzureManagedDiskProps {
  kind: 'managedDisk';
  name: string;
  apiVersion: string;
  sku: string;
  diskSizeGb: number;
  /** Logical id of the VM this disk is attached to, when applicable. */
  attachedToVmLogicalId: string | null;
}

export interface AzureManagedIdentityProps {
  kind: 'managedIdentity';
  name: string;
  apiVersion: string;
  /** Purpose description from the spec. */
  purpose: string;
}

export interface AzureAppServiceProps {
  kind: 'appService';
  name: string;
  apiVersion: string;
  runtime: string;
  imageRef: string;
  /** Whether a public endpoint is explicitly requested. */
  publicEndpointRequested: boolean;
  environmentVariables: Array<{ key: string; value: string }>;
}

export interface AzureFunctionProps {
  kind: 'functionApp';
  name: string;
  apiVersion: string;
  runtime: string;
  handler: string;
  codeArtifact: string;
  memoryMb: number;
  timeoutSeconds: number;
  httpTriggerRequested: boolean;
  environmentVariables: Array<{ key: string; value: string }>;
}

export interface AzureContainerInstanceProps {
  kind: 'containerInstance';
  name: string;
  apiVersion: string;
  image: string;
  cpuCores: number;
  memoryGb: number;
  port: number;
  publicEndpointRequested: boolean;
  environmentVariables: Array<{ key: string; value: string }>;
}

export type AzureResourceProps =
  | AzureVnetProps
  | AzureNsgProps
  | AzurePublicIpProps
  | AzureNicProps
  | AzureStorageAccountProps
  | AzureOsDiskProps
  | AzureVmProps
  | AzureManagedDiskProps
  | AzureManagedIdentityProps
  | AzureAppServiceProps
  | AzureFunctionProps
  | AzureContainerInstanceProps;
