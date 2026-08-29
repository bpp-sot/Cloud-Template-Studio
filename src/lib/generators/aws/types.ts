// Concrete AWS resource property bags carried on GeneratedResource.properties.aws.
//
// The AWS normaliser (src/lib/normalise/aws-model.ts) produces these, and the
// CloudFormation YAML / JSON generators consume them. Keeping the shape here
// means both emitters render from exactly the same structured description — no
// drift between YAML and JSON, and no drift between the generated template and
// the review/inventory.

export interface AwsVpcProps {
  kind: 'vpc';
  logicalName: string;
  cidrBlock: string;
  enableDnsSupport: boolean;
  enableDnsHostnames: boolean;
}

export interface AwsSubnetProps {
  kind: 'subnet';
  logicalName: string;
  cidrBlock: string;
  vpcLogicalId: string;
  /** Only true when the author explicitly requested public access. */
  mapPublicIpOnLaunch: boolean;
  availabilityZone: string | null;
}

export interface AwsSecurityGroupIngressRule {
  fromPort: number;
  toPort: number;
  ipProtocol: 'tcp' | 'udp' | '-1';
  cidrIp: string;
  description: string;
}

export interface AwsSecurityGroupProps {
  kind: 'securityGroup';
  logicalName: string;
  groupDescription: string;
  vpcLogicalId: string;
  ingressRules: AwsSecurityGroupIngressRule[];
}

export interface AwsInternetGatewayProps {
  kind: 'internetGateway';
  logicalName: string;
  vpcLogicalId: string;
}

export interface AwsRouteTableProps {
  kind: 'routeTable';
  logicalName: string;
  vpcLogicalId: string;
  gatewayLogicalId: string;
  subnetLogicalId: string;
}

/** Intrinsic root EBS volume — part of the instance's BlockDeviceMappings. */
export interface AwsEbsRootProps {
  kind: 'ebsRoot';
  intrinsic: true;
  volumeType: 'gp3' | 'gp2' | 'io1' | 'io2' | 'st1' | 'sc1' | 'standard';
  volumeSizeGb: number;
  encrypted: boolean;
  deleteOnTermination: boolean;
}

export interface AwsInstanceProps {
  kind: 'instance';
  logicalName: string;
  instanceType: string;
  /** Resolved AMI id expression, e.g. "{{resolve:ssm:..."}} or a literal ami id. */
  imageId: string;
  subnetLogicalId: string;
  securityGroupLogicalIds: string[];
  /** Base64 user-data, when an initialisation script targets this instance. */
  userDataBase64: string | null;
  keyNameParam: string | null;
  blockDeviceMappings: AwsEbsRootProps[];
  associatePublicIpAddress: boolean;
}

// ── Phase 5: Advanced resource property bags ──

export interface AwsEbsVolumeProps {
  kind: 'ebsVolume';
  logicalName: string;
  sizeGb: number;
  volumeType: 'gp3' | 'gp2' | 'io1' | 'io2' | 'st1' | 'sc1' | 'standard';
  encrypted: boolean;
  /** Logical id of the EC2 instance this volume is attached to, when applicable. */
  attachedToInstanceLogicalId: string | null;
}

export interface AwsS3BucketProps {
  kind: 's3Bucket';
  logicalName: string;
  /** Only true when the author explicitly opted in to public access. */
  publicAccessBlocked: boolean;
  bucketEncryption: boolean;
}

export interface AwsIamRoleProps {
  kind: 'iamRole';
  logicalName: string;
  /** JSON trust policy document (who can assume the role). */
  assumeRolePolicyDocument: object;
  /** Purpose description from the spec. */
  purpose: string;
}

export interface AwsAppRunnerProps {
  kind: 'appRunner';
  logicalName: string;
  runtime: string;
  imageRef: string;
  publicEndpointRequested: boolean;
  environmentVariables: Array<{ key: string; value: string }>;
}

export interface AwsLambdaProps {
  kind: 'lambda';
  logicalName: string;
  runtime: string;
  handler: string;
  codeArtifact: string;
  memoryMb: number;
  timeoutSeconds: number;
  httpTriggerRequested: boolean;
  /** Logical id of the auto-included execution role. */
  executionRoleLogicalId: string | null;
  environmentVariables: Array<{ key: string; value: string }>;
}

export interface AwsEcsFargateProps {
  kind: 'ecsFargate';
  logicalName: string;
  image: string;
  cpu: number;
  memoryMb: number;
  port: number;
  publicEndpointRequested: boolean;
  /** Logical id of the auto-included task execution role. */
  executionRoleLogicalId: string | null;
  environmentVariables: Array<{ key: string; value: string }>;
}

export type AwsResourceProps =
  | AwsVpcProps
  | AwsSubnetProps
  | AwsSecurityGroupProps
  | AwsInternetGatewayProps
  | AwsRouteTableProps
  | AwsEbsRootProps
  | AwsInstanceProps
  | AwsEbsVolumeProps
  | AwsS3BucketProps
  | AwsIamRoleProps
  | AwsAppRunnerProps
  | AwsLambdaProps
  | AwsEcsFargateProps;
