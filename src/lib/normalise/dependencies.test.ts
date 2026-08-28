import { describe, it, expect } from 'vitest';
import {
  resolveDependencies,
  optionalDependencies,
  requiredDependencies,
  assertProviderMatch,
  evidenceRefFromId,
} from './dependencies';
import { findResource } from '@/lib/data';

const azureVm = findResource('azure', 'azure-vm')!;
const awsEc2 = findResource('aws', 'aws-ec2-instance')!;

describe('dependency resolution', () => {
  it('always includes required and auto-included dependencies', () => {
    const resolved = resolveDependencies(azureVm, new Set());
    const nic = resolved.find((r) => r.dependency.identifier === 'azure-nic');
    expect(nic?.included).toBe(true);
  });

  it('keeps optional dependencies opt-in', () => {
    const withoutOptIn = resolveDependencies(azureVm, new Set());
    const pipOut = withoutOptIn.find((r) => r.dependency.identifier === 'azure-public-ip');
    expect(pipOut?.included).toBe(false);

    const withOptIn = resolveDependencies(azureVm, new Set(['azure-public-ip']));
    const pipIn = withOptIn.find((r) => r.dependency.identifier === 'azure-public-ip');
    expect(pipIn?.included).toBe(true);
    expect(pipIn?.includedByUser).toBe(true);
  });

  it('lists optional vs required dependencies', () => {
    expect(optionalDependencies(azureVm).map((d) => d.identifier)).toContain('azure-public-ip');
    expect(requiredDependencies(azureVm).map((d) => d.identifier)).toContain('azure-nic');
    expect(optionalDependencies(awsEc2).map((d) => d.identifier)).toContain('aws-internet-gateway');
  });

  it('rejects resolving a resource against the wrong provider', () => {
    expect(() => assertProviderMatch(azureVm, 'aws')).toThrow(/Provider mismatch/);
    expect(() => assertProviderMatch(awsEc2, 'azure')).toThrow(/Provider mismatch/);
  });
});

describe('evidence reference resolution', () => {
  it('resolves a known evidence id', () => {
    const ref = evidenceRefFromId('az-vm-doc');
    expect(ref.classification).toBe('C');
    expect(ref.confidence).toBe('high');
  });

  it('falls back to Classification G for an unknown id', () => {
    const ref = evidenceRefFromId('does-not-exist');
    expect(ref.classification).toBe('G');
    expect(ref.confidence).toBe('low');
  });
});
