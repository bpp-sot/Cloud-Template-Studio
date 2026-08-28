# SoT Cloud Template Studio

**Design secure cloud lab infrastructure without writing templates from scratch.**

A production-quality, fully static web application that helps Skillable lab authors and technical
curriculum developers describe the infrastructure a learning environment needs and generate
provider-appropriate Infrastructure-as-Code — entirely in the browser, with no cloud credentials.

It is the sister product to [SoT Policy Studio](https://github.com/bpp-sot/Access-Control-Policy-Builder):

| Product                   | Primary purpose                                                 |
| ------------------------- | --------------------------------------------------------------- |
| SoT Policy Studio         | Defines what the learner is permitted to create or manage       |
| SoT Cloud Template Studio | Defines the infrastructure that should be deployed into the lab |

## Provider outputs

- **Microsoft Azure** — Bicep, ARM JSON, parameters, infrastructure summary, security & cost review, Skillable deployment guidance
- **Amazon Web Services** — CloudFormation (YAML by default, JSON where appropriate), parameters, infrastructure summary, security & cost review, Skillable deployment guidance

Terraform and AWS CDK are out of scope for version 1. The architecture allows additional provider
engines to be added later. Azure and AWS are **never** treated as one-to-one interchangeable.

## Product boundary

SoT Cloud Template Studio is a **template generator and review tool**. It does not connect to Azure
or AWS, deploy infrastructure, or validate quota / SKU / region capacity.

> Generated templates must be tested by the lab author in an appropriate non-production cloud
> environment before being submitted for Skillable use.

## Evidence before generation

Every generated resource, dependency and recommendation is traceable to an authoritative source,
a predefined application pattern, or explicit user input, and carries an evidence classification:

| Class | Meaning                              |
| ----- | ------------------------------------ |
| A     | Official Skillable example           |
| B     | Official Skillable documentation     |
| C     | Native Microsoft Azure documentation |
| D     | Native AWS documentation             |
| E     | Application safety constraint        |
| F     | User-supplied custom configuration   |
| G     | Unverified / requires manual review  |

## Technology

React 18 · TypeScript · Vite 5 · React Router (HashRouter) · Vitest · Playwright · ESLint · Prettier
· GitHub Actions · GitHub Pages. No server, no database, no authentication, no cloud credentials, no
telemetry. Projects are stored in browser `localStorage` with JSON import/export.

## Getting started

> On Windows with a restricted PowerShell execution policy, prefix npm commands with `cmd /c`.

```bash
npm install
npm run dev            # start the dev server (http://localhost:5173)
npm run build          # type-check + production build
npm run preview        # preview the production build
npm run test           # unit tests (Vitest)
npm run test:e2e       # end-to-end tests (Playwright)
npm run lint           # ESLint (zero warnings)
npm run format:check   # Prettier check
```

## Architecture

A provider-neutral `LabSpecification` captures the educational requirements. A normaliser turns it,
together with the resource/dependency catalogues, into a provider-specific `InternalModel`. The
Azure and AWS generator engines — and every review artifact and the learner instructions — read only
from the `InternalModel`, so generated templates and instructions cannot drift apart.

```
Learning requirements → LabSpecification → InternalModel → Bicep / ARM / CloudFormation
                                                        → security / cost / deployment review
                                                        → learner instructions
```

Key directories:

- `src/types/` — shared domain model (evidence, lab specification, catalogue, internal model)
- `src/data/` — normalised, evidence-backed catalogues (JSON)
- `src/data-schemas/` — JSON Schemas validated at test time
- `src/lib/` — model factory, dependency engine, normaliser, storage, secret detection, theme
- `src/components/`, `src/pages/` — UI
- `e2e/` — Playwright end-to-end tests

## Delivery phases

1. **Architecture & evidence** — shared model, catalogues, dependency engine, test harness _(current)_
2. **Azure MVP** — single VM: Bicep + ARM + review
3. **AWS MVP** — single EC2: CloudFormation + review
4. **Reviews & instructions** — security, cost, deployment checklist, learner Markdown
5. **Advanced resources** — storage, app hosting, serverless, containers, multi-machine, identities
6. **Professional Mode & integration** — custom fragments, shared Lab Specification exchange

## Licence

See [LICENSE](./LICENSE). Built for BPP School of Technology. Authored by Idris Fabiyi.
