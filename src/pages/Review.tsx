// Review page — Development Brief §13, §14, §15.
//
// Displays the generated provider templates, internal model, resource inventory,
// dependency graph, evidence, security/cost findings, and Skillable deployment
// guidance. All sections derive from the same InternalModel used by the
// generators so reviews and templates cannot drift apart (Brief §15).

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadProject, exportProjectAsJson } from '@/lib/storage';
import { exportForPolicyStudioAsJson } from '@/lib/policy-studio-export';
import { copyToClipboard, downloadText, downloadJson } from '@/lib/download';
import { generateLearnerInstructions } from '@/lib/instructions';
import { generateValidationChecklist } from '@/lib/checklist';
import EvidenceBadge from '@/components/EvidenceBadge';
import type { GeneratedArtifacts, ReviewFinding, TemplateProject } from '@/types';

type AzureTab = 'bicep' | 'arm' | 'parameters' | 'summary';
type AwsTab = 'cfnYaml' | 'cfnJson' | 'parameters' | 'summary';
type Tab = AzureTab | AwsTab;

export default function Review() {
  const { projectId } = useParams();
  const [project, setProject] = useState<TemplateProject | null>(null);
  const [tab, setTab] = useState<Tab>('bicep');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (projectId) setProject(loadProject(projectId));
  }, [projectId]);

  if (!project) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">{'\u{1F50D}'}</div>
          <p>Project not found.</p>
          <Link to="/projects" className="btn btn-primary mt-4">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const artifacts = project.artifacts;
  if (!artifacts) {
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

  const model = artifacts.internalModel;
  const isAzure = artifacts.provider === 'azure';

  const handleCopy = async (text: string | undefined) => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = (filename: string, text: string | undefined, mime = 'text/plain') => {
    if (!text) return;
    downloadText(filename, text, mime);
  };

  const safeName = (project.wizard.spec.metadata.projectName || 'template')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .toLowerCase();

  const azureTabs: Array<{ id: AzureTab; label: string; available: boolean }> = [
    { id: 'bicep', label: 'Bicep', available: !!artifacts.bicep },
    { id: 'arm', label: 'ARM JSON', available: !!artifacts.armJson },
    { id: 'parameters', label: 'Parameters', available: !!artifacts.parametersJson },
    { id: 'summary', label: 'Summary', available: true },
  ];
  const awsTabs: Array<{ id: AwsTab; label: string; available: boolean }> = [
    { id: 'cfnYaml', label: 'CloudFormation YAML', available: !!artifacts.cloudFormationYaml },
    { id: 'cfnJson', label: 'CloudFormation JSON', available: !!artifacts.cloudFormationJson },
    { id: 'parameters', label: 'Parameters', available: !!artifacts.parametersJson },
    { id: 'summary', label: 'Summary', available: true },
  ];
  const tabs = isAzure ? azureTabs : awsTabs;
  const activeTab = tabs.find((t) => t.id === tab && t.available) ?? tabs.find((t) => t.available)!;

  const handleDownloadInstructions = () => {
    if (!model) return;
    const md = generateLearnerInstructions(project.wizard.spec, model);
    downloadText(`${safeName}-learner-instructions.md`, md, 'text/markdown');
  };

  const handleDownloadChecklist = () => {
    if (!model) return;
    const md = generateValidationChecklist(project.wizard.spec, model);
    downloadText(`${safeName}-validation-checklist.md`, md, 'text/markdown');
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Review &amp; Download</h2>
          <p className="section-subtitle">
            {project.wizard.spec.metadata.projectName || 'Untitled'} &middot;{' '}
            {isAzure ? 'Microsoft Azure' : 'Amazon Web Services'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/new/${project.id}`} className="btn btn-secondary">
            Edit Spec
          </Link>
          <button
            className="btn btn-secondary"
            onClick={() => downloadJson(`${safeName}.json`, exportProjectAsJson(project))}
          >
            Export Project
          </button>
        </div>
      </div>

      <div className="alert alert-info mb-4">
        <span>{'\u{2139}'}</span>
        <div>
          Generated templates are <strong>not</strong> penetration-tested, deployment-confirmed, or
          Skillable-approved. They must be externally tested in a non-production environment before
          production or Skillable use.
        </div>
      </div>

      {/* Jump menu — sticky in-page navigation.
          Uses scrollIntoView via onClick, NOT href anchors, because
          HashRouter already uses the URL hash for routing. Anchor hrefs
          like "#section-templates" would conflict with the router. */}
      <nav className="jump-menu" aria-label="Section navigation">
        <button
          type="button"
          className="jump-menu-link"
          onClick={() => scrollToSection('section-templates')}
        >
          Templates
        </button>
        <button
          type="button"
          className="jump-menu-link"
          onClick={() => scrollToSection('section-resources')}
        >
          Resources
        </button>
        {model && model.findings.length > 0 && (
          <button
            type="button"
            className="jump-menu-link"
            onClick={() => scrollToSection('section-findings')}
          >
            Findings ({model.findings.length})
          </button>
        )}
        {model && model.parameters.length > 0 && (
          <button
            type="button"
            className="jump-menu-link"
            onClick={() => scrollToSection('section-parameters')}
          >
            Parameters ({model.parameters.length})
          </button>
        )}
        {model && model.outputs.length > 0 && (
          <button
            type="button"
            className="jump-menu-link"
            onClick={() => scrollToSection('section-outputs')}
          >
            Outputs ({model.outputs.length})
          </button>
        )}
        <button
          type="button"
          className="jump-menu-link"
          onClick={() => scrollToSection('section-downloads')}
        >
          Downloads
        </button>
        <button
          type="button"
          className="jump-menu-link"
          onClick={() => scrollToSection('section-reviews')}
        >
          Dedicated Reviews
        </button>
      </nav>

      {/* Generated Templates — first, as the primary output */}
      <div className="card mb-4" id="section-templates">
        <div className="card-header">Generated Templates</div>
        <div className="flex gap-2 mb-4 flex-wrap">
          {tabs
            .filter((t) => t.available)
            .map((t) => (
              <button
                key={t.id}
                className={`btn btn-sm ${activeTab.id === t.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
        </div>

        {activeTab.id === 'bicep' && artifacts.bicep && (
          <CodeBlock
            code={artifacts.bicep}
            onCopy={() => handleCopy(artifacts.bicep)}
            onDownload={() => handleDownload(`${safeName}.bicep`, artifacts.bicep)}
            copied={copied}
            language="bicep"
          />
        )}
        {activeTab.id === 'arm' && artifacts.armJson && (
          <CodeBlock
            code={artifacts.armJson}
            onCopy={() => handleCopy(artifacts.armJson)}
            onDownload={() =>
              handleDownload(`${safeName}.arm.json`, artifacts.armJson, 'application/json')
            }
            copied={copied}
            language="json"
          />
        )}
        {activeTab.id === 'cfnYaml' && artifacts.cloudFormationYaml && (
          <CodeBlock
            code={artifacts.cloudFormationYaml}
            onCopy={() => handleCopy(artifacts.cloudFormationYaml)}
            onDownload={() =>
              handleDownload(
                `${safeName}.cloudformation.yaml`,
                artifacts.cloudFormationYaml,
                'text/yaml',
              )
            }
            copied={copied}
            language="yaml"
          />
        )}
        {activeTab.id === 'cfnJson' && artifacts.cloudFormationJson && (
          <CodeBlock
            code={artifacts.cloudFormationJson}
            onCopy={() => handleCopy(artifacts.cloudFormationJson)}
            onDownload={() =>
              handleDownload(
                `${safeName}.cloudformation.json`,
                artifacts.cloudFormationJson,
                'application/json',
              )
            }
            copied={copied}
            language="json"
          />
        )}
        {activeTab.id === 'parameters' && artifacts.parametersJson && (
          <CodeBlock
            code={artifacts.parametersJson}
            onCopy={() => handleCopy(artifacts.parametersJson)}
            onDownload={() =>
              handleDownload(
                `${safeName}.parameters.json`,
                artifacts.parametersJson,
                'application/json',
              )
            }
            copied={copied}
            language="json"
          />
        )}
        {activeTab.id === 'summary' && <SummaryView artifacts={artifacts} />}
      </div>

      {/* Resource inventory */}
      {model && (
        <div className="card mb-4" id="section-resources">
          <div className="card-header">Resource Inventory ({model.resources.length})</div>
          <div className="project-list">
            {model.resources.map((r) => (
              <div key={r.logicalId} className="project-item">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{r.logicalId}</span>
                    <span className="badge badge-info">{r.providerResourceType}</span>
                    {r.autoIncluded && <span className="badge badge-success">Auto-included</span>}
                    {r.origin === 'user' && <span className="badge badge-warning">User</span>}
                  </div>
                  <div className="text-sm text-muted mt-1">{r.purpose}</div>
                  {r.dependsOn.length > 0 && (
                    <div className="text-sm mt-1">
                      <span className="text-muted">Depends on:</span>{' '}
                      {r.dependsOn.map((d) => (
                        <span key={d} className="badge badge-info" style={{ marginRight: '4px' }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.warnings.length > 0 && (
                    <div className="text-sm mt-1" style={{ color: 'var(--accent-warning)' }}>
                      {r.warnings.join(' ')}
                    </div>
                  )}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {r.evidence.map((e, i) => (
                      <EvidenceBadge
                        key={i}
                        classification={e.classification}
                        title={e.rationale}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      {model && model.findings.length > 0 && (
        <div className="card mb-4" id="section-findings">
          <div className="card-header">Findings ({model.findings.length})</div>
          <FindingsList findings={model.findings} />
        </div>
      )}

      {/* Parameters */}
      {model && model.parameters.length > 0 && (
        <div className="card mb-4" id="section-parameters">
          <div className="card-header">Parameters ({model.parameters.length})</div>
          <div className="project-list">
            {model.parameters.map((p) => (
              <div key={p.name} className="project-item">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <span className="badge badge-info">{p.type}</span>
                    {p.secure && <span className="badge badge-warning">Secure</span>}
                  </div>
                  <div className="text-sm text-muted mt-1">{p.description}</div>
                  {p.defaultValue !== undefined && !p.secure && (
                    <div className="text-sm mt-1">
                      <span className="text-muted">Default:</span> {String(p.defaultValue)}
                    </div>
                  )}
                  {p.secure && (
                    <div className="text-sm mt-1" style={{ color: 'var(--accent-warning)' }}>
                      No default &mdash; supply at deployment time. Never commit secrets.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outputs */}
      {model && model.outputs.length > 0 && (
        <div className="card mb-4" id="section-outputs">
          <div className="card-header">Outputs ({model.outputs.length})</div>
          <div className="project-list">
            {model.outputs.map((o) => (
              <div key={o.name} className="project-item">
                <div className="flex-1">
                  <div className="font-semibold">{o.name}</div>
                  <div className="text-sm text-muted mt-1">{o.description}</div>
                  <code className="text-sm">{o.valueExpression}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Downloads bar */}
      <div className="card mb-4" id="section-downloads">
        <div className="card-header">Downloads</div>
        <div className="flex gap-2 flex-wrap mt-2">
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadInstructions}>
            {'\u{1F4DD}'} Learner Instructions (Markdown)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadChecklist}>
            {'\u{2705}'} Validation Checklist (Markdown)
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => downloadJson(`${safeName}.json`, exportProjectAsJson(project))}
          >
            {'\u{1F4E5}'} Project JSON
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() =>
              downloadJson(
                `${safeName}-policy-studio.json`,
                exportForPolicyStudioAsJson(project.wizard.spec),
              )
            }
            title="Export provider-neutral Lab Specification for SoT Policy Studio"
          >
            {'\u{1F504}'} Policy Studio Export
          </button>
        </div>
      </div>

      {/* Dedicated review hub */}
      <div className="card mb-4" id="section-reviews">
        <div className="card-header">Dedicated Reviews</div>
        <p className="text-sm text-muted mt-2">
          Deep-dive into security, cost, and deployment readiness with dedicated review engines.
        </p>
        <div className="flex gap-2 flex-wrap mt-2">
          <Link to={`/review/${projectId}/security`} className="btn btn-secondary btn-sm">
            {'\u{1F6E1}'} Security Review
          </Link>
          <Link to={`/review/${projectId}/cost`} className="btn btn-secondary btn-sm">
            {'\u{1F4B0}'} Cost Review
          </Link>
          <Link to={`/review/${projectId}/deployment`} className="btn btn-secondary btn-sm">
            {'\u{2705}'} Deployment Readiness
          </Link>
        </div>
      </div>
    </div>
  );
}

function FindingsList({ findings }: { findings: ReviewFinding[] }) {
  const severityColor: Record<ReviewFinding['severity'], string> = {
    critical: 'var(--accent-danger)',
    high: 'var(--accent-danger)',
    medium: 'var(--accent-warning)',
    low: 'var(--accent-warning)',
    info: 'var(--accent-info)',
  };
  return (
    <div className="project-list">
      {findings.map((f) => (
        <div key={f.id} className="project-item">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{f.category}</span>
              <span
                className="badge"
                style={{ background: severityColor[f.severity], color: '#fff' }}
              >
                {f.severity}
              </span>
              <span className="badge badge-info">{f.kind}</span>
              {f.affectedResource && (
                <span className="text-sm text-muted">on {f.affectedResource}</span>
              )}
            </div>
            <div className="text-sm mt-1">{f.description}</div>
            <div className="text-sm text-muted mt-1">
              <strong>Recommendation:</strong> {f.recommendation}
            </div>
            {f.evidence && (
              <div className="flex gap-1 mt-2">
                <EvidenceBadge
                  classification={f.evidence.classification}
                  title={f.evidence.rationale}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CodeBlock({
  code,
  onCopy,
  onDownload,
  copied,
  language,
}: {
  code: string;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
  language: string;
}) {
  return (
    <div>
      <div className="flex gap-2 mb-2 justify-end">
        <button className="btn btn-secondary btn-sm" onClick={onCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onDownload}>
          Download
        </button>
      </div>
      <pre className="code-block" data-language={language}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SummaryView({ artifacts }: { artifacts: GeneratedArtifacts }) {
  const model = artifacts.internalModel;
  if (!model) return <p className="text-muted">No internal model available.</p>;

  const secFindings = model.findings.filter((f) => f.kind === 'security');
  const costFindings = model.findings.filter((f) => f.kind === 'cost');
  const depFindings = model.findings.filter((f) => f.kind === 'dependency');
  const isAzure = artifacts.provider === 'azure';

  return (
    <div>
      <h3 className="section-title">Skillable Deployment Guidance</h3>
      <p className="text-sm text-muted mb-4">
        This summary is generated from the internal infrastructure model. It must be externally
        validated before Skillable use.
      </p>

      <div className="card mb-4">
        <div className="card-header">Deployment Container</div>
        <p className="text-sm">
          {isAzure
            ? 'Azure Resource Group. Deploy with az deployment group create or the Azure Portal.'
            : 'AWS CloudFormation Stack. Deploy with aws cloudformation deploy or the AWS Console.'}
        </p>
      </div>

      <div className="card mb-4">
        <div className="card-header">Security Review ({secFindings.length})</div>
        {secFindings.length > 0 ? (
          <FindingsList findings={secFindings} />
        ) : (
          <p className="text-sm text-muted">
            No security findings. Default posture denies inbound traffic.
          </p>
        )}
        <div className="alert alert-info mt-2">
          <span>{'\u{2139}'}</span>
          <div>
            This review does <strong>not</strong> constitute penetration testing, deployment
            confirmation, or Skillable approval. Templates must be externally tested.
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">Cost Review ({costFindings.length})</div>
        {costFindings.length > 0 ? (
          <FindingsList findings={costFindings} />
        ) : (
          <p className="text-sm text-muted">No elevated cost findings.</p>
        )}
        <div className="alert alert-info mt-2">
          <span>{'\u{2139}'}</span>
          <div>
            Exact prices are not provided. Use the{' '}
            {isAzure ? (
              <a
                href="https://azure.microsoft.com/pricing/calculator/"
                target="_blank"
                rel="noreferrer"
              >
                Azure pricing calculator
              </a>
            ) : (
              <a href="https://calculator.aws/" target="_blank" rel="noreferrer">
                AWS pricing calculator
              </a>
            )}{' '}
            for accurate estimates.
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">Dependency Notes ({depFindings.length})</div>
        {depFindings.length > 0 ? (
          <FindingsList findings={depFindings} />
        ) : (
          <p className="text-sm text-muted">No auto-included dependency notes.</p>
        )}
      </div>

      <div className="card">
        <div className="card-header">Deployment Validation Checklist</div>
        <ul className="text-sm">
          <li>&#9744; Deploy the template in a non-production environment.</li>
          <li>&#9744; Verify initialization scripts complete successfully.</li>
          <li>&#9744; Verify cleanup removes all generated resources.</li>
          <li>&#9744; Confirm region and SKU availability in your subscription.</li>
          {isAzure && (
            <li>
              &#9744; Confirm a compatible Skillable Azure ACP exists where learners create
              resources.
            </li>
          )}
          {!isAzure && (
            <li>
              &#9744; Confirm a compatible Skillable AWS IAM policy exists where learners create
              resources.
            </li>
          )}
          <li>&#9744; Record the tested template version and date.</li>
          <li>&#9744; Confirm Skillable compatibility with the lab platform.</li>
        </ul>
        <div className="text-sm text-muted mt-2">
          Download the full validation checklist from the Downloads section above.
        </div>
      </div>
    </div>
  );
}
