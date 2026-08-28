import type { EvidenceClassification } from '@/types';

const LABELS: Record<EvidenceClassification, string> = {
  A: 'A · Official Skillable example',
  B: 'B · Official Skillable documentation',
  C: 'C · Native Azure documentation',
  D: 'D · Native AWS documentation',
  E: 'E · Application safety constraint',
  F: 'F · User-supplied custom configuration',
  G: 'G · Unverified / manual review required',
};

export default function EvidenceBadge({
  classification,
  title,
}: {
  classification: EvidenceClassification;
  title?: string;
}) {
  return (
    <span
      className={`badge badge-evidence-${classification.toLowerCase()}`}
      title={title ?? LABELS[classification]}
    >
      Class {classification}
    </span>
  );
}

export { LABELS as EVIDENCE_LABELS };
