import { Link } from 'react-router-dom';
import { APP_INFO, APP_VERSION, BOUNDARY_STATEMENT } from '@/lib/app-info';
import { sourceManifest } from '@/lib/data';

const features = [
  {
    icon: '\u{1F9ED}',
    title: 'Wizard-Driven',
    description:
      'Describe your lab and its learning requirements step by step. The studio maps them to provider-appropriate infrastructure — no template authoring required.',
  },
  {
    icon: '\u{2601}',
    title: 'Azure & AWS',
    description:
      'Generate Azure Bicep and ARM JSON, or AWS CloudFormation (YAML and JSON). Each provider uses its own native model — never a false one-to-one conversion.',
  },
  {
    icon: '\u{1F50D}',
    title: 'Evidence-Traced',
    description:
      'Every resource, dependency and recommendation carries an evidence classification (A\u2013G) and a traceable source. Nothing is invented.',
  },
  {
    icon: '\u{1F517}',
    title: 'Dependency-Aware',
    description:
      'Required supporting resources are identified and clearly marked as auto-included. Optional infrastructure stays opt-in and is never silently added.',
  },
  {
    icon: '\u{1F6E1}',
    title: 'Security & Cost Review',
    description:
      'Structured findings flag public exposure, unrestricted CIDRs, oversized compute and cost drivers before you generate.',
  },
  {
    icon: '\u{1F4BB}',
    title: 'Local & Private',
    description:
      'All generation happens in your browser. No cloud credentials, no secrets, no server, no telemetry.',
  },
];

export default function Home() {
  return (
    <div>
      <div className="hero">
        <div className="hero-eyebrow">{APP_INFO.organisation}</div>
        <h1>{APP_INFO.name}</h1>
        <p className="hero-tagline">{APP_INFO.tagline}</p>
        <p className="hero-description">
          Design secure cloud lab infrastructure and generate provider-appropriate
          Infrastructure-as-Code &mdash; Azure Bicep/ARM and AWS CloudFormation &mdash; from
          evidence-backed patterns, entirely in the browser.
        </p>
        <div className="hero-actions">
          <Link to="/new" className="btn btn-primary btn-lg">
            Start New Template
          </Link>
          <Link to="/explorer" className="btn btn-secondary btn-lg">
            Browse Patterns
          </Link>
        </div>
        <div className="hero-version">
          <span className="badge badge-version">{APP_VERSION}</span>
          <span className="text-muted text-xs">Build: {APP_INFO.buildLabel}</span>
        </div>
      </div>

      <div className="feature-grid">
        {features.map((f) => (
          <div key={f.title} className="feature-card">
            <div className="feature-card-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.description}</p>
          </div>
        ))}
      </div>

      <div className="alert alert-warning mt-6">
        <strong>Important product boundary.</strong> {BOUNDARY_STATEMENT} This studio is a template
        generator and review tool: it does not connect to Azure or AWS, deploy infrastructure, or
        validate quota, SKU or region capacity.
      </div>

      <div className="card mt-6">
        <div className="card-header">Evidence Source</div>
        <p className="text-sm text-secondary">
          Generation is grounded in a curated snapshot of official provider and Skillable
          documentation. Every catalogue entry records its source, evidence classification and
          review date.
        </p>
        <div className="flex gap-3 mt-4">
          {sourceManifest.sources.map((s) => (
            <span key={s.id} className="badge badge-neutral" title={s.title}>
              Class {s.classification}: {s.title.split(' \u2014 ')[0].split(' (')[0]}
            </span>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <span className="badge badge-success">
            Evidence synced {sourceManifest.evidenceSyncDate}
          </span>
          <span className="badge badge-neutral">
            ARM {sourceManifest.providerSchemaVersions.azureResourceManager}
          </span>
          <span className="badge badge-neutral">
            CloudFormation {sourceManifest.providerSchemaVersions.awsCloudFormation}
          </span>
        </div>
      </div>
    </div>
  );
}
