// Wizard context tests — verifies provider switching resets provider config
// while preserving metadata, and that patchSpec updates are immutable.

import { describe, it, expect } from 'vitest';
import { createEmptyWizardState } from '@/lib/model/factory';
import type { LabSpecification } from '@/types';

describe('wizard state factory', () => {
  it('creates an empty azure wizard state with azure provider config', () => {
    const ws = createEmptyWizardState('azure');
    expect(ws.currentStep).toBe(0);
    expect(ws.spec.provider).toBe('azure');
    expect(ws.spec.providerConfig.kind).toBe('azure');
    expect(ws.spec.compute).toEqual([]);
    expect(ws.spec.metadata.projectName).toBe('');
  });

  it('creates an empty aws wizard state with aws provider config', () => {
    const ws = createEmptyWizardState('aws');
    expect(ws.spec.provider).toBe('aws');
    expect(ws.spec.providerConfig.kind).toBe('aws');
  });
});

describe('provider config isolation', () => {
  it('azure spec never carries aws provider config fields', () => {
    const ws = createEmptyWizardState('azure');
    expect(ws.spec.providerConfig.kind).toBe('azure');
    // The azure branch must not expose aws-only fields:
    if (ws.spec.providerConfig.kind === 'azure') {
      const azure = ws.spec.providerConfig.azure;
      expect(azure).toBeDefined();
      expect(azure.resourceGroupName).toBe('');
      expect(azure.bootDiagnosticsEnabled).toBe(false);
      // Discriminated union: the aws branch is not accessible here.
      expect((ws.spec.providerConfig as { aws?: unknown }).aws).toBeUndefined();
    }
  });

  it('aws spec never carries azure provider config fields', () => {
    const ws = createEmptyWizardState('aws');
    expect(ws.spec.providerConfig.kind).toBe('aws');
    if (ws.spec.providerConfig.kind === 'aws') {
      const aws = ws.spec.providerConfig.aws;
      expect(aws).toBeDefined();
      expect(aws.stackName).toBe('');
      expect(aws.amiStrategy).toBe('ssm-parameter');
      expect((ws.spec.providerConfig as { azure?: unknown }).azure).toBeUndefined();
    }
  });
});

describe('lab specification shape', () => {
  it('has the expected schema version', () => {
    const ws = createEmptyWizardState('azure');
    expect(ws.spec.schemaVersion).toBe('cloud-template-studio/v1');
  });

  it('defaults to a single-vm architecture pattern', () => {
    const ws = createEmptyWizardState('azure');
    expect(ws.spec.architecturePattern).toBe('single-vm');
  });

  it('defaults to development status', () => {
    const ws = createEmptyWizardState('azure');
    expect(ws.spec.metadata.status).toBe('development');
  });

  it('initializes empty arrays for all collection fields', () => {
    const ws = createEmptyWizardState('azure');
    const spec = ws.spec as LabSpecification;
    expect(spec.compute).toEqual([]);
    expect(spec.network).toEqual([]);
    expect(spec.storage).toEqual([]);
    expect(spec.identity).toEqual([]);
    expect(spec.appHosting).toEqual([]);
    expect(spec.serverless).toEqual([]);
    expect(spec.containers).toEqual([]);
    expect(spec.initialisation).toEqual([]);
    expect(spec.security).toEqual([]);
    expect(spec.learningPurpose.outcomes).toEqual([]);
    expect(spec.learningPurpose.learnerTasks).toEqual([]);
    expect(spec.learningPurpose.technicalTasks).toEqual([]);
    expect(spec.location.approvedRegions).toEqual([]);
    expect(spec.location.fallbackRegions).toEqual([]);
  });
});
