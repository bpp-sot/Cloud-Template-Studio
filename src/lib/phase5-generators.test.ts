// Phase 5/6 tests — advanced resources, professional fragments, and Policy Studio export.

import { describe, it, expect } from 'vitest';
import { createEmptyLabSpecification } from '@/lib/model/factory';
import { buildInternalModel } from '@/lib/normalise/normaliser';
import { generateBicep } from '@/lib/generators/azure/bicep';
import { generateArmTemplate } from '@/lib/generators/azure/arm';
import { generateCloudFormationYaml } from '@/lib/generators/aws/cloudformation-yaml';
import { generateCloudFormationJson } from '@/lib/generators/aws/cloudformation-json';
import { generateSecurityReview } from '@/lib/security-review';
import { generateCostReview } from '@/lib/cost-review';
import { generateDeploymentReadiness } from '@/lib/deployment-readiness';
import {
  exportForPolicyStudio,
  exportForPolicyStudioAsJson,
  validatePolicyStudioExport,
} from '@/lib/policy-studio-export';
import type { LabSpecification } from '@/types';

function azureSpecWithStorage(): LabSpecification {
  const spec = createEmptyLabSpecification('azure');
  spec.storage = [
    {
      id: 'disk1',
      name: 'data-disk',
      kind: 'azure-managed-disk',
      sizeGb: 128,
      publicAccessBlocked: true,
      traceTo: [],
    },
    {
      id: 'storage1',
      name: 'labstorage',
      kind: 'azure-storage-account',
      publicAccessBlocked: true,
      traceTo: [],
    },
  ];
  spec.identity = [
    {
      id: 'identity1',
      name: 'lab-identity',
      kind: 'azure-managed-identity',
      purpose: 'Access Key Vault',
      traceTo: [],
    },
  ];
  return spec;
}

function azureSpecWithAppHosting(): LabSpecification {
  const spec = createEmptyLabSpecification('azure');
  spec.appHosting = [
    {
      id: 'app1',
      name: 'web-app',
      kind: 'azure-app-service',
      runtime: 'nodejs',
      imageRef: 'nginx:latest',
      publicEndpointRequested: false,
      environmentVariables: [],
      traceTo: [],
    },
  ];
  spec.serverless = [
    {
      id: 'fn1',
      name: 'lab-function',
      kind: 'azure-function',
      runtime: 'nodejs',
      handler: 'index.handler',
      codeArtifact: 'module.exports = async function() { return 200; }',
      memoryMb: 128,
      timeoutSeconds: 30,
      httpTriggerRequested: false,
      environmentVariables: [],
      traceTo: [],
    },
  ];
  spec.containers = [
    {
      id: 'ctr1',
      name: 'lab-container',
      kind: 'azure-container-instance',
      image: 'nginx:latest',
      cpu: 1,
      memoryGb: 1.5,
      port: 80,
      publicEndpointRequested: false,
      environmentVariables: [],
      traceTo: [],
    },
  ];
  return spec;
}

function awsSpecWithStorage(): LabSpecification {
  const spec = createEmptyLabSpecification('aws');
  spec.storage = [
    {
      id: 'vol1',
      name: 'data-volume',
      kind: 'aws-ebs-volume',
      sizeGb: 64,
      publicAccessBlocked: true,
      traceTo: [],
    },
    {
      id: 'bucket1',
      name: 'labbucket',
      kind: 'aws-s3-bucket',
      publicAccessBlocked: true,
      traceTo: [],
    },
  ];
  spec.identity = [
    {
      id: 'role1',
      name: 'lab-role',
      kind: 'aws-iam-role',
      purpose: 'EC2 instance role',
      traceTo: [],
    },
  ];
  return spec;
}

