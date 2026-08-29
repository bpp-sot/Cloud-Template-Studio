// Deployment readiness engine — Development Brief §14.
//
// Aggregates security and cost findings into a deployment readiness gate.
// Produces a ReadinessStatus (ready / needs-attention / blocked) and a set
// of structured checks that the lab author must review before deploying.
//
// The engine reads from the InternalModel and LabSpecification, so the
// readiness assessment cannot drift from the generated templates.

import type { InternalModel, LabSpecification, ReviewFinding } from '@/types';
import type { DeploymentReadiness, ReadinessCheck, ReadinessStatus } from '@/types';
import { APP_INFO } from '@/lib/app-info';
import { generateSecurityReview } from './security-review';
import { generateCostReview } from './cost-review';

function statusFromChecks(checks: ReadinessCheck[]): ReadinessStatus {
  if (checks.some((c) => c.status === 'fail')) return 'blocked';
  if (checks.some((c) => c.status === 'warn')) return 'needs-attention';
  return 'ready';
}

export function generateDeploymentReadiness(
  spec: LabSpecification,
  model: InternalModel,
): DeploymentReadiness {
  const securityReview = generateSecurityReview(spec, model);
  const costReview = generateCostReview(spec, model);

  const checks: ReadinessCheck[] = [];
  const blockingFindings: ReviewFinding[] = [];
  const warningFindings: ReviewFinding[] = [];

  // ── Check 1: Critical security findings ──
  const criticalSec = securityReview.items.filter((i) => i.severity === 'critical');
  const highSec = securityReview.items.filter((i) => i.severity === 'high');
  if (criticalSec.length > 0) {
    checks.push({
      id: 'critical-security',
      label: 'No critical security findings',
      description: 'Critical security findings must be resolved before deployment.',
      status: 'fail',
      detail: `${criticalSec.length} critical finding(s): ${criticalSec.map((s) => s.category).join(', ')}`,
    });
    for (const s of criticalSec) {
      blockingFindings.push({
        id: s.id,
        kind: 'security',
        severity: 'critical',
        category: s.category,
        description: s.description,
        recommendation: s.recommendation,
        affectedResource: s.affectedResource,
      });
    }
  } else if (highSec.length > 0) {
    checks.push({
      id: 'high-security',
      label: 'No high-severity security findings',
      description: 'High-severity security findings should be reviewed before deployment.',
      status: 'warn',
      detail: `${highSec.length} high-severity finding(s): ${highSec.map((s) => s.category).join(', ')}`,
    });
    for (const s of highSec) {
      warningFindings.push({
        id: s.id,
        kind: 'security',
        severity: 'high',
        category: s.category,
        description: s.description,
        recommendation: s.recommendation,
        affectedResource: s.affectedResource,
      });
    }
  } else {
    checks.push({
      id: 'security-clean',
      label: 'No critical or high security findings',
      description: 'No critical or high-severity security findings detected.',
      status: 'pass',
      detail: 'Security review passed with no blocking findings.',
    });
  }

  // ── Check 2: High cost risk ──
  const highCost = costReview.items.filter((i) => i.riskLevel === 'high');
  if (highCost.length > 0) {
    checks.push({
      id: 'high-cost',
      label: 'No high-risk cost findings',
      description: 'High-risk cost findings should be reviewed before deployment.',
      status: 'warn',
      detail: `${highCost.length} high-risk cost item(s): ${highCost.map((c) => c.category).join(', ')}`,
    });
    for (const c of highCost) {
      warningFindings.push({
        id: c.id,
        kind: 'cost',
        severity: 'info',
        category: c.category,
        description: c.description,
        recommendation: c.recommendation,
        affectedResource: c.affectedResource,
      });
    }
  } else {
    checks.push({
      id: 'cost-clean',
      label: 'No high-risk cost findings',
      description: 'No high-risk cost findings detected.',
      status: 'pass',
      detail: 'Cost review passed with no high-risk items.',
    });
  }

  // ── Check 3: Secure parameters ──
  const secureParams = model.parameters.filter((p) => p.secure);
  if (secureParams.length > 0) {
    checks.push({
      id: 'secure-params',
      label: 'Secure parameters declared',
      description: 'Administrative credentials are declared as secure parameters.',
      status: 'pass',
      detail: `${secureParams.length} secure parameter(s): ${secureParams.map((p) => p.name).join(', ')}`,
    });
  } else {
    checks.push({
      id: 'no-secure-params',
      label: 'Secure parameters declared',
      description:
        'No secure parameters declared. If admin credentials are needed, they should be secure.',
      status: 'warn',
      detail:
        'No secure parameters found. Confirm no credentials are needed, or add secure parameters.',
    });
  }

  // ── Check 4: Cleanup configured ──
  if (spec.deployment.cleanup) {
    checks.push({
      id: 'cleanup',
      label: 'Cleanup configured',
      description: 'Resource cleanup is enabled after the lab ends.',
      status: 'pass',
      detail: 'Cleanup is enabled. Resources should be removed after the lab.',
    });
  } else {
    checks.push({
      id: 'no-cleanup',
      label: 'Cleanup configured',
      description:
        'Resource cleanup is not enabled. Resources may persist and incur ongoing charges.',
      status: 'warn',
      detail: 'Cleanup is not configured. Confirm a manual cleanup process exists.',
    });
  }

  // ── Check 5: Region specified ──
  if (spec.location.primaryRegion && spec.location.primaryRegion.trim().length > 0) {
    checks.push({
      id: 'region',
      label: 'Target region specified',
      description: 'A primary deployment region is specified.',
      status: 'pass',
      detail: `Primary region: ${spec.location.primaryRegion}. Verify availability in your subscription/account.`,
    });
  } else {
    checks.push({
      id: 'no-region',
      label: 'Target region specified',
      description: 'No primary deployment region is specified.',
      status: 'warn',
      detail: 'No region specified. The template may fail to deploy without a target region.',
    });
  }

  // ── Check 6: Compute size availability (catalogue check) ──
  const allSizesKnown = spec.compute.every((c) => {
    // If the size is in the catalogue, it's known. If not, the model will have a warning.
    const resource = model.resources.find((r) => r.logicalId === c.name);
    return !resource?.warnings.some((w) => w.includes('not found'));
  });
  if (allSizesKnown) {
    checks.push({
      id: 'sizes-known',
      label: 'Compute sizes recognised',
      description: 'All compute sizes are recognised in the catalogue.',
      status: 'pass',
      detail: 'All compute sizes are in the catalogue. Verify availability in the target region.',
    });
  } else {
    checks.push({
      id: 'sizes-unknown',
      label: 'Compute sizes recognised',
      description: 'One or more compute sizes were not found in the catalogue.',
      status: 'warn',
      detail:
        'Some compute sizes are not in the catalogue. Verify the size id is correct and available.',
    });
  }

  // ── Check 7: No embedded secrets ──
  const embeddedSecretFindings = securityReview.items.filter((i) =>
    i.category.includes('Embedded credentials'),
  );
  if (embeddedSecretFindings.length === 0) {
    checks.push({
      id: 'no-secrets',
      label: 'No embedded secrets detected',
      description: 'No secrets or credentials were detected in free-text fields or scripts.',
      status: 'pass',
      detail: 'Secret scanning passed. No embedded credentials detected.',
    });
  } else {
    checks.push({
      id: 'secrets-found',
      label: 'No embedded secrets detected',
      description: 'Potential secrets were detected in free-text fields or scripts.',
      status: 'fail',
      detail: `${embeddedSecretFindings.length} embedded secret(s) detected. Remove all secrets before deployment.`,
    });
    for (const s of embeddedSecretFindings) {
      blockingFindings.push({
        id: s.id,
        kind: 'security',
        severity: 'critical',
        category: s.category,
        description: s.description,
        recommendation: s.recommendation,
        affectedResource: s.affectedResource,
      });
    }
  }

  // ── Check 8: Boundary statement acknowledged ──
  checks.push({
    id: 'boundary',
    label: 'External testing required',
    description:
      'Generated templates must be tested in a non-production environment before Skillable use.',
    status: 'warn',
    detail:
      'This check is always present. Templates are not penetration-tested, deployment-confirmed, or Skillable-approved.',
  });

  const overallStatus = statusFromChecks(checks);

  const summary = [
    `Deployment Readiness for: ${spec.metadata.projectName || 'Untitled Project'}`,
    `Provider: ${spec.provider === 'azure' ? 'Microsoft Azure' : 'Amazon Web Services'}`,
    `Generated by: ${APP_INFO.name} ${APP_INFO.version}`,
    `Generated at: ${new Date().toISOString()}`,
    '',
    `Overall Status: ${overallStatus.toUpperCase().replace('-', ' ')}`,
    '',
    `Checks: ${checks.length}`,
    `  Pass: ${checks.filter((c) => c.status === 'pass').length}`,
    `  Warn: ${checks.filter((c) => c.status === 'warn').length}`,
    `  Fail: ${checks.filter((c) => c.status === 'fail').length}`,
    '',
    `Blocking findings: ${blockingFindings.length}`,
    `Warning findings: ${warningFindings.length}`,
    '',
    'This readiness assessment does NOT confirm the template will deploy successfully.',
    'External testing in a non-production environment is required.',
  ].join('\n');

  return {
    projectName: spec.metadata.projectName || 'Untitled Project',
    provider: spec.provider,
    generatedAt: new Date().toISOString(),
    overallStatus,
    checks,
    blockingFindings,
    warningFindings,
    summary,
  };
}

/** Render deployment readiness as downloadable text. */
export function deploymentReadinessToText(readiness: DeploymentReadiness): string {
  const lines: string[] = [readiness.summary, '', '─'.repeat(60), ''];

  for (const check of readiness.checks) {
    const symbol =
      check.status === 'pass' ? '[PASS]' : check.status === 'warn' ? '[WARN]' : '[FAIL]';
    lines.push(`${symbol} ${check.label}`);
    lines.push(`  ${check.description}`);
    lines.push(`  Detail: ${check.detail}`);
    lines.push('');
  }

  if (readiness.blockingFindings.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('');
    lines.push('Blocking findings:');
    lines.push('');
    for (const f of readiness.blockingFindings) {
      lines.push(`[${f.severity.toUpperCase()}] ${f.category}`);
      lines.push(`  ${f.description}`);
      lines.push(`  Recommendation: ${f.recommendation}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
