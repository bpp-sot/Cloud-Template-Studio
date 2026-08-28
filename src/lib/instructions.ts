// Learner instructions generator — Development Brief §15.
//
// Produces learner-facing Markdown from the InternalModel (the same model the
// generators consume). This guarantees instructions and templates cannot drift
// apart. The Markdown includes environment overview, provided resources,
// permitted activities, networking, storage, warnings, and support guidance.

import type { InternalModel, LabSpecification, GeneratedResource } from '@/types';
import { APP_INFO } from '@/lib/app-info';

function resourceTypeLabel(r: GeneratedResource): string {
  return r.providerResourceType;
}

export function generateLearnerInstructions(spec: LabSpecification, model: InternalModel): string {
  const lines: string[] = [];
  const provider = spec.provider;
  const providerLabel = provider === 'azure' ? 'Microsoft Azure' : 'Amazon Web Services';
  const compute = spec.compute[0];
  const net = spec.network[0];
  const meta = spec.metadata;

  // ── Title and overview ──
  lines.push(`# ${meta.projectName || 'Lab Environment'} — Learner Instructions`);
  lines.push('');
  lines.push(`> **Temporary environment warning:** This lab environment is temporary and will be`);
  lines.push(
    `> removed when the lab ends. Save any work you want to keep outside the environment.`,
  );
  lines.push('');
  lines.push(`## Environment Overview`);
  lines.push('');
  lines.push(`- **Provider:** ${providerLabel}`);
  lines.push(`- **Region:** ${spec.location.primaryRegion || 'unspecified'}`);
  lines.push(`- **Lab duration:** ${meta.labDuration || '60'} minutes`);
  lines.push(`- **Deployment model:** ${spec.deployment.model}`);
  if (compute) {
    lines.push(`- **Compute:** ${compute.name} (${compute.sizeId}, ${compute.osFamily})`);
  }
  lines.push('');

  // ── Provided resources ──
  lines.push(`## Provided Resources`);
  lines.push('');
  lines.push(`The following resources are deployed for this lab:`);
  lines.push('');
  for (const r of model.resources) {
    const origin = r.origin === 'user' ? 'primary' : 'supporting';
    lines.push(`- **${r.logicalId}** (${resourceTypeLabel(r)}) — ${r.purpose} _[${origin}]_`);
  }
  lines.push('');

  // ── Compute details ──
  if (compute) {
    lines.push(`## Compute`);
    lines.push('');
    lines.push(`- **Name:** ${compute.name}`);
    lines.push(`- **Size / Instance type:** ${compute.sizeId}`);
    lines.push(`- **OS family:** ${compute.osFamily}`);
    lines.push(`- **Authentication:** ${compute.authMethod}`);
    lines.push(
      `- **Public IP:** ${compute.publicIpRequested ? 'Yes (explicitly requested)' : 'No (private by default)'}`,
    );
    lines.push('');
  }

  // ── Networking ──
  if (net) {
    lines.push(`## Networking`);
    lines.push('');
    lines.push(`- **Network name:** ${net.name}`);
    lines.push(`- **Address space:** ${net.addressSpace}`);
    lines.push(`- **Subnet:** ${net.subnetName} (${net.subnetPrefix})`);
    if (net.inboundRules.length > 0) {
      lines.push(`- **Inbound rules:**`);
      for (const rule of net.inboundRules) {
        lines.push(`  - TCP ${rule.port} from ${rule.sourceCidr} — ${rule.description}`);
      }
    } else {
      lines.push(`- **Inbound rules:** None (default posture denies inbound traffic)`);
    }
    lines.push('');
  }

  // ── Storage ──
  const ebsOrDisk = model.resources.find(
    (r) =>
      r.properties.dependencyIdentifier === 'aws-ebs-root' ||
      r.properties.dependencyIdentifier === 'azure-vm-osdisk',
  );
  if (ebsOrDisk) {
    lines.push(`## Storage`);
    lines.push('');
    lines.push(`- **${ebsOrDisk.logicalId}** — ${ebsOrDisk.purpose}`);
    lines.push('');
  }

  // ── Permitted activities ──
  lines.push(`## Permitted Activities`);
  lines.push('');
  if (spec.learningPurpose.learnerTasks.length > 0) {
    for (const t of spec.learningPurpose.learnerTasks) {
      lines.push(`- ${t.task}`);
    }
  } else {
    lines.push(`- No specific learner tasks have been defined for this lab.`);
  }
  lines.push('');

  // ── Learning outcomes ──
  if (spec.learningPurpose.outcomes.length > 0) {
    lines.push(`## Learning Outcomes`);
    lines.push('');
    for (const o of spec.learningPurpose.outcomes) {
      lines.push(`- ${o.outcome}`);
    }
    lines.push('');
  }

  // ── Access guidance ──
  lines.push(`## Access Guidance`);
  lines.push('');
  if (compute) {
    if (compute.publicIpRequested) {
      lines.push(
        `- The ${compute.name} resource has a public IP. Connect using the address shown in the deployment outputs.`,
      );
      if (compute.osFamily === 'linux') {
        lines.push(
          `- For Linux, use SSH: \`ssh ${compute.authMethod === 'ssh-public-key' ? '<username>@<public-ip>' : '<username>@<public-ip>'}\``,
        );
      } else {
        lines.push(`- For Windows, use Remote Desktop (RDP) to the public IP.`);
      }
    } else {
      lines.push(
        `- The ${compute.name} resource is private. Use the lab platform's built-in console or a bastion/jump host as directed by your instructor.`,
      );
      if (provider === 'aws') {
        lines.push(`- AWS Systems Manager (SSM) Session Manager may be available if configured.`);
      }
    }
  }
  lines.push('');

  // ── Security notes ──
  lines.push(`## Security Notes`);
  lines.push('');
  lines.push(`- This environment is isolated by default. Inbound access is opt-in only.`);
  lines.push(`- Do not enter credentials or secrets into any field in the lab platform.`);
  lines.push(`- Management ports (SSH/RDP) should never be open to 0.0.0.0/0 in production.`);
  lines.push('');

  // ── Limitations ──
  lines.push(`## Limitations`);
  lines.push('');
  lines.push(`- Region and SKU availability are not validated against a live cloud account.`);
  lines.push(`- Generated templates must be externally tested before production or Skillable use.`);
  lines.push(`- This lab environment is temporary and will be removed when the lab ends.`);
  lines.push('');

  // ── Export reminder ──
  lines.push(`## Export Reminder`);
  lines.push('');
  lines.push(`> Save any work you want to keep outside the lab environment before it ends.`);
  lines.push('');

  // ── Support ──
  lines.push(`## Support`);
  lines.push('');
  lines.push(`Contact your instructor for help with this lab.`);
  lines.push('');

  // ── Footer ──
  lines.push(`---`);
  lines.push('');
  lines.push(
    `_Generated by ${APP_INFO.name} ${APP_INFO.version}. These instructions derive from the same internal infrastructure model as the generated templates._`,
  );
  lines.push('');

  return lines.join('\n');
}