function awsSpecWithServerlessAndContainers(): LabSpecification {
  const spec = createEmptyLabSpecification('aws');
  spec.serverless = [
    {
      id: 'fn1',
      name: 'lab-function',
      kind: 'aws-lambda',
      runtime: 'nodejs18.x',
      handler: 'index.handler',
      codeArtifact: 'exports.handler = async () => ({ statusCode: 200 });',
      memoryMb: 256,
      timeoutSeconds: 60,
      httpTriggerRequested: false,
      environmentVariables: [],
      traceTo: [],
    },
  ];
  spec.containers = [
    {
      id: 'ctr1',
      name: 'lab-container',
      kind: 'aws-ecs-fargate',
      image: 'nginx:latest',
      cpu: 256,
      memoryGb: 0.5,
      port: 80,
      publicEndpointRequested: false,
      environmentVariables: [],
      traceTo: [],
    },
  ];
  return spec;
}

describe('Phase 5: Azure storage and identity', () => {
  it('builds managed disk and storage account resources', () => {
    const spec = azureSpecWithStorage();
    const model = buildInternalModel(spec);
    const disk = model.resources.find((r) => r.logicalId === 'disk1');
    const storage = model.resources.find((r) => r.logicalId === 'storage1');
    expect(disk).toBeDefined();
    expect(disk?.providerResourceType).toBe('Microsoft.Compute/disks');
    expect(storage).toBeDefined();
    expect(storage?.providerResourceType).toBe('Microsoft.Storage/storageAccounts');
  });

  it('builds managed identity resource', () => {
    const spec = azureSpecWithStorage();
    const model = buildInternalModel(spec);
    const identity = model.resources.find((r) => r.logicalId === 'identity1');
    expect(identity).toBeDefined();
    expect(identity?.providerResourceType).toBe('Microsoft.ManagedIdentity/userAssignedIdentities');
  });

  it('generates Bicep for managed disk', () => {
    const spec = azureSpecWithStorage();
    const model = buildInternalModel(spec);
    const bicep = generateBicep(model);
    expect(bicep).toContain('Microsoft.Compute/disks');
    expect(bicep).toContain('diskSizeGB: 128');
  });

  it('generates ARM JSON for managed disk', () => {
    const spec = azureSpecWithStorage();
    const model = buildInternalModel(spec);
    const arm = generateArmTemplate(model);
    const parsed = JSON.parse(arm);
    const diskResource = (parsed.resources as Array<Record<string, unknown>>).find(
      (r) => (r as { type: string }).type === 'Microsoft.Compute/disks',
    );
    expect(diskResource).toBeDefined();
  });

  it('generates Bicep for managed identity', () => {
    const spec = azureSpecWithStorage();
    const model = buildInternalModel(spec);
    const bicep = generateBicep(model);
    expect(bicep).toContain('Microsoft.ManagedIdentity/userAssignedIdentities');
  });
});

describe('Phase 5: Azure app hosting, serverless, containers', () => {
  it('builds app service, function, and container resources', () => {
    const spec = azureSpecWithAppHosting();
    const model = buildInternalModel(spec);
    expect(model.resources.find((r) => r.logicalId === 'app1')).toBeDefined();
    expect(model.resources.find((r) => r.logicalId === 'fn1')).toBeDefined();
    expect(model.resources.find((r) => r.logicalId === 'ctr1')).toBeDefined();
  });

  it('generates Bicep for app service', () => {
    const spec = azureSpecWithAppHosting();
    const model = buildInternalModel(spec);
    const bicep = generateBicep(model);
    expect(bicep).toContain('Microsoft.Web/sites');
  });

  it('generates Bicep for container instance', () => {
    const spec = azureSpecWithAppHosting();
    const model = buildInternalModel(spec);
    const bicep = generateBicep(model);
    expect(bicep).toContain('Microsoft.ContainerInstance/containerGroups');
  });
});

