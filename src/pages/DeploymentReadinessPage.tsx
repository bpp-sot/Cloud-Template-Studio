// Deployment Readiness page — Development Brief §14.
//
// Aggregates security and cost findings into a deployment readiness gate.
// Shows pass/warn/fail checks, blocking and warning findings, and an overall
// ready / needs-attention / blocked status.
// Accessible from the Review hub at /review/:projectId/deployment.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadProject } from '@/lib/storage';
import { generateDeploymentReadiness, deploymentReadinessToText } from '@/lib/deployment-readiness';
import { copyToClipboard, downloadText } from '@/lib/download';
import type { TemplateProject } from '@/types';
import type { DeploymentReadiness as DeploymentReadinessType } from '@/types';

export default function DeploymentReadinessPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<TemplateProject | null>(null);
  const [readiness, setReadiness] = useState<DeploymentReadinessType | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const p = loadProject(projectId);
    setProject(p);
    if (p?.artifacts?.internalModel) {
      setReadiness(generateDeploymentReadiness(p.wizard.spec, p.artifacts.internalModel));
    }
  }, [projectId]);

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

  if (!readiness) {
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
    const ok = await copyToClipboard(deploymentReadinessToText(readiness));
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadText(`${safeName}-deployment-readiness.txt`, deploymentReadinessToText(readiness));
  };

  const statusConfig = {
    ready: { class: 'severity-low', label: 'READY', color: 'var(--accent-success)' },
    'needs-attention': {
      class: 'severity-medium',
      label: 'NEEDS ATTENTION',
      color: 'var(--accent-warning)',
    },
    blocked: { class: 'severity-critical', label: 'BLOCKED', color: 'var(--accent-danger)' },
  } as const;

  const cfg = statusConfig[readiness.overallStatus];
  const passCount = readiness.checks.filter((c) => c.status === 'pass').length;
  const warnCount = readiness.checks.filter((c) => c.status === 'warn').length;
  const failCount = readiness.checks.filter((c) => c.status === 'fail').length;

  const checkSymbol = (status: 'pass' | 'warn' | 'fail') =>
    status === 'pass' ? '\u2713' : status === 'warn' ? '\u26A0' : '\u2717';
  const checkColor = (status: 'pass' | 'warn' | 'fail') =>
    status === 'pass'
      ? 'var(--accent-success)'
      : status === 'warn'
        ? 'var(--accent-warning)'
        : 'var(--accent-danger)';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Deployment Readiness</h2>
          <p className="section-subtitle">
            {readiness.projectName} &middot;{' '}
            {readiness.provider === 'azure' ? 'Microsoft Azure' : 'Amazon Web Services'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/review/${projectId}`} className="btn btn-secondary btn-sm">
            Back to Review
          </Link>
        </div>
      </div>

      {/* Overall status */}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted">Overall Readiness Status</div>
            <div className="text-2xl font-bold" style={{ color: cfg.color }}>
              {cfg.label}
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
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: 'var(--accent-success)' }}>
              {passCount}
            </div>
            <div className="text-xs text-muted">pass</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: 'var(--accent-warning)' }}>
              {warnCount}
            </div>
            <div className="text-xs text-muted">warn</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: 'var(--accent-danger)' }}>
              {failCount}
            </div>
            <div className="text-xs text-muted">fail</div>
          </div>
        </div>
      </div>

      {/* Boundary warning */}
      <div className="alert alert-warning mb-4">
        <span>{'\u{26A0}'}</span>
        <div>
          This readiness assessment does <strong>not</strong> confirm the template will deploy
          successfully. External testing in a non-production environment is required before
          Skillable use.
        </div>
      </div>

      {/* Checks */}
      <div className="card mb-4">
        <div className="card-header">Readiness Checks ({readiness.checks.length})</div>
        <div className="project-list">
          {readiness.checks.map((check) => (
            <div key={check.id} className="project-item">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg" style={{ color: checkColor(check.status) }}>
                    {checkSymbol(check.status)}
                  </span>
                  <span className="font-semibold">{check.label}</span>
                  <span
                    className="badge"
                    style={{
                      background: checkColor(check.status),
                      color: '#fff',
                      textTransform: 'uppercase',
                    }}
                  >
                    {check.status}
                  </span>
                </div>
                <div className="text-sm text-muted mt-1">{check.description}</div>
                <div className="text-sm mt-1">{check.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blocking findings */}
      {readiness.blockingFindings.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">Blocking Findings ({readiness.blockingFindings.length})</div>
          <div className="alert alert-danger mt-2">
            <span>{'\u2717'}</span>
            <div>These findings must be resolved before the template is ready for deployment.</div>
          </div>
          <div className="project-list mt-2">
            {readiness.blockingFindings.map((f) => (
              <div key={f.id} className="project-item">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="badge severity-critical" style={{ color: '#fff' }}>
                      {f.severity}
                    </span>
                    <span className="font-semibold">{f.category}</span>
                  </div>
                  <div className="text-sm mt-1">{f.description}</div>
                  <div className="text-sm text-muted mt-1">
                    <strong>Recommendation:</strong> {f.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning findings */}
      {readiness.warningFindings.length > 0 && (
        <div className="card">
          <div className="card-header">Warning Findings ({readiness.warningFindings.length})</div>
          <div className="project-list">
            {readiness.warningFindings.map((f) => (
              <div key={f.id} className="project-item">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="badge severity-high" style={{ color: '#fff' }}>
                      {f.severity}
                    </span>
                    <span className="font-semibold">{f.category}</span>
                  </div>
                  <div className="text-sm mt-1">{f.description}</div>
                  <div className="text-sm text-muted mt-1">
                    <strong>Recommendation:</strong> {f.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
