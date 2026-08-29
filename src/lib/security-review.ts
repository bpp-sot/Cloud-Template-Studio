// Security review engine — Development Brief §13.
//
// Produces a structured SecurityReview from the InternalModel and
// LabSpecification. Goes deeper than the normaliser's inline findings:
// analyses individual NSG / security group ingress rules, checks
// provider-specific security posture, and computes an overall risk level.
//
// The engine reads ONLY from the InternalModel and LabSpecification, so
// reviews and templates cannot drift apart (Brief §15).

import type { InternalModel, LabSpecification, ReviewFinding } from '@/types';
import type { SecurityReview, SecurityReviewItem, OverallRisk } from '@/types';
import { FindingSeverity } from '@/types';
import { APP_INFO } from '@/lib/app-info';
import { evidenceRefFromId } from '@/lib/normalise/dependencies';

const SAFE_INPUT_EVIDENCE = evidenceRefFromId('safety-secure-input');

function emptyCounts(): Record<FindingSeverity, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

function riskFromFindings(items: SecurityReviewItem[]): OverallRisk {
  if (items.some((i) => i.severity === 'critical')) return 'critical';
  if (items.some((i) => i.severity === 'high')) return 'high';
  if (items.some((i) => i.severity === 'medium')) return 'medium';
  if (items.some((i) => i.severity === 'low')) return 'low';
  return 'info';
}

/** Analyse individual inbound network rules for security issues. */
function analyseNetworkRules(spec: LabSpecification): SecurityReviewItem[] {
  const items: SecurityReviewItem[] = [];

  for (const net of spec.network) {
    if (net.inboundRules.length === 0) {
      items.push({
        id: `sec-no-ingress:${net.id}`,
        severity: 'info',
        category: 'Network posture',
        description: `Network "${net.name}" has no inbound rules. Default posture denies all inbound traffic.`,
        recommendation:
          'This is a secure default. Add inbound rules only when the lab requires them.',
        affectedResource: net.name,
        checkId: 'no-ingress-rules',
      });
      continue;
    }

    for (const rule of net.inboundRules) {
      const isWildcard = rule.sourceCidr.trim() === '0.0.0.0/0';
      const isMgmtPort = rule.port === 22 || rule.port === 3389;

      if (isWildcard && isMgmtPort) {
        items.push({
          id: `sec-mgmt-open:${net.id}:${rule.port}`,
          severity: 'critical',
          category: 'Management port exposed',
          description: `Management port ${rule.port} (${rule.port === 22 ? 'SSH' : 'RDP'}) on network "${net.name}" is open to 0.0.0.0/0 (any source).`,
          recommendation:
            'Restrict to a known source CIDR range, or use a bastion / just-in-time access pattern. This is the highest-risk configuration.',
          affectedResource: net.name,
          checkId: 'mgmt-port-open-cidr',
          evidence: SAFE_INPUT_EVIDENCE,
        });
      } else if (isWildcard) {
        items.push({
          id: `sec-open-cidr:${net.id}:${rule.port}`,
          severity: 'high',
          category: 'Unrestricted network access',
          description: `Port ${rule.port} on network "${net.name}" allows traffic from 0.0.0.0/0 (any source).`,
          recommendation:
            'Replace the wildcard CIDR with the smallest specific source range required for the lab.',
          affectedResource: net.name,
          checkId: 'open-cidr',
          evidence: SAFE_INPUT_EVIDENCE,
        });
      } else if (isMgmtPort) {
        items.push({
          id: `sec-mgmt-restricted:${net.id}:${rule.port}`,
          severity: 'medium',
          category: 'Management port access',
          description: `Management port ${rule.port} (${rule.port === 22 ? 'SSH' : 'RDP'}) on network "${net.name}" is open to ${rule.sourceCidr}.`,
          recommendation:
            'Confirm this source range is the smallest required. Consider bastion or JIT access for production labs.',
          affectedResource: net.name,
          checkId: 'mgmt-port-restricted',
        });
      }
    }
  }

  return items;
}