describe('Phase 5: AWS storage and identity', () => {
  it('builds EBS volume and S3 bucket resources', () => {
    const spec = awsSpecWithStorage();
    const model = buildInternalModel(spec);
    const vol = model.resources.find((r) => r.logicalId === 'vol1');
    const bucket = model.resources.find((r) => r.logicalId === 'bucket1');
    expect(vol).toBeDefined();
    expect(vol?.providerResourceType).toBe('AWS::EC2::Volume');
    expect(bucket).toBeDefined();
    expect(bucket?.providerResourceType).toBe('AWS::S3::Bucket');
  });

  it('builds IAM role resource', () => {
    const spec = awsSpecWithStorage();
    const model = buildInternalModel(spec);
    const role = model.resources.find((r) => r.logicalId === 'role1');
    expect(role).toBeDefined();
    expect(role?.providerResourceType).toBe('AWS::IAM::Role');
  });

  it('generates CloudFormation YAML for EBS volume', () => {
    const spec = awsSpecWithStorage();
    const model = buildInternalModel(spec);
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).toContain('AWS::EC2::Volume');
  });

  it('generates CloudFormation YAML for S3 bucket with public access blocked', () => {
    const spec = awsSpecWithStorage();
    const model = buildInternalModel(spec);
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).toContain('AWS::S3::Bucket');
    expect(yaml).toContain('BlockPublicAcls: true');
  });

  it('generates CloudFormation JSON for IAM role', () => {
    const spec = awsSpecWithStorage();
    const model = buildInternalModel(spec);
    const json = generateCloudFormationJson(model);
    const parsed = JSON.parse(json);
    expect(parsed.Resources.role1).toBeDefined();
    expect(parsed.Resources.role1.Type).toBe('AWS::IAM::Role');
  });
});

describe('Phase 5: AWS serverless and containers', () => {
  it('auto-includes Lambda execution role', () => {
    const spec = awsSpecWithServerlessAndContainers();
    const model = buildInternalModel(spec);
    const role = model.resources.find((r) => r.logicalId === 'fn1ExecutionRole');
    expect(role).toBeDefined();
    expect(role?.autoIncluded).toBe(true);
    const fn = model.resources.find((r) => r.logicalId === 'fn1');
    expect(fn?.dependsOn).toContain('fn1ExecutionRole');
  });

  it('auto-includes ECS task execution role, cluster, and task definition', () => {
    const spec = awsSpecWithServerlessAndContainers();
    const model = buildInternalModel(spec);
    const role = model.resources.find((r) => r.logicalId === 'ctr1ExecutionRole');
    const cluster = model.resources.find((r) => r.logicalId === 'ctr1Cluster');
    const taskDef = model.resources.find((r) => r.logicalId === 'ctr1TaskDef');
    expect(role).toBeDefined();
    expect(role?.autoIncluded).toBe(true);
    expect(cluster).toBeDefined();
    expect(taskDef).toBeDefined();
  });

  it('generates CloudFormation YAML for Lambda', () => {
    const spec = awsSpecWithServerlessAndContainers();
    const model = buildInternalModel(spec);
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).toContain('AWS::Lambda::Function');
    expect(yaml).toContain('AWS::IAM::Role');
  });

  it('generates CloudFormation JSON for ECS Fargate', () => {
    const spec = awsSpecWithServerlessAndContainers();
    const model = buildInternalModel(spec);
    const json = generateCloudFormationJson(model);
    const parsed = JSON.parse(json);
    expect(parsed.Resources.ctr1Cluster).toBeDefined();
    expect(parsed.Resources.ctr1TaskDef).toBeDefined();
    expect(parsed.Resources.ctr1).toBeDefined();
  });
});

describe('Phase 5: Security review for advanced resources', () => {
  it('flags public storage access', () => {
    const spec = azureSpecWithStorage();
    spec.storage[1].publicAccessBlocked = false;
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.category === 'Public storage')).toBe(true);
  });

  it('includes identity least-privilege reminders', () => {
    const spec = azureSpecWithStorage();
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.checkId === 'identity-least-privilege')).toBe(true);
  });

  it('flags app hosting public endpoints', () => {
    const spec = azureSpecWithAppHosting();
    spec.appHosting[0].publicEndpointRequested = true;
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.checkId === 'app-public-endpoint')).toBe(true);
  });

  it('flags serverless HTTP triggers', () => {
    const spec = azureSpecWithAppHosting();
    spec.serverless[0].httpTriggerRequested = true;
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.checkId === 'function-http-trigger')).toBe(true);
  });

  it('flags container public endpoints', () => {
    const spec = azureSpecWithAppHosting();
    spec.containers[0].publicEndpointRequested = true;
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.checkId === 'container-public-endpoint')).toBe(true);
  });
});

