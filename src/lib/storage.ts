// localStorage project persistence + JSON import/export — Brief §7.3, §5.
// No backend, no credentials, no telemetry. Mirrors SoT Policy Studio.

import { LAB_SPEC_SCHEMA_VERSION, type TemplateProject } from '@/types';

const STORAGE_PREFIX = 'sot-cts-project-';
const INDEX_KEY = 'sot-cts-project-index';

export function getProjectIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveProject(project: TemplateProject): void {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  localStorage.setItem(`${STORAGE_PREFIX}${project.id}`, JSON.stringify(updated));
  const index = getProjectIndex();
  if (!index.includes(project.id)) {
    index.push(project.id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }
}

export function loadProject(id: string): TemplateProject | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    const project = JSON.parse(raw) as TemplateProject;
    // Backward compatibility: ensure Phase 5 arrays exist on older saved projects.
    const spec = project.wizard?.spec;
    if (spec) {
      if (!spec.appHosting) spec.appHosting = [];
      if (!spec.serverless) spec.serverless = [];
      if (!spec.containers) spec.containers = [];
    }
    return project;
  } catch {
    return null;
  }
}

export function loadAllProjects(): TemplateProject[] {
  return getProjectIndex()
    .map((id) => loadProject(id))
    .filter((p): p is TemplateProject => p !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteProject(id: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  const index = getProjectIndex().filter((i) => i !== id);
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function exportProjectAsJson(project: TemplateProject): string {
  return JSON.stringify(project, null, 2);
}

export function importProjectFromJson(json: string): TemplateProject {
  const parsed = JSON.parse(json) as TemplateProject;
  if (!parsed.id || !parsed.wizard || !parsed.wizard.spec) {
    throw new Error('Invalid project file: missing required fields (id, wizard.spec).');
  }
  if (parsed.wizard.spec.schemaVersion !== LAB_SPEC_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported lab specification schema version: ${parsed.wizard.spec.schemaVersion ?? 'unknown'}. Expected ${LAB_SPEC_SCHEMA_VERSION}.`,
    );
  }
  return parsed;
}
