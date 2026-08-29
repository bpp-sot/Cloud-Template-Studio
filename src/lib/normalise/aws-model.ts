// AWS internal-model builder — Development Brief §10.1, §10.4.
//
// Produces a fully-propertied, provider-specific InternalModel for AWS from a
// LabSpecification. Inclusion decisions and evidence come from the data-driven
// dependency engine; concrete resource configuration is attached under
// properties.aws for the CloudFormation YAML and JSON generators to render
// identically.

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
import { findComputeSize, findResource, findAwsImage } from '@/lib/data';
import { evidenceRefFromId, resolveDependencies } from './dependencies';
import { findingFromCostRule, findingFromSecurityRule } from './findings';
import type {
  AwsAppRunnerProps,
  AwsEbsRootProps,
  AwsEbsVolumeProps,
  AwsEcsFargateProps,
  AwsIamRoleProps,
  AwsInstanceProps,
  AwsLambdaProps,
  AwsResourceProps,
  AwsS3BucketProps,
  AwsSecurityGroupIngressRule,
} from '@/lib/generators/aws/types';

const ADMIN_USERNAME_PARAM = 'AdminUsername';
const ADMIN_SECRET_PARAM = 'AdminAuthSecret';
const KEY_PAIR_NAME_PARAM = 'KeyPairName';

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

function base64(text: string): string {
  if (typeof btoa === 'function') return btoa(text);
  return Buffer.from(text, 'utf-8').toString('base64');
}

/** Default AMI SSM parameter aliases (region-independent references). */
function defaultAmiSsmParameter(osFamily: 'linux' | 'windows'): string {
  return osFamily === 'linux'
    ? '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64'
    : '/aws/service/ami-windows-latest/Windows_Server-2022-English-Full-Base';
}

