import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  loadAllProjects,
  deleteProject,
  importProjectFromJson,
  saveProject,
  exportProjectAsJson,
} from '@/lib/storage';
import { generateId } from '@/lib/model/factory';
import { downloadJson } from '@/lib/download';
import type { TemplateProject } from '@/types';

export default function Projects() {
  const [projects, setProjects] = useState<TemplateProject[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const refresh = () => setProjects(loadAllProjects());

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete project "${name}"? This cannot be undone.`)) {
      deleteProject(id);
      refresh();
    }
  };

  const handleDuplicate = (project: TemplateProject) => {
    const now = new Date().toISOString();
    const copy: TemplateProject = {
      ...project,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      wizard: {
        ...project.wizard,
        spec: {
          ...project.wizard.spec,
          metadata: {
            ...project.wizard.spec.metadata,
            projectName: `${project.wizard.spec.metadata.projectName || 'Untitled'} (copy)`,
          },
        },
      },
    };
    saveProject(copy);
    refresh();
  };

  const handleExport = (project: TemplateProject) => {
    const name = project.wizard.spec.metadata.projectName || 'template-project';
    const safe = name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    downloadJson(`${safe}.json`, exportProjectAsJson(project));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = importProjectFromJson(reader.result as string);
        project.updatedAt = new Date().toISOString();
        saveProject(project);
        refresh();
        setImportError(null);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to import project.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Template Projects</h2>
          <p className="section-subtitle">Saved and imported lab template configurations</p>
        </div>
        <div className="flex gap-2">
          <label className="btn btn-secondary">
            Import JSON
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
          <Link to="/new" className="btn btn-primary">
            New Template
          </Link>
        </div>
      </div>

      {importError && (
        <div className="alert alert-danger">
          <span>{'\u{26A0}'}</span>
          <div>{importError}</div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{'\u{1F4C1}'}</div>
            <p>No saved projects yet.</p>
            <p className="text-sm mt-2">
              Create a new template or import a project JSON file to get started.
            </p>
            <Link to="/new" className="btn btn-primary mt-4">
              Create New Template
            </Link>
          </div>
        </div>
      ) : (
        <div className="project-list">
          {projects.map((p) => (
            <div key={p.id} className="project-item">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span
                    className={`badge ${p.wizard.spec.provider === 'azure' ? 'badge-info' : 'badge-warning'}`}
                  >
                    {p.wizard.spec.provider === 'azure' ? 'Azure' : 'AWS'}
                  </span>
                  <span className="font-semibold">
                    {p.wizard.spec.metadata.projectName || 'Untitled'}
                  </span>
                  {p.artifacts && <span className="badge badge-success">Generated</span>}
                </div>
                <div className="text-sm text-muted mt-1">
                  {p.wizard.spec.metadata.labProfileNumber || 'No lab number'} &middot;{' '}
                  {p.wizard.spec.compute.length} compute &middot; Updated{' '}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/new/${p.id}`} className="btn btn-secondary btn-sm">
                  Edit
                </Link>
                <button className="btn btn-secondary btn-sm" onClick={() => handleDuplicate(p)}>
                  Duplicate
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleExport(p)}>
                  Export
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(p.id, p.wizard.spec.metadata.projectName)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
