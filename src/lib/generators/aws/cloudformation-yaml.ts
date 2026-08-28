// AWS CloudFormation YAML generator — Development Brief §10.3.
//
// Produces a CloudFormation YAML template from the AWS InternalModel. The
// generator consumes ONLY the InternalModel, never the raw wizard state.
// Deterministic output enables snapshot/regression testing.
//
// YAML is emitted by a small, dedicated emitter to avoid adding a runtime
// dependency. The shape is intentionally simple: maps, scalars, short lists
// of scalars, and block-style nested mappings.

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

function ref(logicalId: string): string {
  return `!Ref ${logicalId}`;
}

function yq(value: unknown): string {
  // Quote strings that contain special YAML characters, colons, or leading
  // braces. CloudFormation intrinsics (!Ref, !GetAtt) MUST stay unquoted so
  // YAML parses them as tags, not string literals.
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  const s = String(value);
  if (s.startsWith('!')) return s;
  if (s.includes(':') || s.includes('#') || s.includes('{') || s.includes('}')) {
    return `'${s.replace(/'/g, "''")}'`;
  }
  if (/^[A-Za-z0-9._-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "''")}'`;
}

/** Indent every line of a block by `n` spaces. */
function indent(block: string, n: number): string {
  const pad = ' '.repeat(n);
  return block
    .split('\n')
    .map((l) => (l.length ? pad + l : l))
    .join('\n');
}

function scalarList(items: string[], indentSize: number): string {
  return items.map((i) => `${' '.repeat(indentSize)}- ${i}`).join('\n');
}

/** Render a nested mapping as block-style YAML. */
function mapping(obj: Record<string, unknown>, indentSize: number): string {
  const pad = ' '.repeat(indentSize);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const child = mapping(value as Record<string, unknown>, indentSize + 2);
      lines.push(`${pad}${key}:`, child);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
      } else if (value.every((v) => typeof v !== 'object')) {
        const items = value.map((v) => `${pad}  - ${yq(v)}`).join('\n');
        lines.push(`${pad}${key}:`, items);
      } else {
        const items = value
          .map((v) => {
            if (typeof v === 'object' && v !== null) {
              const inner = mapping(v as Record<string, unknown>, indentSize + 4);
              return `${pad}  -\n${inner}`;
            }
            return `${pad}  - ${yq(v)}`;
          })
          .join('\n');
        lines.push(`${pad}${key}:`, items);
      }
    } else {
      lines.push(`${pad}${key}: ${yq(value)}`);
    }
  }
  return lines.join('\n');
}

function parametersBlock(params: ParameterDef[]): string {
  if (params.length === 0) return 'Parameters: {}';
  const entries = params.map((p) => {
    const obj: Record<string, unknown> = {
      Type: p.type === 'securestring' ? 'String' : p.type === 'string' ? 'String' : p.type,
      Description: p.description,
    };
    if (p.defaultValue !== undefined && !p.secure) obj.Default = p.defaultValue;
    if (p.secure) obj.NoEcho = true;
    return `${p.name}:\n${indent(mapping(obj, 0), 2)}`;
  });
  return `Parameters:\n${entries.map((e) => indent(e, 2)).join('\n')}`;
}

function vpcResource(p: AwsVpcProps): string {
  return mapping(
    {
      Type: 'AWS::EC2::VPC',
      Properties: {
        CidrBlock: p.cidrBlock,
        EnableDnsSupport: p.enableDnsSupport,
        EnableDnsHostnames: p.enableDnsHostnames,
        Tags: [{ Key: 'Name', Value: p.logicalName }],
      },
    },
    2,
  );
}

function subnetResource(p: AwsSubnetProps): string {
  return mapping(
    {
      Type: 'AWS::EC2::Subnet',
      Properties: {
        VpcId: ref(p.vpcLogicalId),
        CidrBlock: p.cidrBlock,
        MapPublicIpOnLaunch: p.mapPublicIpOnLaunch,
        Tags: [{ Key: 'Name', Value: p.logicalName }],
      },
    },
    2,
  );
}

function securityGroupResource(p: AwsSecurityGroupProps): string {
  const ingress = p.ingressRules.map((r) => ({
    IpProtocol: r.ipProtocol,
    FromPort: r.fromPort,
    ToPort: r.toPort,
    CidrIp: r.cidrIp,
    Description: r.description,
  }));
  return mapping(
    {
      Type: 'AWS::EC2::SecurityGroup',
      Properties: {
        GroupDescription: p.groupDescription,
        VpcId: ref(p.vpcLogicalId),
        SecurityGroupIngress: ingress,
        SecurityGroupEgress: [
          {
            IpProtocol: '-1',
            CidrIp: '0.0.0.0/0',
            Description: 'Default outbound egress',
          },
        ],
      },
    },
    2,
  );
}

function internetGatewayResource(p: AwsInternetGatewayProps): string {
  return mapping(
    {
      Type: 'AWS::EC2::InternetGateway',
      Properties: {
        Tags: [{ Key: 'Name', Value: p.logicalName }],
      },
    },
    2,
  );
}

function routeTableResource(p: AwsRouteTableProps): string {
  return mapping(
    {
      Type: 'AWS::EC2::RouteTable',
      Properties: {
        VpcId: ref(p.vpcLogicalId),
        Tags: [{ Key: 'Name', Value: p.logicalName }],
      },
    },
    2,
  );
}