describe('Phase 5: Cost review for advanced resources', () => {
  it('includes storage cost items', () => {
    const spec = azureSpecWithStorage();
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(review.items.some((i) => i.id === 'cost-storage-adv:disk1')).toBe(true);
    expect(review.items.some((i) => i.id === 'cost-storage-adv:storage1')).toBe(true);
  });

  it('includes app hosting cost items', () => {
    const spec = azureSpecWithAppHosting();
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(review.items.some((i) => i.id === 'cost-app-hosting:app1')).toBe(true);
  });

  it('includes serverless cost items', () => {
    const spec = azureSpecWithAppHosting();
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(review.items.some((i) => i.id === 'cost-serverless:fn1')).toBe(true);
  });

  it('includes container cost items', () => {
    const spec = azureSpecWithAppHosting();
    const model = buildInternalModel(spec);
    const review = generateCostReview(spec, model);
    expect(review.items.some((i) => i.id === 'cost-container:ctr1')).toBe(true);
  });
});

describe('Phase 6: Professional Mode fragments', () => {
  it('injects Bicep fragments with boundary markers', () => {
    const spec = createEmptyLabSpecification('azure');
    spec.professional = {
      azureFragments: [
        "resource extraStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {\n  name: 'extra'\n}",
      ],
      awsFragments: [],
      notes: 'Extra storage',
    };
    const model = buildInternalModel(spec);
    const bicep = generateBicep(model, spec.professional.azureFragments);
    expect(bicep).toContain('BEGIN CUSTOM FRAGMENT 1');
    expect(bicep).toContain('END CUSTOM FRAGMENT 1');
    expect(bicep).toContain('Classification F');
    expect(bicep).toContain('extraStorage');
  });

  it('injects CloudFormation YAML fragments with boundary markers', () => {
    const spec = createEmptyLabSpecification('aws');
    spec.professional = {
      azureFragments: [],
      awsFragments: [
        'MyBucket:\n  Type: AWS::S3::Bucket\n  Properties:\n    BucketName: extra-bucket',
      ],
      notes: 'Extra bucket',
    };
    const model = buildInternalModel(spec);
    const yaml = generateCloudFormationYaml(model, spec.professional.awsFragments);
    expect(yaml).toContain('BEGIN CUSTOM FRAGMENT 1');
    expect(yaml).toContain('END CUSTOM FRAGMENT 1');
    expect(yaml).toContain('Classification F');
    expect(yaml).toContain('MyBucket');
  });

  it('injects ARM JSON fragments with classification markers', () => {
    const spec = createEmptyLabSpecification('azure');
    const fragment = JSON.stringify({
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2023-05-01',
      name: 'extra',
    });
    spec.professional = {
      azureFragments: [fragment],
      awsFragments: [],
      notes: '',
    };
    const model = buildInternalModel(spec);
    const arm = generateArmTemplate(model, spec.professional.azureFragments);
    const parsed = JSON.parse(arm);
    const fragResource = parsed.resources.find(
      (r: Record<string, unknown>) => (r as { _classification?: string })._classification === 'F',
    );
    expect(fragResource).toBeDefined();
    expect((fragResource as { _fragmentIndex: number })._fragmentIndex).toBe(1);
  });

  it('injects CloudFormation JSON fragments with classification markers', () => {
    const spec = createEmptyLabSpecification('aws');
    const fragment = JSON.stringify({
      Resources: {
        ExtraBucket: { Type: 'AWS::S3::Bucket', Properties: { BucketName: 'extra' } },
      },
    });
    spec.professional = {
      azureFragments: [],
      awsFragments: [fragment],
      notes: '',
    };
    const model = buildInternalModel(spec);
    const json = generateCloudFormationJson(model, spec.professional.awsFragments);
    const parsed = JSON.parse(json);
    expect(parsed.Resources.CustomFragment1_ExtraBucket).toBeDefined();
    expect(parsed.Resources.CustomFragment1_ExtraBucket._classification).toBe('F');
  });

  it('security review flags professional fragments', () => {
    const spec = createEmptyLabSpecification('azure');
    spec.professional = {
      azureFragments: ["resource x 'Microsoft.Storage/storageAccounts@2023-05-01' = { name: 'x' }"],
      awsFragments: [],
      notes: '',
    };
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.checkId === 'professional-fragments')).toBe(true);
  });

  it('security review detects embedded secrets in fragments', () => {
    const spec = createEmptyLabSpecification('azure');
    spec.professional = {
      azureFragments: ["param password string = 'hunter2'"],
      awsFragments: [],
      notes: '',
    };
    const model = buildInternalModel(spec);
    const review = generateSecurityReview(spec, model);
    expect(review.items.some((i) => i.checkId === 'fragment-embedded-secret')).toBe(true);
  });

  it('deployment readiness warns about custom fragments', () => {
    const spec = createEmptyLabSpecification('azure');
    spec.professional = {
      azureFragments: ["resource x 'Microsoft.Storage/storageAccounts@2023-05-01' = { name: 'x' }"],
      awsFragments: [],
      notes: '',
    };
    const model = buildInternalModel(spec);
    const readiness = generateDeploymentReadiness(spec, model);
    expect(readiness.checks.some((c) => c.id === 'professional-fragments')).toBe(true);
  });

  it('deployment readiness passes when no custom fragments', () => {
    const spec = createEmptyLabSpecification('azure');
    const model = buildInternalModel(spec);
    const readiness = generateDeploymentReadiness(spec, model);
    expect(readiness.checks.some((c) => c.id === 'no-professional-fragments')).toBe(true);
  });
});