function ingressRulesFromNetwork(
  net: NetworkRequirement | undefined,
): AwsSecurityGroupIngressRule[] {
  if (!net) return [];
  return net.inboundRules.map((rule) => ({
    fromPort: rule.port,
    toPort: rule.port,
    ipProtocol: rule.protocol,
    cidrIp: rule.sourceCidr,
    description: rule.description,
  }));
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

  const catalogue = findResource('aws', 'aws-ec2-instance');
  if (!catalogue) throw new Error('Missing AWS EC2 catalogue entry (aws-ec2-instance).');

  const baseId = compute.name || `aws-compute-${index + 1}`;
  const size = findComputeSize('aws', compute.sizeId);
  const net = spec.network[index] ?? spec.network[0];
  const cidrBlock = net?.addressSpace || '10.0.0.0/16';
  const subnetCidr = net?.subnetPrefix || '10.0.0.0/24';

  const awsCfg = spec.providerConfig.kind === 'aws' ? spec.providerConfig.aws : null;
  const usingSsmParameter = awsCfg?.amiStrategy !== 'explicit-ami';
  // Resolve AMI: explicit AMI id > imageId from catalogue (SSM parameter) > default SSM parameter.
  const catalogueImage = awsCfg?.imageId ? findAwsImage(awsCfg.imageId) : null;
  const ami = awsCfg?.explicitAmiId
    ? awsCfg.explicitAmiId
    : catalogueImage
      ? `{{resolve:ssm:${catalogueImage.ssmParameter}}}`
      : `{{resolve:ssm:${defaultAmiSsmParameter(compute.osFamily)}}}`;
  const usingDefaultAmi = !awsCfg?.explicitAmiId && !catalogueImage;

  const optedIn = new Set<string>();
  if (compute.publicIpRequested) {
    optedIn.add('aws-internet-gateway');
    optedIn.add('aws-route-table');
  }
  const resolved = resolveDependencies(catalogue, optedIn);
  const isIncluded = (id: string) => resolved.find((r) => r.dependency.identifier === id)?.included;
  const depEvidence = (id: string): EvidenceReference =>
    resolved.find((r) => r.dependency.identifier === id)?.evidence ??
    evidenceRefFromId('safety-secure-input');

  const vpcId = `${baseId}-vpc`;
  const subnetId = `${baseId}-subnet`;
  const sgId = `${baseId}-sg`;
  const igwId = `${baseId}-igw`;
  const rtId = `${baseId}-rt`;

  // Initialisation (user-data) targeting this instance.
  const initScript = spec.initialisation.find(
    (i) =>
      i.targetComputeId === compute.id &&
      (i.kind === 'aws-user-data' || i.kind === 'shell' || i.kind === 'cloud-init'),
  );
  const userDataBase64 = initScript ? base64(initScript.script) : null;

  const rootVolumeType = String(catalogue.defaults.rootVolumeType ?? 'gp3') as
    'gp3' | 'gp2' | 'io1' | 'io2' | 'st1' | 'sc1' | 'standard';
  const rootVolumeSizeGb = Number(catalogue.defaults.rootVolumeSizeGb ?? 30);

  // ── VPC ──
  resources.push({
    logicalId: vpcId,
    providerResourceType: 'AWS::EC2::VPC',
    purpose: 'Virtual Private Cloud providing the isolated network for the EC2 instance.',
    origin: 'provider-required',
    autoIncluded: true,
    dependsOn: [],
    evidence: [depEvidence('aws-vpc')],
    apiVersionOrSpec: catalogue.schemaOrApiVersion,
    securityNotes: [
      'Defines the network boundary; no inbound internet access without an IGW and route.',
    ],
    costNotes: ['No direct charge for the VPC itself.'],
    warnings: [],
    properties: {
      dependencyIdentifier: 'aws-vpc',
      forCompute: baseId,
      aws: {
        kind: 'vpc',
        logicalName: vpcId,
        cidrBlock,
        enableDnsSupport: true,
        enableDnsHostnames: true,
      } satisfies AwsResourceProps,
    },
  });

  // ── Subnet ──
  resources.push({
    logicalId: subnetId,
    providerResourceType: 'AWS::EC2::Subnet',
    purpose: 'Subnet within the VPC where the EC2 instance is launched.',
    origin: 'provider-required',
    autoIncluded: true,
    dependsOn: [vpcId],
    evidence: [depEvidence('aws-subnet')],
    apiVersionOrSpec: catalogue.schemaOrApiVersion,
    securityNotes: [
      compute.publicIpRequested
        ? 'MapPublicIpOnLaunch enabled because the author requested public access.'
        : 'MapPublicIpOnLaunch disabled; no public IP assigned by default.',
    ],
    costNotes: ['No direct charge for the subnet.'],
    warnings: [],
    properties: {
      dependencyIdentifier: 'aws-subnet',
      forCompute: baseId,
      aws: {
        kind: 'subnet',
        logicalName: subnetId,
        cidrBlock: subnetCidr,
        vpcLogicalId: vpcId,
        mapPublicIpOnLaunch: compute.publicIpRequested,
        availabilityZone: null,
      } satisfies AwsResourceProps,
    },
  });

  // ── Security group ──
  resources.push({
    logicalId: sgId,
    providerResourceType: 'AWS::EC2::SecurityGroup',
    purpose:
      'Security group attached to the instance. Denies inbound traffic unless an ingress rule is explicitly added.',
    origin: 'safety-recommended',
    autoIncluded: true,
    dependsOn: [vpcId],
    evidence: [depEvidence('aws-security-group')],
    apiVersionOrSpec: catalogue.schemaOrApiVersion,
    securityNotes: ['Default posture denies inbound traffic; ingress rules are opt-in.'],
    costNotes: ['No direct charge for the security group.'],
    warnings: [],
    properties: {
      dependencyIdentifier: 'aws-security-group',
      forCompute: baseId,
      aws: {
        kind: 'securityGroup',
        logicalName: sgId,
        groupDescription: `Security group for ${baseId}`,
        vpcLogicalId: vpcId,
        ingressRules: ingressRulesFromNetwork(net),
      } satisfies AwsResourceProps,
    },
  });

  // ── Optional Internet Gateway (opt-in only) ──
  if (isIncluded('aws-internet-gateway')) {
    resources.push({
      logicalId: igwId,
      providerResourceType: 'AWS::EC2::InternetGateway',
      purpose: 'Internet gateway explicitly requested to enable internet access for the VPC.',
      origin: 'user',
      autoIncluded: false,
      dependsOn: [vpcId],
      evidence: [depEvidence('aws-internet-gateway')],
      apiVersionOrSpec: catalogue.schemaOrApiVersion,
      securityNotes: ['Enables internet exposure; requires restrictive security group rules.'],
      costNotes: [
        'No direct charge for the IGW, but public IPv4 addresses incur an hourly charge.',
      ],
      warnings: [],
      properties: {
        dependencyIdentifier: 'aws-internet-gateway',
        forCompute: baseId,
        aws: {
          kind: 'internetGateway',
          logicalName: igwId,
          vpcLogicalId: vpcId,
        } satisfies AwsResourceProps,
      },
    });
  }

  // ── Optional Route Table (opt-in only) ──
  if (isIncluded('aws-route-table')) {
    resources.push({
      logicalId: rtId,
      providerResourceType: 'AWS::EC2::RouteTable',
      purpose:
        'Route table with a default route to the internet gateway, added only when public access is requested.',
      origin: 'user',
      autoIncluded: false,
      dependsOn: [vpcId, igwId, subnetId],
      evidence: [depEvidence('aws-route-table')],
      apiVersionOrSpec: catalogue.schemaOrApiVersion,
      securityNotes: ['Adds a default route to the internet gateway.'],
      costNotes: ['No direct charge for the route table.'],
      warnings: [],
      properties: {
        dependencyIdentifier: 'aws-route-table',
        forCompute: baseId,
        aws: {
          kind: 'routeTable',
          logicalName: rtId,
          vpcLogicalId: vpcId,
          gatewayLogicalId: igwId,
          subnetLogicalId: subnetId,
        } satisfies AwsResourceProps,
      },
    });
  }

  // ── Intrinsic root EBS volume (part of the instance; not a standalone resource) ──
  const ebsRoot: AwsEbsRootProps = {
    kind: 'ebsRoot',
    intrinsic: true,
    volumeType: rootVolumeType,
    volumeSizeGb: rootVolumeSizeGb,
    encrypted: true,
    deleteOnTermination: true,
  };
  resources.push({
    logicalId: `${baseId}-ebs-root`,
    providerResourceType: 'BlockDeviceMapping (root EBS volume)',
    purpose:
      'Root EBS volume, created with the instance as part of its block device mapping. This is EBS, NOT S3.',
    origin: 'provider-required',
    autoIncluded: true,
    dependsOn: [baseId],
    evidence: [depEvidence('aws-ebs-root')],
    apiVersionOrSpec: catalogue.schemaOrApiVersion,
    securityNotes: ['EBS volumes should be encrypted; access is controlled by the instance.'],
    costNotes: ['Root EBS volume incurs per-GB storage cost for the lab duration.'],
    warnings: [],
    properties: {
      dependencyIdentifier: 'aws-ebs-root',
      forCompute: baseId,
      aws: ebsRoot,
    },
  });

  // ── EC2 instance (primary) ──
  const instanceEvidence = usingDefaultAmi
    ? [
        ...catalogue.evidence,
        appDefaultEvidence(
          `Default ${compute.osFamily} SSM AMI parameter applied; review and change if a specific AMI is required.`,
        ),
      ]
    : catalogue.evidence;

  const keyNameParam =
    awsCfg && awsCfg.keyPairStrategy === 'existing-name' && awsCfg.keyPairName
      ? KEY_PAIR_NAME_PARAM
      : null;

  const instanceProps: AwsInstanceProps = {
    kind: 'instance',
    logicalName: baseId,
    instanceType: compute.sizeId,
    imageId: ami,
    subnetLogicalId: subnetId,
    securityGroupLogicalIds: [sgId],
    userDataBase64,
    keyNameParam,
    blockDeviceMappings: [ebsRoot],
    associatePublicIpAddress: compute.publicIpRequested,
  };

  const instanceDependsOn = [subnetId, sgId];
  if (isIncluded('aws-route-table')) instanceDependsOn.push(rtId);

  resources.push({
    logicalId: baseId,
    providerResourceType: 'AWS::EC2::Instance',
    purpose: `Primary EC2 instance for the lab (${compute.osFamily}).`,
    origin: 'user',
    autoIncluded: false,
    dependsOn: instanceDependsOn,
    evidence: instanceEvidence,
    apiVersionOrSpec: catalogue.schemaOrApiVersion,
    securityNotes: [
      keyNameParam
        ? 'SSH key pair name supplied via parameter; private key never embedded.'
        : 'No SSH key pair configured; access via SSM Session Manager or a supplied key at deploy time.',
    ],
    costNotes: size?.costFlag ? ['Selected instance type carries elevated cost risk.'] : [],
    warnings: [
      ...(size ? [] : [`Compute size "${compute.sizeId}" was not found in the catalogue.`]),
      ...(usingSsmParameter
        ? []
        : ['Explicit AMI ids are region-specific; verify the AMI exists in the target region.']),
    ],
    properties: {
      sizeId: compute.sizeId,
      osFamily: compute.osFamily,
      count: compute.count,
      authMethod: compute.authMethod,
      publicIpRequested: compute.publicIpRequested,
      aws: instanceProps,
    },
  });

  // ── Findings ──
  for (const id of ['aws-vpc', 'aws-subnet', 'aws-security-group', 'aws-ebs-root'] as const) {
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
      name: `${baseId}PublicIp`,
      description: 'Public IP address of the EC2 instance.',
      valueExpression: `!GetAtt ${baseId}.PublicIp`,
    });
  }

  if (size?.costFlag) {
    const cost = findingFromCostRule('cost-gpu-oversized', baseId);
    if (cost) findings.push(cost);
  }

  outputs.push({
    name: `${baseId}InstanceId`,
    description: 'ID of the EC2 instance.',
    valueExpression: `!Ref ${baseId}`,
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
    if (storage.kind === 'aws-ebs-volume') {
      const catalogue = findResource('aws', 'aws-ebs-volume');
      const props: AwsEbsVolumeProps = {
        kind: 'ebsVolume',
        logicalName: storage.id,
        sizeGb: storage.sizeGb ?? 64,
        volumeType: 'gp3',
        encrypted: true,
        attachedToInstanceLogicalId: null,
      };
      resources.push({
        logicalId: storage.id,
        providerResourceType: 'AWS::EC2::Volume',
        purpose: `Standalone EBS volume (${storage.sizeGb ?? 64} GB, encrypted).`,
        origin: 'user',
        autoIncluded: false,
        dependsOn: [],
        evidence: catalogue?.evidence ?? [evidenceRefFromId('aws-ebs-volume-doc')],
        apiVersionOrSpec: catalogue?.schemaOrApiVersion ?? '2010-09-09',
        securityNotes: ['EBS volume is encrypted by default.'],
        costNotes: [
          `Incurs per-GB storage cost for ${storage.sizeGb ?? 64} GB for the lab duration.`,
        ],
        warnings: [],
        properties: { aws: props satisfies AwsResourceProps },
      });
    }

    if (storage.kind === 'aws-s3-bucket') {
      const catalogue = findResource('aws', 'aws-s3-bucket');
      const props: AwsS3BucketProps = {
        kind: 's3Bucket',
        logicalName: storage.id,
        publicAccessBlocked: storage.publicAccessBlocked,
        bucketEncryption: true,
      };
      resources.push({
        logicalId: storage.id,
        providerResourceType: 'AWS::S3::Bucket',
        purpose: `S3 bucket${storage.publicAccessBlocked ? ' (public access blocked, encrypted)' : ' (public access enabled — review required)'}.`,
        origin: 'user',
        autoIncluded: false,
        dependsOn: [],
        evidence: catalogue?.evidence ?? [evidenceRefFromId('aws-s3-bucket-doc')],
        apiVersionOrSpec: catalogue?.schemaOrApiVersion ?? '2010-09-09',
        securityNotes: [
          storage.publicAccessBlocked
            ? 'Public access is blocked via BlockPublicAcls, BlockPublicPolicy, IgnorePublicAcls, RestrictPublicBuckets.'
            : 'Public access is enabled. This is a security risk; confirm it is intentional.',
        ],
        costNotes: ['S3 charges per GB stored and per request. Lifecycle rules can reduce cost.'],
        warnings: storage.publicAccessBlocked ? [] : ['Public access is enabled on this bucket.'],
        properties: { aws: props satisfies AwsResourceProps },
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
    if (identity.kind !== 'aws-iam-role') continue;
    const catalogue = findResource('aws', 'aws-iam-role');
    const roleName = identity.name.replace(/[^a-zA-Z0-9_-]/g, '-');
    const props: AwsIamRoleProps = {
      kind: 'iamRole',
      logicalName: identity.id,
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'ec2.amazonaws.com' },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      purpose: identity.purpose,
    };
    resources.push({
      logicalId: identity.id,
      providerResourceType: 'AWS::IAM::Role',
      purpose: `IAM role: ${identity.purpose}`,
      origin: 'user',
      autoIncluded: false,
      dependsOn: [],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('aws-iam-role-doc')],
      apiVersionOrSpec: catalogue?.schemaOrApiVersion ?? '2010-09-09',
      securityNotes: [
        'Generated with a minimal trust policy. Permissions must be scoped to least privilege.',
      ],
      costNotes: ['No direct charge for the IAM role.'],
      warnings: [
        'Generated role has a basic EC2 trust policy; review and scope permissions separately.',
      ],
      properties: { aws: props satisfies AwsResourceProps, roleName },
    });
    findings.push({
      id: `identity-least-privilege:${identity.id}`,
      kind: 'security',
      severity: 'info',
      category: 'Identity',
      description: `IAM role "${roleName}" was created with a basic trust policy. Managed policies are not attached.`,
      recommendation:
        'Attach the minimum required managed or inline policies. Avoid AdministratorAccess.',
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
    if (app.kind !== 'aws-app-runner') continue;
    const catalogue = findResource('aws', 'aws-app-runner');
    const props: AwsAppRunnerProps = {
      kind: 'appRunner',
      logicalName: app.id,
      runtime: app.runtime,
      imageRef: app.imageRef,
      publicEndpointRequested: app.publicEndpointRequested,
      environmentVariables: app.environmentVariables,
    };
    resources.push({
      logicalId: app.id,
      providerResourceType: 'AWS::AppRunner::Service',
      purpose: `AWS App Runner service hosting a ${app.runtime} application from image ${app.imageRef}.`,
      origin: 'user',
      autoIncluded: false,
      dependsOn: [],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('aws-app-runner-doc')],
      apiVersionOrSpec: catalogue?.schemaOrApiVersion ?? '2010-09-09',
      securityNotes: [
        app.publicEndpointRequested
          ? 'Public endpoint is enabled. Restrict access as needed.'
          : 'No public endpoint; private access only.',
      ],
      costNotes: ['App Runner charges per second of compute and per GB of memory used.'],
      warnings: [],
      properties: { aws: props satisfies AwsResourceProps },
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
    if (fn.kind !== 'aws-lambda') continue;
    const catalogue = findResource('aws', 'aws-lambda');

    // Auto-included execution role.
    const executionRoleLogicalId = `${fn.id}ExecutionRole`;
    const roleProps: AwsIamRoleProps = {
      kind: 'iamRole',
      logicalName: executionRoleLogicalId,
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      purpose: `Lambda execution role for ${fn.name}`,
    };
    resources.push({
      logicalId: executionRoleLogicalId,
      providerResourceType: 'AWS::IAM::Role',
      purpose: `Auto-included IAM execution role for Lambda function ${fn.name}.`,
      origin: 'provider-required',
      autoIncluded: true,
      dependsOn: [],
      evidence: [evidenceRefFromId('aws-iam-role-doc')],
      apiVersionOrSpec: '2010-09-09',
      securityNotes: [
        'Minimal trust policy for Lambda. Add only the permissions the function needs.',
      ],
      costNotes: ['No direct charge for the IAM role.'],
      warnings: [],
      properties: { aws: roleProps satisfies AwsResourceProps },
    });
    findings.push({
      id: `auto-included:${executionRoleLogicalId}`,
      kind: 'dependency',
      severity: 'info',
      category: 'Auto-included dependency',
      description: `"AWS::IAM::Role" was automatically included because a Lambda function requires an execution role.`,
      recommendation: 'Review the auto-included role. Add only the permissions the function needs.',
      affectedResource: executionRoleLogicalId,
      evidence: evidenceRefFromId('aws-iam-role-doc'),
    });

    const fnProps: AwsLambdaProps = {
      kind: 'lambda',
      logicalName: fn.id,
      runtime: fn.runtime,
      handler: fn.handler,
      codeArtifact: fn.codeArtifact,
      memoryMb: fn.memoryMb,
      timeoutSeconds: fn.timeoutSeconds,
      httpTriggerRequested: fn.httpTriggerRequested,
      executionRoleLogicalId,
      environmentVariables: fn.environmentVariables,
    };
    resources.push({
      logicalId: fn.id,
      providerResourceType: 'AWS::Lambda::Function',
      purpose: `AWS Lambda function (${fn.runtime}, ${fn.memoryMb} MB, ${fn.timeoutSeconds}s timeout).`,
      origin: 'user',
      autoIncluded: false,
      dependsOn: [executionRoleLogicalId],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('aws-lambda-doc')],
      apiVersionOrSpec: catalogue?.schemaOrApiVersion ?? '2010-09-09',
      securityNotes: [
        fn.httpTriggerRequested
          ? 'HTTP trigger is enabled via Function URL. Secure the endpoint with auth.'
          : 'No HTTP trigger; function is invoked by other triggers only.',
      ],
      costNotes: ['Lambda charges per request and per GB-second of compute.'],
      warnings: [],
      properties: { aws: fnProps satisfies AwsResourceProps },
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
    if (ctr.kind !== 'aws-ecs-fargate') continue;
    const catalogue = findResource('aws', 'aws-ecs-fargate');

    // Auto-included task execution role.
    const executionRoleLogicalId = `${ctr.id}ExecutionRole`;
    const roleProps: AwsIamRoleProps = {
      kind: 'iamRole',
      logicalName: executionRoleLogicalId,
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'ecs-tasks.amazonaws.com' },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      purpose: `ECS task execution role for ${ctr.name}`,
    };
    resources.push({
      logicalId: executionRoleLogicalId,
      providerResourceType: 'AWS::IAM::Role',
      purpose: `Auto-included IAM task execution role for ECS Fargate task ${ctr.name}.`,
      origin: 'provider-required',
      autoIncluded: true,
      dependsOn: [],
      evidence: [evidenceRefFromId('aws-iam-role-doc')],
      apiVersionOrSpec: '2010-09-09',
      securityNotes: [
        'Minimal trust policy for ECS tasks. Add only the permissions the task needs.',
      ],
      costNotes: ['No direct charge for the IAM role.'],
      warnings: [],
      properties: { aws: roleProps satisfies AwsResourceProps },
    });
    findings.push({
      id: `auto-included:${executionRoleLogicalId}`,
      kind: 'dependency',
      severity: 'info',
      category: 'Auto-included dependency',
      description: `"AWS::IAM::Role" was automatically included because a Fargate task requires an execution role.`,
      recommendation: 'Review the auto-included role. Add only the permissions the task needs.',
      affectedResource: executionRoleLogicalId,
      evidence: evidenceRefFromId('aws-iam-role-doc'),
    });

    const clusterId = `${ctr.id}Cluster`;
    const taskDefId = `${ctr.id}TaskDef`;
    const serviceId = ctr.id;

    // Cluster
    resources.push({
      logicalId: clusterId,
      providerResourceType: 'AWS::ECS::Cluster',
      purpose: `ECS cluster for container ${ctr.name}.`,
      origin: 'provider-required',
      autoIncluded: true,
      dependsOn: [],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('aws-ecs-fargate-doc')],
      apiVersionOrSpec: catalogue?.schemaOrApiVersion ?? '2010-09-09',
      securityNotes: [
        'Cluster is a logical grouping; security is governed by the task and service configuration.',
      ],
      costNotes: ['No direct charge for the cluster. Fargate charges per vCPU and GB of memory.'],
      warnings: [],
      properties: {
        aws: {
          kind: 'ecsFargate',
          logicalName: clusterId,
          image: '',
          cpu: 0,
          memoryMb: 0,
          port: 0,
          publicEndpointRequested: false,
          executionRoleLogicalId: null,
          environmentVariables: [],
        } satisfies AwsResourceProps,
      },
    });

    // Task definition
    const taskProps: AwsEcsFargateProps = {
      kind: 'ecsFargate',
      logicalName: taskDefId,
      image: ctr.image,
      cpu: ctr.cpu,
      memoryMb: Math.round(ctr.memoryGb * 1024),
      port: ctr.port,
      publicEndpointRequested: ctr.publicEndpointRequested,
      executionRoleLogicalId,
      environmentVariables: ctr.environmentVariables,
    };
    resources.push({
      logicalId: taskDefId,
      providerResourceType: 'AWS::ECS::TaskDefinition',
      purpose: `Fargate task definition for ${ctr.image} (${ctr.cpu} CPU, ${ctr.memoryGb} GB RAM).`,
      origin: 'user',
      autoIncluded: false,
      dependsOn: [executionRoleLogicalId],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('aws-ecs-fargate-doc')],
      apiVersionOrSpec: catalogue?.schemaOrApiVersion ?? '2010-09-09',
      securityNotes: ['Task execution role is scoped to pull images and publish logs.'],
      costNotes: ['Fargate charges per vCPU-second and GB-memory-second.'],
      warnings: [],
      properties: { aws: taskProps satisfies AwsResourceProps },
    });

    // Service
    resources.push({
      logicalId: serviceId,
      providerResourceType: 'AWS::ECS::Service',
      purpose: `ECS Fargate service running ${ctr.image} on port ${ctr.port}.`,
      origin: 'user',
      autoIncluded: false,
      dependsOn: [clusterId, taskDefId],
      evidence: catalogue?.evidence ?? [evidenceRefFromId('aws-ecs-fargate-doc')],
      apiVersionOrSpec: catalogue?.schemaOrApiVersion ?? '2010-09-09',
      securityNotes: [
        ctr.publicEndpointRequested
          ? 'Public port is exposed via the load balancer. Restrict access as needed.'
          : 'No public endpoint; private access only.',
      ],
      costNotes: ['Fargate charges per vCPU and GB of memory while the service is running.'],
      warnings: [],
      properties: { aws: { ...taskProps, logicalName: serviceId } satisfies AwsResourceProps },
    });

    if (ctr.publicEndpointRequested) {
      const sec = findingFromSecurityRule('sec-public-ip', ctr.id);
      if (sec) findings.push(sec);
    }
  }

  return { resources, findings };
}

export function buildAwsModel(spec: LabSpecification): InternalModel {
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

  const awsCfg = spec.providerConfig.kind === 'aws' ? spec.providerConfig.aws : null;
  const useKeyPair = awsCfg?.keyPairStrategy === 'existing-name';

  const parameters: ParameterDef[] =
    spec.compute.length > 0
      ? [
          {
            name: ADMIN_USERNAME_PARAM,
            type: 'string',
            description: 'Administrative username for the EC2 instance.',
            defaultValue: 'ec2-user',
            secure: false,
          },
          {
            name: ADMIN_SECRET_PARAM,
            type: 'securestring',
            description:
              'Administrative password or key material, supplied at deployment time. Never stored in the template.',
            secure: true,
          },
          ...(useKeyPair
            ? [
                {
                  name: KEY_PAIR_NAME_PARAM,
                  type: 'string' as const,
                  description:
                    'Name of an existing EC2 key pair. The private key is never stored in the template.',
                  defaultValue: awsCfg?.keyPairName ?? '',
                  secure: false,
                },
              ]
            : []),
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

  return { provider: 'aws', resources, parameters, outputs, findings };
}
