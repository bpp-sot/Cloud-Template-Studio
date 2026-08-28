// Persisted project + wizard state — Development Brief §7.3.

import type { CloudProvider } from './evidence';
import type { LabSpecification } from './lab-specification';
import type { InternalModel } from './internal-model';

/**
 * Generated output artifacts for a provider. Populated by the generation
 * engines in later phases; optional so a project can be saved pre-generation.
 */
export interface GeneratedArtifacts {
  provider: CloudProvider;
  generatedAt: string;
  /** Azure. */
  bicep?: string;
  armJson?: string;
  /** AWS. */
  cloudFormationYaml?: string;
  cloudFormationJson?: string;
  /** Shared. */
  parametersJson?: string;
  /** The internal model the artifacts were rendered from (for the review UI). */
  internalModel?: InternalModel;
}

/** The wizard's working state. The LabSpecification is built up as steps complete. */
export interface WizardState {
  currentStep: number;
  spec: LabSpecification;
}

export interface TemplateProject {
  id: string;
  createdAt: string;
  updatedAt: string;
  wizard: WizardState;
  artifacts?: GeneratedArtifacts;
}

export interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
