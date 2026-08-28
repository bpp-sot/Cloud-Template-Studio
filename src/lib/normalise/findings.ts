// Shared helpers for turning declarative rule data into review findings.

import type { ReviewFinding } from '@/types';
import { securityRules, costRules } from '@/lib/data';

export function findingFromSecurityRule(
  id: string,
  affectedResource: string | undefined,
  extra?: Partial<ReviewFinding>,
): ReviewFinding | null {
  const rule = securityRules.find((r) => r.id === id);
  if (!rule) return null;
  return {
    id: `${id}:${affectedResource ?? 'general'}`,
    kind: 'security',
    severity: rule.severity,
    category: rule.category,
    description: rule.description,
    recommendation: rule.recommendation,
    affectedResource,
    ...extra,
  };
}

export function findingFromCostRule(id: string, affectedResource?: string): ReviewFinding | null {
  const rule = costRules.find((r) => r.id === id);
  if (!rule) return null;
  return {
    id: `${id}:${affectedResource ?? 'general'}`,
    kind: 'cost',
    severity: 'info',
    category: rule.category,
    description: rule.description,
    recommendation: `${rule.guidance} Pricing calculator: ${rule.pricingCalculatorUrl}`,
    affectedResource,
  };
}
