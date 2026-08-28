/**
 * Central branding and version information for the application.
 *
 * Update the version here when releasing a new build. The value is surfaced
 * in the footer, the About page, and is intended to give lab authors a
 * quick visual way to confirm which version of the tool they are running.
 *
 * Versioning convention (semantic versioning):
 *   MAJOR.MINOR.PATCH
 *   - MAJOR: breaking changes
 *   - MINOR: new features (e.g. new provider engine, new resource catalogue)
 *   - PATCH: bug fixes and minor tweaks
 */

export const APP_INFO = {
  /** Product name shown in header, footer, hero, and About page. */
  name: 'SoT Cloud Template Studio',
  /** Short monogram rendered inside the header logo badge. */
  monogram: 'SoT',
  /** Tagline shown under the product name. */
  tagline: 'Design secure cloud lab infrastructure without writing templates from scratch',
  /** Author / maintainer credited in the footer and About page. */
  author: 'Idris Fabiyi',
  /** Organisation the product is built for. */
  organisation: 'BPP School of Technology',
  /** Application version. Bump this when releasing a new build. */
  version: '0.1.0',
  /** Short human-readable build label, included next to the version. */
  buildLabel: 'Phase 1 — Architecture & Evidence',
} as const;

/** Convenience accessor for the version string, e.g. "v0.1.0". */
export const APP_VERSION = `v${APP_INFO.version}`;

/** Full credit line for footers, e.g. "SoT Cloud Template Studio v0.1.0". */
export const APP_CREDIT = `${APP_INFO.name} ${APP_VERSION}`;

/**
 * Standing product boundary statement (Development Brief §6). This exact
 * wording must be surfaced in the UI wherever generated templates are shown.
 */
export const BOUNDARY_STATEMENT =
  'Generated templates must be tested by the lab author in an appropriate non-production cloud environment before being submitted for Skillable use.';
