import { describe, it, expect, beforeEach } from 'vitest';
import { exportProjectAsJson, importProjectFromJson } from './storage';
import { createEmptyProject } from './model/factory';

describe('project import/export', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a project through JSON export and import', () => {
    const project = createEmptyProject('azure');
    project.wizard.spec.metadata.projectName = 'Round Trip Lab';
    const json = exportProjectAsJson(project);
    const parsed = importProjectFromJson(json);
    expect(parsed.id).toBe(project.id);
    expect(parsed.wizard.spec.metadata.projectName).toBe('Round Trip Lab');
    expect(parsed.wizard.spec.provider).toBe('azure');
  });

  it('rejects a file missing required fields', () => {
    expect(() => importProjectFromJson('{"foo":1}')).toThrow(/Invalid project file/);
  });

  it('rejects an unsupported schema version', () => {
    const project = createEmptyProject('aws');
    const mutated = JSON.parse(exportProjectAsJson(project));
    mutated.wizard.spec.schemaVersion = 'cloud-template-studio/v0';
    expect(() => importProjectFromJson(JSON.stringify(mutated))).toThrow(/schema version/);
  });
});
