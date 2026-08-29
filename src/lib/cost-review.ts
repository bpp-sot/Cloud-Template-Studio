// Cost review engine — Development Brief §13.
//
// Produces a structured CostReview from the InternalModel and LabSpecification.
// Analyses per-resource cost notes, compute size risk, duration-based cost
// projections, and links to provider pricing calculators. Never fabricates
// actual prices.

import type { InternalModel, LabSpecification, ReviewFinding } from '@/types';
import type { CostReview, CostReviewItem, CostRiskLevel } from '@/types';
import { APP_INFO } from '@/lib/app-info';
import { findComputeSize } from '@/lib/data';

const AZURE_PRICING_URL = 'https://azure.microsoft.com/pricing/calculator/';
const AWS_PRICING_URL = 'https://calculator.aws/';

function pricingUrl(provider: 'azure' | 'aws'): string {
  return provider === 'azure' ? AZURE_PRICING_URL : AWS_PRICING_URL;
}

function riskFromItems(items: CostReviewItem[]): CostRiskLevel {
  if (items.some((i) => i.riskLevel === 'high')) return 'high';
  if (items.some((i) => i.riskLevel === 'medium')) return 'medium';
  return 'low';
}

/** Analyse compute resources for cost risk. */
function analyseComputeCosts(spec: LabSpecification): CostReviewItem[] {
  const items: CostReviewItem[] = [];
  const provider = spec.provider;

  for (const compute of spec.compute) {
    const size = findComputeSize(provider, compute.sizeId);
    const count = Math.max(1, compute.count);

    // GPU or oversized compute
    if (size?.costFlag) {
      items.push({
        id: `cost-oversized:${compute.id}`,
        category: 'Oversized / GPU compute',
        description: `Compute "${compute.name}" uses ${compute.sizeId}, which is a GPU or large instance type with significantly higher per-hour cost.`,
        recommendation:
          'Confirm the lab genuinely needs GPU or large compute. Prefer a smaller size where possible.',
        affectedResource: compute.name,
        riskLevel: 'high',
        pricingCalculatorUrl: pricingUrl(provider),
      });
    }

    // Multiple instances
    if (count > 1) {
      items.push({
        id: `cost-multi:${compute.id}`,
        category: 'Multiple instances',
        description: `Compute "${compute.name}" has count=${count}, multiplying the per-hour cost for the lab duration.`,
        recommendation:
          'Confirm each instance is required by a learner or technical task. Reduce the count where possible.',
        affectedResource: compute.name,
        riskLevel: 'medium',
        pricingCalculatorUrl: pricingUrl(provider),
      });
    }

    // Public IP cost
    if (compute.publicIpRequested) {
      items.push({
        id: `cost-public-ip:${compute.id}`,
        category: 'Public IPv4',
        description: `Compute "${compute.name}" has a public IP address requested, which incurs an hourly charge on both providers.`,
        recommendation:
          'Only enable a public IP when inbound access is required. Remove it for private-only labs.',
        affectedResource: compute.name,
        riskLevel: 'low',
        pricingCalculatorUrl: pricingUrl(provider),
      });
    }
  }

  return items;
}

/** Analyse storage resources for cost risk. */
function analyseStorageCosts(model: InternalModel): CostReviewItem[] {
  const items: CostReviewItem[] = [];

  for (const resource of model.resources) {
    // EBS root volume or managed disk cost
    if (
      resource.properties.dependencyIdentifier === 'aws-ebs-root' ||
      resource.properties.dependencyIdentifier === 'azure-vm-osdisk'
    ) {
      items.push({
        id: `cost-storage:${resource.logicalId}`,
        category: 'Root storage',
        description: `${resource.logicalId} (${resource.providerResourceType}) incurs per-GB storage cost for the lab duration.`,
        recommendation:
          'Use standard or balanced storage tiers for labs unless performance testing is an outcome.',
        affectedResource: resource.logicalId,
        riskLevel: 'low',
        pricingCalculatorUrl: pricingUrl(model.provider),
      });
    }
  }

  return items;
}

/** Analyse duration-based cost risk. */
function analyseDurationCosts(spec: LabSpecification): CostReviewItem[] {
  const items: CostReviewItem[] = [];
  const duration = Number(spec.deployment.expectedDurationMinutes) || 60;
  const labDuration = Number(spec.metadata.labDuration) || duration;

  if (labDuration > 240) {
    items.push({
      id: 'cost-long-duration',
      category: 'Long lab duration',
      description: `Lab duration is ${labDuration} minutes, which increases total consumption cost.`,
      recommendation:
        'Ensure cleanup is configured so resources do not persist beyond the lab. Consider auto-shutdown where supported.',
      riskLevel: 'medium',
      pricingCalculatorUrl: pricingUrl(spec.provider),
    });
  }

  if (!spec.deployment.cleanup) {
    items.push({
      id: 'cost-no-cleanup',
      category: 'No cleanup configured',
      description:
        'Cleanup is not enabled. Resources may persist beyond the lab, incurring ongoing charges.',
      recommendation:
        'Enable cleanup or confirm a manual cleanup process to prevent ongoing charges.',
      riskLevel: 'high',
      pricingCalculatorUrl: pricingUrl(spec.provider),
    });
  }

  return items;
}