// CloudFormation YAML supports multiple resources of the same type, but the
// route + gateway attachment need their own resource entries. We emit them
// alongside the route table as separate resources in the resource map.

function instanceResource(p: AwsInstanceProps): string {
  const blockDeviceMappings = p.blockDeviceMappings.map((d) => ({
    DeviceName: '/dev/sda1',
    Ebs: {
      VolumeType: d.volumeType,
      VolumeSize: d.volumeSizeGb,
      Encrypted: d.encrypted,
      DeleteOnTermination: d.deleteOnTermination,
    },
  }));
  const props: Record<string, unknown> = {
    InstanceType: p.instanceType,
    ImageId: p.imageId,
    SubnetId: ref(p.subnetLogicalId),
    SecurityGroupIds: p.securityGroupLogicalIds.map((id) => ref(id)),
    BlockDeviceMappings: blockDeviceMappings,
    Tags: [{ Key: 'Name', Value: p.logicalName }],
  };
  if (p.associatePublicIpAddress) {
    props.AssociatePublicIpAddress = true;
  }
  if (p.keyNameParam) {
    props.KeyName = `!Ref ${p.keyNameParam}`;
  }
  if (p.userDataBase64) {
    props.UserData = p.userDataBase64;
  }
  return mapping(
    {
      Type: 'AWS::EC2::Instance',
      Properties: props,
    },
    2,
  );
}

function resourceEntry(r: GeneratedResource): string | null {
  const p = awsProps(r);
  if (!p || p.kind === 'ebsRoot') return null;
  switch (p.kind) {
    case 'vpc':
      return `${r.logicalId}:\n${vpcResource(p)}`;
    case 'subnet':
      return `${r.logicalId}:\n${subnetResource(p)}`;
    case 'securityGroup':
      return `${r.logicalId}:\n${securityGroupResource(p)}`;
    case 'internetGateway':
      return `${r.logicalId}:\n${internetGatewayResource(p)}`;
    case 'routeTable':
      return `${r.logicalId}:\n${routeTableResource(p)}`;
    case 'instance':
      return `${r.logicalId}:\n${instanceResource(p)}`;
  }
}

function outputsBlock(model: InternalModel): string {
  if (model.outputs.length === 0) return 'Outputs: {}';
  const entries = model.outputs.map((o) => {
    const value = o.valueExpression.startsWith('!')
      ? o.valueExpression
      : `!Ref ${o.valueExpression}`;
    return `${o.name}:\n${indent(mapping({ Value: value, Description: o.description }, 0), 2)}`;
  });
  return `Outputs:\n${entries.map((e) => indent(e, 2)).join('\n')}`;
}

export function generateCloudFormationYaml(model: InternalModel): string {
  const header = [
    '# Generated by SoT Cloud Template Studio.',
    '# Design secure cloud lab infrastructure without writing templates from scratch.',
    '#',
    '# Every resource below is traceable to evidence in the review. This template',
    '# must be tested in a non-production environment before Skillable use.',
    '',
    `AWSTemplateFormatVersion: '2010-09-09'`,
    `Description: '${APP_INFO.name} ${APP_INFO.version} — generated independently from the InternalModel. Test in a non-production environment before Skillable use.'`,
    '',
  ].join('\n');

  const resources = model.resources
    .map(resourceEntry)
    .filter((s): s is string => s !== null)
    .map((s) => indent(s, 2))
    .join('\n');

  // Add IGW attachment + route + subnet association as derived resources.
  const derived: string[] = [];
  for (const r of model.resources) {
    const p = awsProps(r);
    if (p && p.kind === 'internetGateway') {
      derived.push(
        indent(
          `${p.logicalName}Attachment:\n${indent(
            mapping(
              {
                Type: 'AWS::EC2::VPCGatewayAttachment',
                Properties: {
                  VpcId: ref(p.vpcLogicalId),
                  InternetGatewayId: ref(p.logicalName),
                },
              },
              2,
            ),
            2,
          )}`,
          2,
        ),
      );
    }
    if (p && p.kind === 'routeTable') {
      derived.push(
        indent(
          `${p.logicalName}DefaultRoute:\n${indent(
            mapping(
              {
                Type: 'AWS::EC2::Route',
                DependsOn: `${p.gatewayLogicalId}Attachment`,
                Properties: {
                  RouteTableId: ref(p.logicalName),
                  DestinationCidrBlock: '0.0.0.0/0',
                  GatewayId: ref(p.gatewayLogicalId),
                },
              },
              2,
            ),
            2,
          )}`,
          2,
        ),
      );
      derived.push(
        indent(
          `${p.logicalName}SubnetAssociation:\n${indent(
            mapping(
              {
                Type: 'AWS::EC2::SubnetRouteTableAssociation',
                Properties: {
                  RouteTableId: ref(p.logicalName),
                  SubnetId: ref(p.subnetLogicalId),
                },
              },
              2,
            ),
            2,
          )}`,
          2,
        ),
      );
    }
  }

  const resourcesBlock =
    resources.length || derived.length
      ? `Resources:\n${[resources, ...derived].filter((s) => s.trim()).join('\n')}`
      : 'Resources: {}';

  return (
    [header, parametersBlock(model.parameters), '', resourcesBlock, '', outputsBlock(model)]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

// Re-export helper for the JSON generator.
export { scalarList, mapping, indent };
