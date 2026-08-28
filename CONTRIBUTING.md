# Contributing to SoT Cloud Template Studio

Thank you for helping improve the studio. This project follows an evidence-led methodology; please
keep the non-negotiable principles in mind (see `AGENTS.md`).

## Development setup

```bash
npm install
npm run dev
```

> On Windows with a restricted PowerShell execution policy, prefix npm commands with `cmd /c`.

## Quality gates

Every change must pass all of the following before it is merged:

```bash
npm run typecheck
npm run lint          # zero warnings
npm run format:check
npm run test
npm run build
npm run test:e2e
```

## Working with evidence and catalogues

- Do **not** invent resource properties, API versions, dependencies, region/SKU availability,
  pricing or Skillable behaviour. Add a real source to `src/data/evidence-index.json` and reference
  it from the catalogue entry.
- New catalogue entries must include a provider, resource type, dependencies, risk profile, cost
  sensitivity, evidence, limitations, documentation URL, schema/API version and review date.
- If authoritative evidence is not available, classify the behaviour as **G (unverified)** and
  require manual review. Never present unverified behaviour as a provider or Skillable requirement.
- Catalogue data is validated against JSON Schemas in `src/data-schemas/` and by referential
  integrity tests in `src/lib/data.test.ts`. Add or update these when you change the data shape.

## Provider separation

Azure and AWS must remain independent. Do not add cross-provider conversion. Provider-specific
configuration belongs in the `providerConfig` discriminated union in `LabSpecification`, never in
the shared educational fields.

## Security

Never commit credentials, keys or secrets. The secret detector in `src/lib/secret-detector.ts`
guards free-text and script inputs; extend it (with tests) rather than weakening it. See
`SECURITY.md`.

## Commit style

Write clear, imperative commit messages that explain the "why". Keep unrelated changes in separate
commits.
