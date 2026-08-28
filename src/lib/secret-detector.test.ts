import { describe, it, expect } from 'vitest';
import { detectSecrets } from './secret-detector';

describe('secret detector', () => {
  it('returns no warnings for clean text', () => {
    const result = detectSecrets('A Linux VM lab for teaching networking basics.');
    expect(result.detected).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns no warnings for empty input', () => {
    expect(detectSecrets('').detected).toBe(false);
    expect(detectSecrets('   ').detected).toBe(false);
  });

  it('detects an AWS access key id', () => {
    const result = detectSecrets('key is AKIAIOSFODNN7EXAMPLE here');
    expect(result.detected).toBe(true);
    expect(result.warnings.join(' ')).toContain('AWS Access Key ID');
  });

  it('detects an AWS temporary access key id', () => {
    const result = detectSecrets('ASIAIOSFODNN7EXAMPLE');
    expect(result.detected).toBe(true);
    expect(result.warnings.join(' ')).toContain('temporary Access Key ID');
  });

  it('detects a private key block', () => {
    const result = detectSecrets(
      '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----',
    );
    expect(result.detected).toBe(true);
    expect(result.warnings.join(' ')).toContain('Private key block');
  });

  it('detects a password assignment', () => {
    const result = detectSecrets('adminPassword: "P@ssw0rd123"');
    expect(result.detected).toBe(true);
  });

  it('detects an Azure Storage connection string', () => {
    const result = detectSecrets(
      'DefaultEndpointsProtocol=https;AccountName=labstore;AccountKey=abc',
    );
    expect(result.detected).toBe(true);
  });
});
