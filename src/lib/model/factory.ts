// Factory helpers that build empty, valid domain objects for the wizard.

import {
  LAB_SPEC_SCHEMA_VERSION,
  type CloudProvider,
  type GovernanceRequirement,
  type LabSpecification,
  type ProviderConfig,
  type TemplateProject,
  type WizardState,
} from '@/types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyProviderConfig(provider: CloudProvider): ProviderConfig {
  if (provider === 'azure') {
    return {
      kind: 'azure',
      azure: {
        resourceGroupName: '',
        imageReference: null,
        imageId: null,
        bootDiagnosticsEnabled: false,
      },
    };
  }
  return {
    kind: 'aws',
    aws: {
      stackName: '',
      amiStrategy: 'ssm-parameter',
      imageId: null,
      ssmParameterName: null,
      explicitAmiId: null,
      keyPairStrategy: 'none',
      keyPairName: null,
    },
  };
}

function emptyGovernance(): GovernanceRequirement {
  return {
    namingPrefix: '',
    programmeCode: '',
    moduleCode: '',
    costCentre: '',
    owner: '',
    purposeTag: '',
    expiry: '',
    requiredTags: [],
  };
}

export function createEmptyLabSpecification(provider: CloudProvider = 'azure'): LabSpecification {
  return {
    schemaVersion: LAB_SPEC_SCHEMA_VERSION,
    metadata: {
      projectName: '',
      labProfileName: '',
      labProfileNumber: '',
      author: '',
      version: '1.0.0',
      description: '',
      programme: '',
      module: '',
      intendedAudience: '',
      labDuration: '60',
      status: 'development',
      purpose: '',
    },
    learningPurpose: {
      outcomes: [],
      learnerTasks: [],
      technicalTasks: [],
      requiredSoftware: '',
      operatingSystems: '',
      datasets: '',
      expectedOutputs: '',
      lifecycle: [],
    },
    provider,
    deployment: {
      model: 'pre-entry',
      cleanup: false,
      validation: false,
      labSaveEnabled: true,
      failureBehaviour: 'unspecified',
      expectedDurationMinutes: '60',
      exposedParameters: [],
    },
    location: {
      approvedRegions: [],
      primaryRegion: '',
      fallbackRegions: [],
      globalResourcesRequired: false,
      dataResidencyRequired: false,
      residencyNotes: '',
    },
    architecturePattern: 'single-vm',
    compute: [],
    network: [],
    storage: [],
    identity: [],
    appHosting: [],
    serverless: [],
    containers: [],
    initialisation: [],
    security: [],
    governance: emptyGovernance(),
    providerConfig: emptyProviderConfig(provider),
  };
}

export function createEmptyWizardState(provider: CloudProvider = 'azure'): WizardState {
  return {
    currentStep: 0,
    spec: createEmptyLabSpecification(provider),
  };
}

export function createEmptyProject(provider: CloudProvider = 'azure'): TemplateProject {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    wizard: createEmptyWizardState(provider),
  };
}
