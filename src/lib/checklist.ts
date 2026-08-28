// Deployment validation checklist generator — Development Brief §15.
//
// Produces a downloadable Markdown checklist the lab author must complete
// before using generated templates in production or Skillable. The checklist
// is generated from the InternalModel and LabSpecification so it reflects the
// actual resources and provider.

import type { InternalModel, LabSpecification } from '@/types';
import { APP_INFO } from '@/lib/app-info';

export function generateValidationChecklist(spec: LabSpecification, model: InternalModel): string {
  const lines: string[] = [];
  const provider = spec.provider;
  const providerLabel = provider === 'azure' ? 'Microsoft Azure' : 'Amazon Web Services';
  const meta = spec.metadata;

  lines.push(`# Deployment Validation Checklist`);
  lines.push('');
  lines.push(`**Project:** ${meta.projectName || 'Untitled'}`);
  lines.push(`**Provider:** ${providerLabel}`);
  lines.push(`**Lab profile:** ${meta.labProfileName || 'unspecified'}`);
  lines.push(`**Version:** ${meta.version}`);
  lines.push('');
  lines.push(`> Generated templates are **not** penetration-tested, deployment-confirmed, or`);
  lines.push(`> Skillable-approved. Complete every item below before production or Skillable use.`);
  lines.push('');

  lines.push(`## 1. Deployment Operations`);
  lines.push('');
  lines.push(`- [ ] Deploy the template in a non-production environment`);
  lines.push(`- [ ] Confirm all ${model.resources.length} resources are created successfully`);
  lines.push(
    `- [ ] Verify deployment completes within the expected duration (${spec.deployment.expectedDurationMinutes || '60'} minutes)`,
  );
  lines.push(`- [ ] Record the exact template version and deployment date`);
  lines.push('');

  lines.push(`## 2. Resource Inventory Verification`);
  lines.push('');
  for (const r of model.resources) {
    lines.push(`- [ ] ${r.logicalId} (${r.providerResourceType}) — ${r.purpose}`);
  }
  lines.push('');

  lines.push(`## 3. Initialization`);
  lines.push('');
  if (spec.initialisation.length > 0) {
    for (const init of spec.initialisation) {
      lines.push(`- [ ] Verify initialization script completes: ${init.description || init.id}`);
    }
  } else {
    lines.push(
      `- [ ] No initialization scripts configured — verify the instance boots to a usable state`,
    );
  }
  lines.push('');

  lines.push(`## 4. Networking and Access`);
  lines.push('');
  lines.push(
    `- [ ] Verify the network boundary is correct (${spec.network[0]?.addressSpace || 'n/a'})`,
  );
  lines.push(`- [ ] Confirm inbound rules match the intended access pattern`);
  lines.push(
    `- [ ] Verify no management ports (SSH/RDP) are open to 0.0.0.0/0 unless explicitly justified`,
  );
  if (spec.compute[0]?.publicIpRequested) {
    lines.push(`- [ ] Public IP was explicitly requested — verify the exposure is justified`);
  } else {
    lines.push(`- [ ] No public IP requested — verify private access works as expected`);
  }
  lines.push('');

  lines.push(`## 5. Cleanup`);
  lines.push('');
  if (spec.deployment.cleanup) {
    lines.push(`- [ ] Verify cleanup removes all generated resources after the lab`);
    lines.push(`- [ ] Confirm no orphaned resources remain (check disks, NICs, public IPs)`);
  } else {
    lines.push(`- [ ] Cleanup is not enabled — confirm the manual cleanup process`);
  }
  lines.push('');

  lines.push(`## 6. Region and SKU Availability`);
  lines.push('');
  lines.push(
    `- [ ] Confirm region "${spec.location.primaryRegion || 'unspecified'}" is available in your subscription/account`,
  );
  for (const c of spec.compute) {
    lines.push(`- [ ] Confirm size "${c.sizeId}" is available in the target region`);
  }
  lines.push('');

  lines.push(`## 7. Access Control Policy (ACP / IAM)`);
  lines.push('');
  if (provider === 'azure') {
    lines.push(
      `- [ ] Confirm a compatible Skillable Azure ACP exists where learners create resources`,
    );
    lines.push(`- [ ] Verify the ACP permits the operations the lab requires`);
    lines.push(`- [ ] Test the ACP against the deployed resources`);
  } else {
    lines.push(
      `- [ ] Confirm a compatible Skillable AWS IAM policy exists where learners create resources`,
    );
    lines.push(`- [ ] Verify the IAM policy permits the operations the lab requires`);
    lines.push(`- [ ] Test the IAM policy against the deployed resources`);
  }
  lines.push('');

  lines.push(`## 8. Skillable Compatibility`);
  lines.push('');
  lines.push(`- [ ] Confirm Skillable compatibility with the lab platform`);
  lines.push(`- [ ] Verify the lab save behaviour matches the deployment configuration`);
  lines.push(`- [ ] Test the full lab lifecycle (start, save, resume, end)`);
  lines.push('');

  lines.push(`## 9. Security Review`);
  lines.push('');
  const secFindings = model.findings.filter((f) => f.kind === 'security');
  if (secFindings.length > 0) {
    for (const f of secFindings) {
      lines.push(`- [ ] Address: ${f.category} — ${f.description}`);
    }
  } else {
    lines.push(`- [ ] No security findings — perform an independent security review`);
  }
  lines.push('');

  lines.push(`## 10. Cost Review`);
  lines.push('');
  const costFindings = model.findings.filter((f) => f.kind === 'cost');
  if (costFindings.length > 0) {
    for (const f of costFindings) {
      lines.push(`- [ ] Review: ${f.category} — ${f.description}`);
    }
  } else {
    lines.push(`- [ ] No elevated cost findings — confirm pricing with the provider calculator`);
  }
  lines.push(
    `- [ ] Confirm the expected lab duration (${spec.metadata.labDuration || '60'} minutes) is acceptable`,
  );
  lines.push('');

  lines.push(`---`);
  lines.push('');
  lines.push(
    `_Generated by ${APP_INFO.name} ${APP_INFO.version}. This checklist must be completed and retained as evidence of external testing._`,
  );
  lines.push('');

  return lines.join('\n');
}
