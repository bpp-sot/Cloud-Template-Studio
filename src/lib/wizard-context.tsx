// Wizard context — Development Brief §7.3.
//
// Holds the in-progress LabSpecification as the author moves through the guided
// wizard. Mirrors the SoT Policy Studio pattern: React context for wizard state
// with localStorage persistence handled at the project level by the caller.

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CloudProvider, LabSpecification, WizardState } from '@/types';
import { createEmptyWizardState, generateId } from '@/lib/model/factory';

interface WizardContextValue {
  wizard: WizardState;
  setWizard: (updater: (prev: WizardState) => WizardState) => void;
  projectId: string;
  setProjectId: (id: string) => void;
  /** Patch the embedded LabSpecification immutably. */
  patchSpec: (patch: (spec: LabSpecification) => LabSpecification) => void;
  /** Replace the provider and reset provider-specific config to a safe empty state. */
  changeProvider: (provider: CloudProvider) => void;
  reset: (provider?: CloudProvider) => void;
}

const WizardContext = createContext<WizardContextValue | undefined>(undefined);

export function WizardProvider({
  children,
  initial,
  projectId: initialId,
}: {
  children: ReactNode;
  initial?: WizardState;
  projectId?: string;
}) {
  const [wizard, setWizardState] = useState<WizardState>(() =>
    initial ? initial : createEmptyWizardState('azure'),
  );
  const [projectId, setProjectId] = useState<string>(initialId ?? generateId());

  const setWizard = (updater: (prev: WizardState) => WizardState) => {
    setWizardState((prev) => updater(prev));
  };

  const patchSpec = (patch: (spec: LabSpecification) => LabSpecification) => {
    setWizardState((prev) => ({ ...prev, spec: patch(prev.spec) }));
  };

  const changeProvider = (provider: CloudProvider) => {
    setWizardState((prev) => {
      if (prev.spec.provider === provider) return prev;
      // Provider config must stay aligned with the chosen provider (Brief §3.5).
      const fresh = createEmptyWizardState(provider);
      return {
        ...prev,
        spec: {
          ...fresh.spec,
          // Preserve author-entered metadata and learning purpose across a switch.
          metadata: prev.spec.metadata,
          learningPurpose: prev.spec.learningPurpose,
          deployment: prev.spec.deployment,
          governance: prev.spec.governance,
        },
      };
    });
  };

  const reset = (provider: CloudProvider = 'azure') => {
    setWizardState(createEmptyWizardState(provider));
    setProjectId(generateId());
  };

  return (
    <WizardContext.Provider
      value={{ wizard, setWizard, projectId, setProjectId, patchSpec, changeProvider, reset }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within WizardProvider');
  return ctx;
}
