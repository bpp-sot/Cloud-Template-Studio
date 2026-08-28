# SoT Cloud Template Studio — Project Guide

## Build & Verification Commands

```bash
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint (zero warnings)
npm run format:check  # Prettier format check
npm run test          # Unit tests (Vitest)
npm run build         # Production build (tsc -b + vite build)
npm run test:e2e      # End-to-end tests (Playwright)
```

All of the above must pass before a change is considered complete (quality gates).

## Windows / PowerShell Note

On Windows with a restricted PowerShell execution policy, `npm` may be blocked. Use
`cmd /c npm <command>` instead of `npm <command>` directly.

## Architecture

- **Static SPA**: React + TypeScript + Vite, deployed to GitHub Pages.
- **Routing**: HashRouter (avoids 404 on GitHub Pages refresh).
- **State**: `localStorage` for project persistence; JSON import/export for portability.
- **No backend**: all generation happens locally in the browser. No cloud credentials, no secrets,
  no telemetry.

### Data flow

`LabSpecification` (provider-neutral) → `normaliser` (+ catalogues + dependency engine) →
`InternalModel` (per provider) → generator engines + review artifacts + learner instructions.

Generators and reviews read **only** the `InternalModel`. Never generate from the wizard state
directly. This keeps templates and instructions from drifting apart.

## Key Directories

- `src/types/` — domain model: `evidence.ts`, `lab-specification.ts`, `catalogue.ts`,
  `internal-model.ts`, `project.ts` (barrel: `index.ts`).
- `src/data/` — normalised evidence catalogues (JSON): resource catalogues, patterns, regions,
  compute sizes, security/cost/naming rules, evidence index, source manifest, images.
- `src/data-schemas/` — JSON Schemas validated in unit tests.
- `src/lib/` — `data.ts` (typed catalogue access), `model/factory.ts`, `normalise/` (dependency
  engine + normaliser + azure-model + aws-model), `generators/azure/` (bicep, arm, parameters),
  `generators/aws/` (cloudformation-yaml, cloudformation-json, parameters), `instructions.ts`
  (learner Markdown), `checklist.ts` (validation checklist), `storage.ts`, `secret-detector.ts`,
  `theme.tsx`, `download.ts`, `app-info.ts`.
- `src/components/`, `src/pages/` — UI.
- `e2e/` — Playwright specs.

## Generator Independence

Azure Bicep and ARM are generated independently from the same `InternalModel` — ARM is NOT
compiled from Bicep. Likewise, AWS CloudFormation YAML and JSON are generated independently
from the same `InternalModel` — JSON is NOT converted from YAML. Equivalence is asserted by
fixture-based snapshot tests.

## Non-negotiable Principles

- Evidence before generation; no silent provider inference.
- No cloud credentials, no secret storage, no automatic deployment.
- Required dependencies clearly identified; optional dependencies stay opt-in.
- Public exposure (public IPs, internet gateways, `0.0.0.0/0`) is never silently enabled.
- Provider-native outputs remain separate; Azure and AWS fields never leak across providers
  (enforced by the `providerConfig` discriminated union and covered by tests).
- Custom (Professional Mode) additions are Classification F; unverified behaviour is Classification G.

## Evidence Model (A–G)

A: Official Skillable example · B: Official Skillable documentation · C: Native Azure documentation ·
D: Native AWS documentation · E: Application safety constraint · F: User-supplied custom
configuration · G: Unverified / requires manual review.

## GitHub Pages Base Path

Configured via `VITE_BASE_PATH`. Default `/` (local dev); production `/Cloud-Template-Studio/`
(set in `.github/workflows/deploy.yml` and `ci.yml`).

## Branding / Versioning

Central branding and version live in `src/lib/app-info.ts`. Bump `version` on release.
