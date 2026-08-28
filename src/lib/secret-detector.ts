// Detects potential secrets/credentials in free-text fields and user-supplied
// scripts (cloud-init, user-data, PowerShell/shell). Returns a list of
// warnings for detected patterns.
//
// This extends the SoT Policy Studio secret-detection patterns (Development
// Brief §5: "Reuse and extend the existing SoT Policy Studio secret-detection
// patterns"). The application NEVER stores credentials, keys, or secrets.

const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Carried forward from SoT Policy Studio
  { pattern: /AKIA[0-9A-Z]{16}/g, label: 'AWS Access Key ID' },
  { pattern: /aws_secret_access_key/gi, label: 'AWS secret access key reference' },
  {
    pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP |)PRIVATE KEY-----/g,
    label: 'Private key block',
  },
  { pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, label: 'JWT token' },
  { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, label: 'Password assignment' },
  { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/gi, label: 'Secret assignment' },
  { pattern: /token\s*[:=]\s*['"][^'"]{8,}['"]/gi, label: 'Token assignment' },
  { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, label: 'API key assignment' },
  { pattern: /connection\s*string\s*[:=]\s*['"][^'"]+['"]/gi, label: 'Connection string' },
  {
    pattern: /DefaultEndpointsProtocol=https?;AccountName=/gi,
    label: 'Azure Storage connection string',
  },
  { pattern: /ClientSecret\s*[:=]\s*['"][^'"]+['"]/gi, label: 'Client secret' },
  { pattern: /SAS\s*token/gi, label: 'SAS token reference' },

  // Extended for Cloud Template Studio (IaC / initialisation scripts)
  { pattern: /AccountKey=[A-Za-z0-9+/=]{40,}/g, label: 'Azure Storage account key' },
  { pattern: /[?&]sig=[A-Za-z0-9%+/=]{20,}/g, label: 'Azure SAS token signature' },
  { pattern: /ASIA[0-9A-Z]{16}/g, label: 'AWS temporary Access Key ID' },
  { pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g, label: 'GitHub token' },
  { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g, label: 'Slack token' },
  { pattern: /adminPassword\s*[:=]/gi, label: 'Admin password field' },
  { pattern: /temporary\s*access\s*pass/gi, label: 'Temporary Access Pass reference' },
  { pattern: /ssh-rsa\s+AAAA[0-9A-Za-z+/]{50,}/g, label: 'SSH private/authorised key material' },
];

export interface SecretDetectionResult {
  detected: boolean;
  warnings: string[];
}

export function detectSecrets(text: string): SecretDetectionResult {
  if (!text || text.trim().length === 0) {
    return { detected: false, warnings: [] };
  }

  const warnings: string[] = [];
  for (const { pattern, label } of SECRET_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      warnings.push(
        `Potential ${label} detected (${matches.length} occurrence${matches.length > 1 ? 's' : ''}). Do not enter credentials or secrets into this field.`,
      );
    }
  }

  return { detected: warnings.length > 0, warnings };
}
