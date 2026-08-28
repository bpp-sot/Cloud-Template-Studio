// New Template wizard — Development Brief §7.
//
// Hosts the guided wizard inside a WizardProvider. On Generate, builds the
// provider InternalModel, renders artifacts, persists the project, and
// navigates to the review page.

import { useNavigate, useParams } from 'react-router-dom';
import { WizardProvider, useWizard } from '@/lib/wizard-context';
import { saveProject, loadProject } from '@/lib/storage';
import { generateArtifacts } from '@/lib/generate';
import type { TemplateProject } from '@/types';
import { WIZARD_STEPS, canProceed } from '@/components/WizardSteps';

function WizardContent({ existing }: { existing: TemplateProject | null }) {
  const { wizard, setWizard, projectId, reset } = useWizard();
  const navigate = useNavigate();

  const currentStep = wizard.currentStep;
  const StepComponent = WIZARD_STEPS[currentStep].component;

  const next = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setWizard((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  const prev = () => {
    if (currentStep > 0) {
      setWizard((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const handleSaveDraft = () => {
    const project: TemplateProject = existing
      ? { ...existing, updatedAt: new Date().toISOString(), wizard }
      : {
          id: projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          wizard,
        };
    saveProject(project);
    navigate('/projects');
  };

  const handleGenerate = () => {
    try {
      const artifacts = generateArtifacts(wizard.spec);
      const now = new Date().toISOString();
      const project: TemplateProject = existing
        ? { ...existing, updatedAt: now, wizard, artifacts }
        : { id: projectId, createdAt: now, updatedAt: now, wizard, artifacts };
      saveProject(project);
      navigate(`/review/${projectId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to generate templates.');
    }
  };

  return (
    <div className="wizard-container">
      <div className="flex items-center justify-between">
        <h2 className="section-title">
          {existing ? 'Edit Template Project' : 'New Template Project'}
        </h2>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (confirm('Reset the wizard? All current data will be lost.')) {
              reset(wizard.spec.provider);
            }
          }}
        >
          Reset
        </button>
      </div>

      <div className="wizard-progress">
        {WIZARD_STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center">
            <div
              className={`wizard-step ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
            >
              <div className="wizard-step-circle">{idx < currentStep ? '\u2713' : idx + 1}</div>
              <div className="wizard-step-label">{step.label}</div>
            </div>
            {idx < WIZARD_STEPS.length - 1 && <div className="wizard-step-connector" />}
          </div>
        ))}
      </div>

      <StepComponent />

      <div className="wizard-actions">
        <button className="btn btn-secondary" onClick={prev} disabled={currentStep === 0}>
          {'\u2190'} Previous
        </button>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleSaveDraft}>
            Save Draft
          </button>
          {currentStep < WIZARD_STEPS.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={next}
              disabled={!canProceed(currentStep, wizard.spec)}
            >
              Next {'\u2192'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleGenerate}>
              Generate Templates {'\u{1F680}'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewTemplate() {
  const { projectId } = useParams();
  const existing = projectId ? loadProject(projectId) : null;

  if (existing) {
    return (
      <WizardProvider initial={existing.wizard} projectId={existing.id}>
        <WizardContent existing={existing} />
      </WizardProvider>
    );
  }

  return (
    <WizardProvider>
      <WizardContent existing={null} />
    </WizardProvider>
  );
}