describe('Phase 6: Policy Studio export', () => {
  it('exports provider-neutral Lab Specification', () => {
    const spec = createEmptyLabSpecification('azure');
    spec.metadata.projectName = 'Test Lab';
    const exported = exportForPolicyStudio(spec);
    expect(exported.schemaVersion).toBe(spec.schemaVersion);
    expect(exported.export.format).toBe('lab-specification');
    expect(exported.export.sourceTool).toBeDefined();
    expect(exported.specification.metadata.projectName).toBe('Test Lab');
  });

  it('strips providerConfig from export', () => {
    const spec = createEmptyLabSpecification('azure');
    const exported = exportForPolicyStudio(spec);
    expect((exported.specification as Record<string, unknown>).providerConfig).toBeUndefined();
  });

  it('preserves provider field in export', () => {
    const spec = createEmptyLabSpecification('aws');
    const exported = exportForPolicyStudio(spec);
    expect(exported.specification.provider).toBe('aws');
  });

  it('serializes to JSON', () => {
    const spec = createEmptyLabSpecification('azure');
    const json = exportForPolicyStudioAsJson(spec);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(spec.schemaVersion);
    expect(parsed.export.format).toBe('lab-specification');
  });

  it('validates correct export', () => {
    const spec = createEmptyLabSpecification('azure');
    const exported = exportForPolicyStudio(spec);
    expect(validatePolicyStudioExport(exported)).toBeNull();
  });

  it('rejects export with providerConfig', () => {
    const obj = {
      schemaVersion: '1.0.0',
      export: { format: 'lab-specification' },
      specification: { schemaVersion: '1.0.0', providerConfig: { kind: 'azure' } },
    };
    expect(validatePolicyStudioExport(obj)).toContain('must not be present');
  });

  it('round-trips through JSON without losing data', () => {
    const spec = createEmptyLabSpecification('azure');
    spec.metadata.projectName = 'Round Trip Test';
    spec.storage = [
      {
        id: 's1',
        name: 'storage',
        kind: 'azure-storage-account',
        publicAccessBlocked: true,
        traceTo: [],
      },
    ];
    const json = exportForPolicyStudioAsJson(spec);
    const parsed = JSON.parse(json);
    expect(parsed.specification.storage).toHaveLength(1);
    expect(parsed.specification.storage[0].id).toBe('s1');
    expect(parsed.specification.metadata.projectName).toBe('Round Trip Test');
  });
});
