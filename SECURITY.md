# Security Policy

## Design principles

SoT Cloud Template Studio is a static, browser-only application. It is built so that a security
incident involving credentials is structurally very unlikely:

- **No cloud credentials.** The application never asks for or stores Azure credentials, AWS access
  keys or secret keys, subscription secrets, client secrets, private keys, temporary access passes,
  connection strings, SAS tokens or passwords.
- **No server, no database, no authentication, no telemetry.** All processing happens locally in the
  browser. Projects are stored in `localStorage` and can be exported/imported as JSON by the user.
- **No runtime deployment.** The application does not connect to any cloud provider or deploy
  infrastructure.

## Secret detection

Free-text fields and user-supplied initialisation scripts (cloud-init, user-data, PowerShell,
shell) are scanned by `src/lib/secret-detector.ts` for credential-like patterns (access keys,
private keys, JWTs, connection strings, SAS signatures, password/secret/token assignments, and
more). Detected content is flagged and must be removed. Sensitive template inputs are always
represented as **secure parameters** and are never embedded as literals in generated templates.

## Generated templates

Generated templates are **not** guaranteed to be secure, cost-approved, validated by Skillable, or
suitable for production. They must be tested by the lab author in an appropriate non-production
cloud environment before being submitted for Skillable use. The built-in security review flags
risks (public exposure, unrestricted CIDRs, management ports, weak authentication, missing
encryption, public storage, embedded credentials, oversized compute, missing dependencies) but does
not claim the template is penetration-tested or confirmed secure.

## Reporting a vulnerability

If you discover a security issue, please open a private report to the maintainers rather than a
public issue. Include steps to reproduce and the affected version (see the About page).