/** Carry forward the normaliser's inline cost findings. */
function carryInlineCostFindings(model: InternalModel): CostReviewItem[] {
  return model.findings
    .filter((f: ReviewFinding) => f.kind === 'cost')
    .map((f) => ({
      id: f.id,
      category: f.category,
      description: f.description,
      recommendation: f.recommendation,
      affectedResource: f.affectedResource,
      riskLevel: (f.severity === 'info' ? 'low' : 'medium') as CostRiskLevel,
      pricingCalculatorUrl: pricingUrl(model.provider),
    }));
}

/** Collect per-resource cost notes from the InternalModel. */
function collectResourceCostNotes(
  model: InternalModel,
): Array<{ logicalId: string; notes: string[] }> {
  return model.resources
    .filter((r) => r.costNotes.length > 0)
    .map((r) => ({ logicalId: r.logicalId, notes: r.costNotes }));
}

function generateSummary(
  spec: LabSpecification,
  items: CostReviewItem[],
  overallRisk: CostRiskLevel,
  resourceCostNotes: Array<{ logicalId: string; notes: string[] }>,
  durationMinutes: number,
): string {
  const provider = spec.provider === 'azure' ? 'Microsoft Azure' : 'Amazon Web Services';
  const highCount = items.filter((i) => i.riskLevel === 'high').length;
  const medCount = items.filter((i) => i.riskLevel === 'medium').length;
  const lowCount = items.filter((i) => i.riskLevel === 'low').length;

  return [
    `Cost Review for: ${spec.metadata.projectName || 'Untitled Project'}`,
    `Provider: ${provider}`,
    `Generated by: ${APP_INFO.name} ${APP_INFO.version}`,
    `Generated at: ${new Date().toISOString()}`,
    '',
    `Overall Cost Risk: ${overallRisk.toUpperCase()}`,
    '',
    `Estimated lab duration: ${durationMinutes} minutes`,
    `Cost items: ${items.length}`,
    `  High risk: ${highCount}`,
    `  Medium risk: ${medCount}`,
    `  Low risk: ${lowCount}`,
    `Resources with cost notes: ${resourceCostNotes.length}`,
    '',
    'Exact prices are not provided. Use the provider pricing calculator for accurate estimates.',
    'This review does NOT constitute a deployment cost estimate or quote.',
  ].join('\n');
}

export function generateCostReview(spec: LabSpecification, model: InternalModel): CostReview {
  const items: CostReviewItem[] = [
    ...carryInlineCostFindings(model),
    ...analyseComputeCosts(spec),
    ...analyseStorageCosts(model),
    ...analyseDurationCosts(spec),
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped = items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });

  // Sort by risk level (high first)
  const riskOrder: Record<CostRiskLevel, number> = { high: 0, medium: 1, low: 2 };
  deduped.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

  const resourceCostNotes = collectResourceCostNotes(model);
  const overallRisk = riskFromItems(deduped);
  const durationMinutes =
    Number(spec.metadata.labDuration) || Number(spec.deployment.expectedDurationMinutes) || 60;
  const summary = generateSummary(spec, deduped, overallRisk, resourceCostNotes, durationMinutes);

  return {
    projectName: spec.metadata.projectName || 'Untitled Project',
    provider: spec.provider,
    generatedAt: new Date().toISOString(),
    overallRisk,
    items: deduped,
    resourceCostNotes,
    estimatedDurationMinutes: durationMinutes,
    summary,
  };
}

/** Render a cost review as downloadable text. */
export function costReviewToText(review: CostReview): string {
  const lines: string[] = [review.summary, '', '─'.repeat(60), ''];

  for (const item of review.items) {
    lines.push(`[${item.riskLevel.toUpperCase()}] ${item.category}`);
    lines.push(`  Description: ${item.description}`);
    lines.push(`  Recommendation: ${item.recommendation}`);
    if (item.affectedResource) lines.push(`  Affected resource: ${item.affectedResource}`);
    lines.push(`  Pricing calculator: ${item.pricingCalculatorUrl}`);
    lines.push('');
  }

  if (review.resourceCostNotes.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('');
    lines.push('Per-resource cost notes:');
    lines.push('');
    for (const rcn of review.resourceCostNotes) {
      lines.push(`${rcn.logicalId}:`);
      for (const note of rcn.notes) lines.push(`  - ${note}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
