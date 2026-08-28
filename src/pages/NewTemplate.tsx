import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CloudProvider } from '@/types';
import { createEmptyProject } from '@/lib/model/factory';
import { saveProject, loadProject } from '@/lib/storage';
import { detectSecrets } from '@/lib/secret-detector';

export default function NewTemplate() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const existing = projectId ? loadProject(projectId) : null;

  const [provider, setProvider] = useState<CloudProvider>(
    existing?.wizard.spec.provider ?? 'azure',
  );
  const [projectName, setProjectName] = useState(existing?.wizard.spec.metadata.projectName ?? '');
  const [secretWarning, setSecretWarning] = useState<string | null>(null);

  const handleCreate = () => {
    const result = detectSecrets(projectName);
    if (result.detected) {
      setSecretWarning(result.warnings.join(' '));
      return;
    }
    const project = existing ?? createEmptyProject(provider);
    project.wizard.spec.provider = provider;
    // Keep provider config aligned with the chosen provider.
    if (provider !== project.wizard.spec.providerConfig.kind) {
      const fresh = createEmptyProject(provider);
      project.wizard.spec.providerConfig = fresh.wizard.spec.providerConfig;
    }
    project.wizard.spec.metadata.projectName = projectName || 'Untitled Template';
    saveProject(project);
    navigate('/projects');
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="section-title">
          {existing ? 'Edit Template Project' : 'New Template Project'}
        </h2>
        <p className="section-subtitle">
          Start by naming the project and choosing a cloud provider. The full guided wizard
          (compute, networking, storage, identity, initialisation and generation) is delivered in
          the upcoming phases.
        </p>
      </div>

      <div className="card">
        <div className="card-header">Template Project</div>

        <div className="form-group">
          <label className="form-label" htmlFor="projectName">
            Project name
          </label>
          <input
            id="projectName"
            className="form-input"
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              setSecretWarning(null);
            }}
            placeholder="e.g. Azure Linux VM Lab"
          />
        </div>

        <div className="form-group">
          <span className="form-label">Cloud provider</span>
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              className={`btn ${provider === 'azure' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setProvider('azure')}
            >
              Microsoft Azure
            </button>
            <button
              type="button"
              className={`btn ${provider === 'aws' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setProvider('aws')}
            >
              Amazon Web Services
            </button>
          </div>
          <p className="text-sm text-muted mt-2">
            {provider === 'azure'
              ? 'Azure outputs Bicep and ARM JSON. Deployment container: Resource Group.'
              : 'AWS outputs CloudFormation (YAML by default, JSON where appropriate). Deployment container: CloudFormation Stack.'}
          </p>
          <p className="text-sm text-muted mt-2">
            Azure and AWS templates are not one-to-one interchangeable; each uses its native model.
          </p>
        </div>

        {secretWarning && (
          <div className="alert alert-danger">
            <span>{'\u{26A0}'}</span>
            <div>{secretWarning}</div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary" onClick={handleCreate}>
            {existing ? 'Save Project' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