/** Analyse compute resources for security posture. */
function analyseCompute(spec: LabSpecification, model: InternalModel): SecurityReviewItem[] {
  const items: SecurityReviewItem[] = [];

  for (const compute of spec.compute) {
    // Public IP exposure
    if (compute.publicIpRequested) {
      items.push({
        id: `sec-public-ip:${compute.id}`,
        severity: 'high',
        category: 'Public exposure',
        description: `Compute "${compute.name}" has a public IP address explicitly requested, exposing it to the internet.`,
        recommendation:
          'Confirm inbound access is required. Restrict inbound rules to specific source ranges and management ports only.',
        affectedResource: compute.name,
        checkId: 'public-ip-requested',
        evidence: SAFE_INPUT_EVIDENCE,
      });
    }

    // Authentication method
    if (compute.osFamily === 'linux' && compute.authMethod === 'password-prompt') {
      items.push({
        id: `sec-weak-auth:${compute.id}`,
        severity: 'high',
        category: 'Authentication',
        description: `Linux VM "${compute.name}" uses password authentication where SSH public-key authentication is available.`,
        recommendation:
          'Prefer SSH public-key authentication for Linux VMs. Ensure any password is supplied via a secure parameter, never embedded.',
        affectedResource: compute.name,
        checkId: 'weak-auth',
      });
    }

    // GPU / oversized compute (security-adjacent: abuse potential)
    const resource = model.resources.find((r) => r.logicalId === compute.name);
    if (resource && resource.warnings.some((w) => w.includes('costFlag') || w.includes('GPU'))) {
      items.push({
        id: `sec-oversized:${compute.id}`,
        severity: 'medium',
        category: 'Oversized compute',
        description: `Compute "${compute.name}" uses a GPU or oversized instance type, which increases abuse potential (e.g. cryptocurrency mining).`,
        recommendation:
          'Confirm the lab genuinely needs this size. Consider smaller sizes for general-purpose labs.',
        affectedResource: compute.name,
        checkId: 'oversized-compute',
      });
    }
  }

  return items;
}

/** Analyse the InternalModel for security-relevant resource properties. */
function analyseModel(model: InternalModel): SecurityReviewItem[] {
  const items: SecurityReviewItem[] = [];

  for (const resource of model.resources) {
    // Check for resources with security notes
    for (const note of resource.securityNotes) {
      if (note.includes('internet') || note.includes('public') || note.includes('exposure')) {
        items.push({
          id: `sec-resource-note:${resource.logicalId}`,
          severity: 'medium',
          category: 'Resource security note',
          description: `${resource.logicalId}: ${note}`,
          recommendation: 'Review the security note and confirm the configuration is intentional.',
          affectedResource: resource.logicalId,
          checkId: 'resource-security-note',
        });
      }
    }

    // Check for warnings
    for (const warning of resource.warnings) {
      items.push({
        id: `sec-resource-warning:${resource.logicalId}`,
        severity: 'medium',
        category: 'Resource warning',
        description: `${resource.logicalId}: ${warning}`,
        recommendation: 'Address the warning before deployment.',
        affectedResource: resource.logicalId,
        checkId: 'resource-warning',
      });
    }
  }

  return items;
}

/** Carry forward the normaliser's inline security findings. */
function carryInlineFindings(model: InternalModel): SecurityReviewItem[] {
  return model.findings
    .filter((f) => f.kind === 'security')
    .map((f: ReviewFinding) => ({
      id: f.id,
      severity: f.severity,
      category: f.category,
      description: f.description,
      recommendation: f.recommendation,
      affectedResource: f.affectedResource,
      evidence: f.evidence,
      checkId: 'inline-finding',
    }));
}

