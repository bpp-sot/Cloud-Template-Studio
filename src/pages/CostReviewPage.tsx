// Cost Review page — Development Brief §13.
//
// Dedicated cost review page with per-resource cost notes, risk-level
// filtering, pricing calculator links, and copy/download support.
// Accessible from the Review hub at /review/:projectId/cost.

import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadProject } from '@/lib/storage';
import { generateCostReview, costReviewToText } from '@/lib/cost-review';
import { copyToClipboard, downloadText } from '@/lib/download';
import type { TemplateProject } from '@/types';
import type { CostReview as CostReviewType, CostRiskLevel } from '@/types';

const RISK_LEVELS: CostRiskLevel[] = ['high', 'medium', 'low'];

export default function CostReviewPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<TemplateProject | null>(null);
  const [review, setReview] = useState<CostReviewType | null>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<CostRiskLevel | 'all'>('all');

  useEffect(() => {
    if (!projectId) return;
    const p = loadProject(projectId);
    setProject(p);
    if (p?.artifacts?.internalModel) {
      setReview(generateCostReview(p.wizard.spec, p.artifacts.internalModel));
    }
  }, [projectId]);

  const filteredItems = useMemo(() => {
    if (!review) return [];
    if (filter === 'all') return review.items;
    return review.items.filter((i) => i.riskLevel === filter);
  }, [review, filter]);

  if (!project) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>Project not found.</p>
          <Link to="/projects" className="btn btn-primary mt-4">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">{'\u{1F4E6}'}</div>
          <p>This project has not been generated yet.</p>
          <Link to={`/new/${project.id}`} className="btn btn-primary mt-4">
            Open Wizard
          </Link>
        </div>
      </div>
    );
  }

  const safeName = (project.wizard.spec.metadata.projectName || 'template')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .toLowerCase();

  const handleCopy = async () => {
    const ok = await copyToClipboard(costReviewToText(review));
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadText(`${safeName}-cost-review.txt`, costReviewToText(review));
  };

  const riskClass = `severity-${review.overallRisk === 'high' ? 'high' : review.overallRisk === 'medium' ? 'medium' : 'low'}`;
  const counts = {
    high: review.items.filter((i) => i.riskLevel === 'high').length,
    medium: review.items.filter((i) => i.riskLevel === 'medium').length,
    low: review.items.filter((i) => i.riskLevel === 'low').length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Cost Review</h2>
          <p className="section-subtitle">
            {review.projectName} &middot;{' '}
            {review.provider === 'azure' ? 'Microsoft Azure' : 'Amazon Web Services'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/review/${projectId}`} className="btn btn-secondary btn-sm">
            Back to Review
          </Link>
        </div>
      </div>

      {/* Overall risk */}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted">Overall Cost Risk</div>
            <div className={`text-2xl font-bold ${riskClass}`}>
              {review.overallRisk.toUpperCase()}
            </div>
            <div className="text-sm text-muted mt-1">
              Estimated duration: {review.estimatedDurationMinutes} minutes
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              {copied ? '\u2713 Copied!' : 'Copy Summary'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
              Download
            </button>
          </div>
        </div>
        <div className="flex gap-4 mt-4">
          {RISK_LEVELS.map((r) => (
            <div key={r} className="text-center">
              <div
                className={`text-lg font-bold severity-${r === 'high' ? 'high' : r === 'medium' ? 'medium' : 'low'}`}
              >
                {counts[r]}
              </div>
              <div className="text-xs text-muted">{r} risk</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing note */}
      <div className="alert alert-info mb-4">
        <span>{'\u{2139}'}</span>
        <div>
          Exact prices are <strong>not</strong> provided. Use the{' '}
          <a
            href={
              review.provider === 'azure'
                ? 'https://azure.microsoft.com/pricing/calculator/'
                : 'https://calculator.aws/'
            }
            target="_blank"
            rel="noreferrer"
          >
            {review.provider === 'azure' ? 'Azure' : 'AWS'} pricing calculator
          </a>{' '}
          for accurate estimates.
        </div>
      </div>

      {/* Risk filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}
        >
          All ({review.items.length})
        </button>
        {RISK_LEVELS.map((r) => (
          <button
            key={r}
            className={`btn btn-sm ${filter === r ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(r)}
            disabled={counts[r] === 0}
          >
            {r} ({counts[r]})
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="card mb-4">
        <div className="card-header">Cost Items ({filteredItems.length})</div>
        {filteredItems.length === 0 ? (
          <div className="alert alert-success mt-2">
            <span>{'\u2713'}</span>
            <div>No cost items at this risk level.</div>
          </div>
        ) : (
          <div className="project-list">
            {filteredItems.map((item) => (
              <div key={item.id} className="project-item">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`badge severity-${item.riskLevel === 'high' ? 'high' : item.riskLevel === 'medium' ? 'medium' : 'low'}`}
                      style={{ textTransform: 'uppercase', color: '#fff' }}
                    >
                      {item.riskLevel}
                    </span>
                    <span className="font-semibold">{item.category}</span>
                    {item.affectedResource && (
                      <span className="text-sm text-muted">on {item.affectedResource}</span>
                    )}
                  </div>
                  <div className="text-sm mt-1">{item.description}</div>
                  <div className="text-sm text-muted mt-1">
                    <strong>Recommendation:</strong> {item.recommendation}
                  </div>
                  <div className="text-sm mt-1">
                    <a href={item.pricingCalculatorUrl} target="_blank" rel="noreferrer">
                      Pricing calculator ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-resource cost notes */}
      {review.resourceCostNotes.length > 0 && (
        <div className="card">
          <div className="card-header">Per-Resource Cost Notes</div>
          <div className="project-list">
            {review.resourceCostNotes.map((rcn) => (
              <div key={rcn.logicalId} className="project-item">
                <div className="flex-1">
                  <div className="font-semibold">{rcn.logicalId}</div>
                  <ul className="text-sm text-muted mt-1">
                    {rcn.notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
