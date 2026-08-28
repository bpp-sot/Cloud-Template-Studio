// AWS CloudFormation generator tests — Development Brief §10.3, §16.
//
// Verifies that the CloudFormation YAML and JSON generators produce
// deterministic, parseable output from the AWS InternalModel. YAML and JSON are
// generated independently from the same model and must agree on resource types
// and key properties.

import { describe, it, expect } from 'vitest';
import { buildInternalModel } from '@/lib/normalise/normaliser';
import { generateCloudFormationYaml } from '@/lib/generators/aws/cloudformation-yaml';
import { generateCloudFormationJson } from '@/lib/generators/aws/cloudformation-json';
import { generateAwsParametersJson } from '@/lib/generators/aws/parameters';
import { createEmptyLabSpecification } from '@/lib/model/factory';
import type { ComputeRequirement, LabSpecification, NetworkRequirement } from '@/types';

function awsSpec(opts: {
  publicIp?: boolean;
  osFamily?: 'linux' | 'windows';
  sizeId?: string;
  withNetwork?: boolean;
  withInit?: boolean;
}): LabSpecification {
  const spec = createEmptyLabSpecification('aws');
  spec.metadata.projectName = 'AWS Lab';
  spec.location.primaryRegion = 'us-east-1';
  spec.compute = [
    {
      id: 'c1',
      name: 'lab-instance',
      osFamily: opts.osFamily ?? 'linux',
      sizeId: opts.sizeId ?? 't3.small',
      count: 1,
      authMethod: 'ssh-public-key',
      publicIpRequested: opts.publicIp ?? false,
      dataDiskCount: 0,
      traceTo: [],
    } satisfies ComputeRequirement,
  ];
  if (opts.withNetwork) {
    spec.network = [
      {
        id: 'n1',
        name: 'lab-vpc',
        addressSpace: '10.0.0.0/16',
        subnetName: 'lab-subnet',
        subnetPrefix: '10.0.0.0/24',
        inboundRules: [
          {
            id: 'r1',
            port: 22,
            protocol: 'tcp',
            sourceCidr: '203.0.113.0/24',
            description: 'SSH from lab range',
          },
        ],
        traceTo: [],
      } satisfies NetworkRequirement,
    ];
  }
  if (opts.withInit) {
    spec.initialisation = [
      {
        id: 'i1',
        targetComputeId: 'c1',
        kind: 'aws-user-data',
        script: '#!/bin/bash\nset -e\nyum install -y httpd',
        description: 'Install Apache',
        traceTo: [],
      },
    ];
  }
  return spec;
}

describe('AWS CloudFormation YAML generator', () => {
  it('produces a valid CloudFormation YAML header', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).toContain("AWSTemplateFormatVersion: '2010-09-09'");
    expect(yaml).toContain('Resources:');
    expect(yaml).toContain('Parameters:');
  });

  it('includes VPC, Subnet, Security Group, and EC2 instance resources', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).toContain('AWS::EC2::VPC');
    expect(yaml).toContain('AWS::EC2::Subnet');
    expect(yaml).toContain('AWS::EC2::SecurityGroup');
    expect(yaml).toContain('AWS::EC2::Instance');
  });

  it('does NOT include an Internet Gateway or Route Table when public IP is not requested', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true, publicIp: false }));
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).not.toContain('AWS::EC2::InternetGateway');
    expect(yaml).not.toContain('AWS::EC2::RouteTable');
  });

  it('includes Internet Gateway, Route Table, and derived resources when public IP is requested', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true, publicIp: true }));
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).toContain('AWS::EC2::InternetGateway');
    expect(yaml).toContain('AWS::EC2::RouteTable');
    expect(yaml).toContain('AWS::EC2::VPCGatewayAttachment');
    expect(yaml).toContain('AWS::EC2::Route');
    expect(yaml).toContain('AWS::EC2::SubnetRouteTableAssociation');
  });

  it('emits the root EBS volume as a BlockDeviceMapping, NOT as an S3 bucket', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).toContain('BlockDeviceMappings');
    expect(yaml).toContain('VolumeType');
    expect(yaml).not.toContain('AWS::S3::Bucket');
  });

  it('includes user-data (base64) when an initialization script is provided', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true, withInit: true }));
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).toContain('UserData');
  });

  it('uses an SSM parameter AMI reference by default', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).toContain('{{resolve:ssm:');
  });

  it('is deterministic — identical input produces identical output', () => {
    const spec = awsSpec({ withNetwork: true });
    const a = generateCloudFormationYaml(buildInternalModel(spec));
    const b = generateCloudFormationYaml(buildInternalModel(spec));
    expect(a).toBe(b);
  });

  it('matches snapshot (Linux, private, with network)', async () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    await expect(generateCloudFormationYaml(model)).toMatchFileSnapshot(
      './__snapshots__/aws-cfn-yaml-linux-private.snap.yaml',
    );
  });
});

describe('AWS CloudFormation JSON generator', () => {
  it('produces parseable JSON with the CloudFormation schema', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const json = generateCloudFormationJson(model);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.AWSTemplateFormatVersion).toBe('2010-09-09');
    expect(parsed.Resources).toBeDefined();
    expect(parsed.Parameters).toBeDefined();
  });

  it('includes the same resource types as the YAML output', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const json = generateCloudFormationJson(model);
    expect(json).toContain('AWS::EC2::VPC');
    expect(json).toContain('AWS::EC2::Subnet');
    expect(json).toContain('AWS::EC2::SecurityGroup');
    expect(json).toContain('AWS::EC2::Instance');
  });

  it('emits Ref intrinsics for cross-resource references', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const json = generateCloudFormationJson(model);
    expect(json).toContain('"Ref"');
  });

  it('does NOT include Internet Gateway resources when public IP is not requested', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true, publicIp: false }));
    const json = generateCloudFormationJson(model);
    expect(json).not.toContain('AWS::EC2::InternetGateway');
  });

  it('is deterministic — identical input produces identical output', () => {
    const spec = awsSpec({ withNetwork: true });
    const a = generateCloudFormationJson(buildInternalModel(spec));
    const b = generateCloudFormationJson(buildInternalModel(spec));
    expect(a).toBe(b);
  });

  it('matches snapshot (Linux, private, with network)', async () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    await expect(generateCloudFormationJson(model)).toMatchFileSnapshot(
      './__snapshots__/aws-cfn-json-linux-private.snap.json',
    );
  });
});

describe('AWS parameters generator', () => {
  it('emits empty values for secure parameters', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const params = generateAwsParametersJson(model.parameters);
    const parsed = JSON.parse(params) as Record<string, unknown>;
    expect(parsed.AdminAuthSecret).toBe('');
  });

  it('emits default values for non-secure parameters', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const params = generateAwsParametersJson(model.parameters);
    const parsed = JSON.parse(params) as Record<string, unknown>;
    expect(parsed.AdminUsername).toBe('ec2-user');
  });

  it('is deterministic', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const a = generateAwsParametersJson(model.parameters);
    const b = generateAwsParametersJson(model.parameters);
    expect(a).toBe(b);
  });
});

describe('AWS provider separation (no cross-provider leakage)', () => {
  it('AWS YAML never contains Azure resource types', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const yaml = generateCloudFormationYaml(model);
    expect(yaml).not.toContain('Microsoft.');
  });

  it('AWS JSON never contains Azure resource types', () => {
    const model = buildInternalModel(awsSpec({ withNetwork: true }));
    const json = generateCloudFormationJson(model);
    expect(json).not.toContain('Microsoft.');
  });
});
