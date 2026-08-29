// Security Review page — Development Brief §13.
//
// Dedicated security review page with severity filtering, evidence
// traceability, overall risk assessment, and copy/download support.
// Accessible from the Review hub at /review/:projectId/security.

import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadProject } from '@/lib/storage';
import { generateSecurityReview, securityReviewToText } from '@/lib/security-review';
import { copyToClipboard, downloadText } from '@/lib/download';
import EvidenceBadge from '@/components/EvidenceBadge';
import type { TemplateProject, FindingSeverity } from '@/types';
import type { SecurityReview as SecurityReviewType } from '@/types';

const SEVERITIES: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

export default function SecurityReviewPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<TemplateProject | null>(null);
  const [review, setReview] = useState<SecurityReviewType | null>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<FindingSeverity | 'all'>('all');

  useEffect(() => {
    if (!projectId) return;
    const p = loadProject(projectId);
    setProject(p);
    if (p?.artifacts?.internalModel) {
      setReview(generateSecurityReview(p.wizard.spec, p.artifacts.internalModel));
    }
  }, [projectId]);

  const filteredItems = useMemo(() => {
    if (!review) return [];
    if (filter === 'all') return review.items;
    return review.items.filter((i) => i.severity === filter);
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
    const ok = await copyToClipboard(securityReviewToText(review));
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadText(`${safeName}-security-review.txt`, securityReviewToText(review));
  };

  const riskClass = `severity-${review.overallRisk}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Security Review</h2>
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
            <div className="text-sm text-muted">Overall Risk Assessment</div>
            <div className={`text-2xl font-bold ${riskClass}`}>
              {review.overallRisk.toUpperCase()}
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
          {SEVERITIES.map((s) => (
            <div key={s} className="text-center">
              <div className={`text-lg font-bold severity-${s}`}>{review.counts[s]}</div>
              <div className="text-xs text-muted">{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Boundary warning */}
      <div className="alert alert-warning mb-4">
        <span>{'\u{26A0}'}</span>
        <div>
          This security review does <strong>not</strong> constitute penetration testing, deployment
          confirmation, or Skillable approval. Templates must be externally tested in a
          non-production environment.
        </div>
      </div>

      {/* Severity filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}
        >
          All ({review.items.length})
        </button>
        {SEVERITIES.map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(s)}
            disabled={review.counts[s] === 0}
          >
            {s} ({review.counts[s]})
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="card">
        <div className="card-header">Security Items ({filteredItems.length})</div>
        {filteredItems.length === 0 ? (
          <div className="alert alert-success mt-2">
            <span>{'\u2713'}</span>
            <div>
              No security items at this severity level. The configuration follows the application's
              security defaults.
            </div>
          </div>
        ) : (
          <div className="project-list">
            {filteredItems.map((item) => (
              <div key={item.id} className="project-item">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`badge severity-${item.severity}`}
                      style={{ textTransform: 'uppercase', color: '#fff' }}
                    >
                      {item.severity}
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
                  {item.evidence && (
                    <div className="flex gap-1 mt-2">
                      <EvidenceBadge
                        classification={item.evidence.classification}
                        title={item.evidence.rationale}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
