import { APP_INFO, APP_VERSION } from '@/lib/app-info';
import { sourceManifest } from '@/lib/data';
import EvidenceBadge from '@/components/EvidenceBadge';

export default function About() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="section-title">About &amp; Source Version</h2>
        <p className="section-subtitle">Version, provenance and privacy information.</p>
      </div>

      <div className="card mb-6">
        <div className="card-header">Application</div>
        <table className="table">
          <tbody>
            <tr>
              <td>Product</td>
              <td>{APP_INFO.name}</td>
            </tr>
            <tr>
              <td>Version</td>
              <td>
                {APP_VERSION} <span className="text-muted">({APP_INFO.buildLabel})</span>
              </td>
            </tr>
            <tr>
              <td>Organisation</td>
              <td>{APP_INFO.organisation}</td>
            </tr>
            <tr>
              <td>Author</td>
              <td>{APP_INFO.author}</td>
            </tr>
            <tr>
              <td>Evidence sync date</td>
              <td>{sourceManifest.evidenceSyncDate}</td>
            </tr>
            <tr>
              <td>Azure schema (ARM)</td>
              <td>{sourceManifest.providerSchemaVersions.azureResourceManager}</td>
            </tr>
            <tr>
              <td>AWS schema (CloudFormation)</td>
              <td>{sourceManifest.providerSchemaVersions.awsCloudFormation}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card mb-6">
        <div className="card-header">Evidence sources</div>
        <table className="table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Source</th>
              <th>Retrieved</th>
            </tr>
          </thead>
          <tbody>
            {sourceManifest.sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <EvidenceBadge classification={s.classification} title={s.title} />
                </td>
                <td className="text-sm">
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>
                </td>
                <td className="text-sm">{s.retrievedDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-muted mt-2">{sourceManifest.licenseNote}</p>
      </div>

      <div className="card">
        <div className="card-header">Privacy &amp; no-credentials statement</div>
        <p className="text-sm text-secondary">
          All processing happens locally in your browser. {APP_INFO.name} never asks for or stores
          cloud credentials, access keys, secret keys, subscription secrets, client secrets, private
          keys, temporary access passes, connection strings, SAS tokens or passwords. There is no
          server, no database, no authentication and no telemetry.
        </p>
      </div>
    </div>
  );
}
