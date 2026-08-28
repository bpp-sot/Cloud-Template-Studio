// AWS CloudFormation JSON generator — Development Brief §10.3.
//
// Produces a CloudFormation JSON template from the AWS InternalModel. Like the
// Azure ARM generator, this is generated INDEPENDENTLY from the same
// InternalModel as the YAML output. It is NOT converted from YAML. Equivalence
// is asserted by fixture-based tests.

import type { GeneratedResource, InternalModel, ParameterDef } from '@/types';
import { APP_INFO } from '@/lib/app-info';
import type {
  AwsInstanceProps,
  AwsInternetGatewayProps,
  AwsResourceProps,
  AwsRouteTableProps,
  AwsSecurityGroupProps,
  AwsSubnetProps,
  AwsVpcProps,
} from './types';

function awsProps(r: GeneratedResource): AwsResourceProps | undefined {
  return (r.properties as { aws?: AwsResourceProps }).aws;
}

function ref(logicalId: string): Record<string, unknown> {
  return { Ref: logicalId };
}

function parametersObject(params: ParameterDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of params) {
    const entry: Record<string, unknown> = {
      Type: p.type === 'securestring' || p.type === 'string' ? 'String' : p.type,
      Description: p.description,
    };
    if (p.defaultValue !== undefined && !p.secure) entry.Default = p.defaultValue;
    if (p.secure) entry.NoEcho = true;
    out[p.name] = entry;
  }
  return out;
}

function vpcResource(p: AwsVpcProps): Record<string, unknown> {
  return {
    Type: 'AWS::EC2::VPC',
    Properties: {
      CidrBlock: p.cidrBlock,
      EnableDnsSupport: p.enableDnsSupport,
      EnableDnsHostnames: p.enableDnsHostnames,
      Tags: [{ Key: 'Name', Value: p.logicalName }],
    },
  };
}

function subnetResource(p: AwsSubnetProps): Record<string, unknown> {
  return {
    Type: 'AWS::EC2::Subnet',
    Properties: {
      VpcId: ref(p.vpcLogicalId),
      CidrBlock: p.cidrBlock,
      MapPublicIpOnLaunch: p.mapPublicIpOnLaunch,
      Tags: [{ Key: 'Name', Value: p.logicalName }],
    },
  };
}

function securityGroupResource(p: AwsSecurityGroupProps): Record<string, unknown> {
  return {
    Type: 'AWS::EC2::SecurityGroup',
    Properties: {
      GroupDescription: p.groupDescription,
      VpcId: ref(p.vpcLogicalId),
      SecurityGroupIngress: p.ingressRules.map((r) => ({
        IpProtocol: r.ipProtocol,
        FromPort: r.fromPort,
        ToPort: r.toPort,
        CidrIp: r.cidrIp,
        Description: r.description,
      })),
      SecurityGroupEgress: [
        {
          IpProtocol: '-1',
          CidrIp: '0.0.0.0/0',
          Description: 'Default outbound egress',
        },
      ],
    },
  };
}

function internetGatewayResource(p: AwsInternetGatewayProps): Record<string, unknown> {
  return {
    Type: 'AWS::EC2::InternetGateway',
    Properties: {
      Tags: [{ Key: 'Name', Value: p.logicalName }],
    },
  };
}

function routeTableResource(p: AwsRouteTableProps): Record<string, unknown> {
  return {
    Type: 'AWS::EC2::RouteTable',
    Properties: {
      VpcId: ref(p.vpcLogicalId),
      Tags: [{ Key: 'Name', Value: p.logicalName }],
    },
  };
}

function instanceResource(p: AwsInstanceProps): Record<string, unknown> {
  const props: Record<string, unknown> = {
    InstanceType: p.instanceType,
    ImageId: p.imageId,
    SubnetId: ref(p.subnetLogicalId),
    SecurityGroupIds: p.securityGroupLogicalIds.map((id) => ref(id)),
    BlockDeviceMappings: p.blockDeviceMappings.map((d) => ({
      DeviceName: '/dev/sda1',
      Ebs: {
        VolumeType: d.volumeType,
        VolumeSize: d.volumeSizeGb,
        Encrypted: d.encrypted,
        DeleteOnTermination: d.deleteOnTermination,
      },
    })),
    Tags: [{ Key: 'Name', Value: p.logicalName }],
  };
  if (p.associatePublicIpAddress) props.AssociatePublicIpAddress = true;
  if (p.keyNameParam) props.KeyName = ref(p.keyNameParam);
  if (p.userDataBase64) props.UserData = p.userDataBase64;
  return { Type: 'AWS::EC2::Instance', Properties: props };
}

function resourceObject(r: GeneratedResource): Record<string, unknown> | null {
  const p = awsProps(r);
  if (!p || p.kind === 'ebsRoot') return null;
  switch (p.kind) {
    case 'vpc':
      return vpcResource(p);
    case 'subnet':
      return subnetResource(p);
    case 'securityGroup':
      return securityGroupResource(p);
    case 'internetGateway':
      return internetGatewayResource(p);
    case 'routeTable':
      return routeTableResource(p);
    case 'instance':
      return instanceResource(p);
  }
}

function outputValue(expr: string): unknown {
  // Convert Bicep-style or CFN intrinsic expressions to JSON intrinsics.
  if (expr.startsWith('!Ref ')) return { Ref: expr.slice(5).trim() };
  if (expr.startsWith('!GetAtt ')) {
    const parts = expr.slice(8).split('.');
    return { 'Fn::GetAtt': parts };
  }
  return expr;
}

export function generateCloudFormationJson(model: InternalModel): string {
  const resources: Record<string, unknown> = {};
  for (const r of model.resources) {
    const obj = resourceObject(r);
    if (obj) resources[r.logicalId] = obj;
  }

  // Derived resources: IGW attachment, default route, subnet association.
  for (const r of model.resources) {
    const p = awsProps(r);
    if (p && p.kind === 'internetGateway') {
      resources[`${p.logicalName}Attachment`] = {
        Type: 'AWS::EC2::VPCGatewayAttachment',
        Properties: {
          VpcId: ref(p.vpcLogicalId),
          InternetGatewayId: ref(p.logicalName),
        },
      };
    }
    if (p && p.kind === 'routeTable') {
      resources[`${p.logicalName}DefaultRoute`] = {
        Type: 'AWS::EC2::Route',
        DependsOn: `${p.gatewayLogicalId}Attachment`,
        Properties: {
          RouteTableId: ref(p.logicalName),
          DestinationCidrBlock: '0.0.0.0/0',
          GatewayId: ref(p.gatewayLogicalId),
        },
      };
      resources[`${p.logicalName}SubnetAssociation`] = {
        Type: 'AWS::EC2::SubnetRouteTableAssociation',
        Properties: {
          RouteTableId: ref(p.logicalName),
          SubnetId: ref(p.subnetLogicalId),
        },
      };
    }
  }

  const outputs: Record<string, unknown> = {};
  for (const o of model.outputs) {
    outputs[o.name] = { Value: outputValue(o.valueExpression), Description: o.description };
  }

  const template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: `${APP_INFO.name} ${APP_INFO.version} — generated independently from the InternalModel. Test in a non-production environment before Skillable use.`,
    Metadata: {
      _generator: { name: APP_INFO.name, version: APP_INFO.version },
      _note:
        'Generated independently from the InternalModel (not converted from YAML). Test in a non-production environment before Skillable use.',
    },
    Parameters: parametersObject(model.parameters),
    Resources: resources,
    Outputs: outputs,
  };

  return JSON.stringify(template, null, 2) + '\n';
}