/** Check for secure parameter handling. */
function analyseParameters(model: InternalModel): SecurityReviewItem[] {
  const items: SecurityReviewItem[] = [];
  const secureParams = model.parameters.filter((p) => p.secure);

  if (secureParams.length > 0) {
    for (const p of secureParams) {
      items.push({
        id: `sec-secure-param:${p.name}`,
        severity: 'info',
        category: 'Secure input',
        description: `Parameter "${p.name}" is declared as secure (NoEcho / securestring). Values are not stored or echoed.`,
        recommendation:
          'Supply the value at deployment time. Never commit secrets to the template.',
        checkId: 'secure-parameter',
        evidence: SAFE_INPUT_EVIDENCE,
      });
    }
  }

  // Check for non-secure parameters that might hold sensitive data
  const suspiciousParams = model.parameters.filter(
    (p) => !p.secure && /password|secret|key|token/i.test(p.name),
  );
  for (const p of suspiciousParams) {
    items.push({
      id: `sec-suspicious-param:${p.name}`,
      severity: 'high',
      category: 'Parameter security',
      description: `Parameter "${p.name}" has a sensitive-looking name but is NOT declared as secure.`,
      recommendation:
        'Mark this parameter as secure (NoEcho / securestring) to prevent value exposure.',
      checkId: 'suspicious-parameter',
    });
  }

  return items;
}

/** Check for initialisation script security. */
function analyseInitScripts(spec: LabSpecification): SecurityReviewItem[] {
  const items: SecurityReviewItem[] = [];

  for (const init of spec.initialisation) {
    if (init.script && init.script.trim().length > 0) {
      items.push({
        id: `sec-init-script:${init.id}`,
        severity: 'info',
        category: 'Initialisation script',
        description: `Initialisation script "${init.description || init.id}" is user-supplied (Classification F) and has been secret-scanned.`,
        recommendation:
          'Manually review the script for correctness and security. Custom scripts are not validated against official evidence.',
        affectedResource: init.targetComputeId,
        checkId: 'init-script',
      });
    }
  }

  return items;
}

function generateSummary(
  spec: LabSpecification,
  items: SecurityReviewItem[],
  overallRisk: OverallRisk,
  counts: Record<FindingSeverity, number>,
): string {
  const provider = spec.provider === 'azure' ? 'Microsoft Azure' : 'Amazon Web Services';
  return [
    `Security Review for: ${spec.metadata.projectName || 'Untitled Project'}`,
    `Lab Profile: ${spec.metadata.labProfileNumber || 'N/A'}`,
    `Provider: ${provider}`,
    `Generated by: ${APP_INFO.name} ${APP_INFO.version}`,
    `Generated at: ${new Date().toISOString()}`,
    '',
    `Overall Risk: ${overallRisk.toUpperCase()}`,
    '',
    `Security Items: ${items.length}`,
    `  Critical: ${counts.critical}`,
    `  High: ${counts.high}`,
    `  Medium: ${counts.medium}`,
    `  Low: ${counts.low}`,
    `  Info: ${counts.info}`,
    '',
    'This security review is generated from the same internal model as the templates.',
    'It does NOT constitute penetration testing or deployment confirmation.',
    'Templates must be externally tested before Skillable use.',
  ].join('\n');
}

export function generateSecurityReview(
  spec: LabSpecification,
  model: InternalModel,
): SecurityReview {
  const items: SecurityReviewItem[] = [
    ...carryInlineFindings(model),
    ...analyseNetworkRules(spec),
    ...analyseCompute(spec, model),
    ...analyseModel(model),
    ...analyseParameters(model),
    ...analyseInitScripts(spec),
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped = items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });

  // Sort by severity (critical first)
  const severityOrder: Record<FindingSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  deduped.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const counts = emptyCounts();
  for (const item of deduped) counts[item.severity]++;

  const overallRisk = riskFromFindings(deduped);
  const summary = generateSummary(spec, deduped, overallRisk, counts);

  return {
    projectName: spec.metadata.projectName || 'Untitled Project',
    labProfileNumber: spec.metadata.labProfileNumber || 'N/A',
    provider: spec.provider,
    generatedAt: new Date().toISOString(),
    overallRisk,
    items: deduped,
    summary,
    counts,
  };
}

/** Render a security review as downloadable text. */
export function securityReviewToText(review: SecurityReview): string {
  const lines: string[] = [review.summary, '', '─'.repeat(60), ''];

  for (const item of review.items) {
    lines.push(`[${item.severity.toUpperCase()}] ${item.category}`);
    lines.push(`  Description: ${item.description}`);
    lines.push(`  Recommendation: ${item.recommendation}`);
    if (item.affectedResource) lines.push(`  Affected resource: ${item.affectedResource}`);
    lines.push('');
  }

  return lines.join('\n');
}
