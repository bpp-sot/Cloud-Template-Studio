// Guided wizard steps — Development Brief §2, §7.
//
// Each step edits the shared LabSpecification through the wizard context. Steps
// are deliberately provider-aware: Azure-specific fields (image reference,
// diagnostics) only appear when Azure is selected, and AWS fields appear only
// for AWS. Provider resources never leak across the boundary (Brief §3.5).
//
// Every free-text field is secret-scanned. Nothing is silently enabled.

import { useState } from 'react';
import { useWizard } from '@/lib/wizard-context';
import { detectSecrets } from '@/lib/secret-detector';
import { getRegions, getComputeSizes, getAzureImages, getAwsImages } from '@/lib/data';
import { generateId } from '@/lib/model/factory';
import type {
  AppHostingRequirement,
  ArchitecturePatternId,
  ComputeRequirement,
  ContainerRequirement,
  IdentityRequirement,
  InboundRule,
  LabSpecification,
  OperatingSystemFamily,
  ServerlessRequirement,
  StorageRequirement,
  VmAuthMethod,
} from '@/types';

// ─── Step 1: Project metadata ─────────────────────────────────────────────

export function Step1Project() {
  const { wizard, patchSpec } = useWizard();
  const m = wizard.spec.metadata;

  const update = (field: keyof typeof m, value: string) => {
    const detection = detectSecrets(value);
    if (detection.detected) {
      alert(detection.warnings.join('\n'));
      return;
    }
    patchSpec((spec) => ({ ...spec, metadata: { ...spec.metadata, [field]: value } }));
  };

  return (
    <div className="card">
      <div className="card-header">Template Project Details</div>
      <p className="text-sm text-muted mb-4">
        Enter the metadata for your lab template project. This information is included in the
        generated review summary and helps identify the template.
      </p>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label">
            Project Name <span className="required">*</span>
          </label>
          <input
            className="form-input"
            value={m.projectName}
            onChange={(e) => update('projectName', e.target.value)}
            placeholder="e.g. Azure Linux VM Lab"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Lab Profile Name</label>
          <input
            className="form-input"
            value={m.labProfileName}
            onChange={(e) => update('labProfileName', e.target.value)}
            placeholder="e.g. Deploying Virtual Machines in Azure"
          />
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label">Lab Profile Number</label>
          <input
            className="form-input"
            value={m.labProfileNumber}
            onChange={(e) => update('labProfileNumber', e.target.value)}
            placeholder="e.g. CLD-AZR-SBX-001"
          />
          <div className="form-hint">Example format: CLD-AZR-SBX-001 or CLD-AWS-SBX-001</div>
        </div>
        <div className="form-group">
          <label className="form-label">Author</label>
          <input
            className="form-input"
            value={m.author}
            onChange={(e) => update('author', e.target.value)}
            placeholder="Your name"
          />
        </div>
      </div>

      <div className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Version</label>
          <input
            className="form-input"
            value={m.version}
            onChange={(e) => update('version', e.target.value)}
            placeholder="1.0.0"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Programme</label>
          <input
            className="form-input"
            value={m.programme}
            onChange={(e) => update('programme', e.target.value)}
            placeholder="e.g. Cloud Administration"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Module</label>
          <input
            className="form-input"
            value={m.module}
            onChange={(e) => update('module', e.target.value)}
            placeholder="e.g. Module 3"
          />
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label">Intended Audience</label>
          <input
            className="form-input"
            value={m.intendedAudience}
            onChange={(e) => update('intendedAudience', e.target.value)}
            placeholder="e.g. Beginner IT students"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Lab Duration (minutes)</label>
          <input
            className="form-input"
            type="number"
            value={m.labDuration}
            onChange={(e) => update('labDuration', e.target.value)}
            placeholder="60"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-textarea"
          value={m.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Brief description of the lab and its purpose..."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Status</label>
        <select
          className="form-select"
          value={m.status}
          onChange={(e) => update('status', e.target.value as 'development' | 'production')}
        >
          <option value="development">Development</option>
          <option value="production">Production</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Lab Purpose</label>
        <textarea
          className="form-textarea"
          value={m.purpose}
          onChange={(e) => update('purpose', e.target.value)}
          placeholder="Free-text statement of the lab's educational purpose..."
        />
      </div>
    </div>
  );
}

// ─── Step 2: Cloud provider ───────────────────────────────────────────────

export function Step2Provider() {
  const { wizard, changeProvider } = useWizard();
  const provider = wizard.spec.provider;

  return (
    <div className="card">
      <div className="card-header">Select Cloud Provider</div>
      <p className="text-sm text-muted mb-4">
        Azure and AWS use different native Infrastructure-as-Code models. The two outputs are
        structurally different and cannot be directly converted.
      </p>

      <div className="alert alert-info">
        <span>{'\u{2139}'}</span>
        <div>
          <strong>Azure</strong> generates <strong>Bicep</strong> and independent{' '}
          <strong>ARM JSON</strong> plus a parameters file. Deployment container: Resource Group.
          <br />
          <strong>AWS</strong> generates <strong>CloudFormation</strong> (YAML by default, JSON
          where appropriate) plus parameters. Deployment container: CloudFormation Stack.
        </div>
      </div>

      <div className="form-grid-2 mt-4">
        <label
          className={`checkbox-item ${provider === 'azure' ? 'checked' : ''}`}
          style={{ minHeight: '100px', alignItems: 'center' }}
        >
          <input
            type="radio"
            name="provider"
            checked={provider === 'azure'}
            onChange={() => changeProvider('azure')}
          />
          <div className="checkbox-item-content">
            <div className="checkbox-item-title" style={{ fontSize: '1rem' }}>
              Microsoft Azure
            </div>
            <div className="checkbox-item-desc">
              Bicep + ARM JSON. Resource Group deployment. Managed disks for VM OS disks.
            </div>
          </div>
        </label>

        <label
          className={`checkbox-item ${provider === 'aws' ? 'checked' : ''}`}
          style={{ minHeight: '100px', alignItems: 'center' }}
        >
          <input
            type="radio"
            name="provider"
            checked={provider === 'aws'}
            onChange={() => changeProvider('aws')}
          />
          <div className="checkbox-item-content">
            <div className="checkbox-item-title" style={{ fontSize: '1rem' }}>
              Amazon Web Services
            </div>
            <div className="checkbox-item-desc">
              CloudFormation YAML/JSON. Stack deployment. EBS volumes for EC2 root disks.
            </div>
          </div>
        </label>
      </div>

      <div className="alert alert-warning mt-4">
        <span>{'\u{26A0}'}</span>
        <div>
          One-to-one conversion between Azure and AWS templates is <strong>not supported</strong>.
          Each provider uses its native resource model. Switching provider resets provider-specific
          configuration but preserves project metadata.
        </div>
      </div>

      {provider === 'aws' && (
        <div className="alert alert-info mt-4">
          <span>{'\u{2139}'}</span>
          <div>
            AWS generates CloudFormation YAML and JSON plus a parameters file. AMI references use
            SSM public parameter aliases by default, which are region-independent.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Learning purpose ─────────────────────────────────────────────

export function Step3Purpose() {
  const { wizard, patchSpec } = useWizard();
  const p = wizard.spec.learningPurpose;
  const [newOutcome, setNewOutcome] = useState('');
  const [newLearnerTask, setNewLearnerTask] = useState('');
  const [newTechTask, setNewTechTask] = useState('');

  const addOutcome = () => {
    if (!newOutcome.trim()) return;
    patchSpec((spec) => ({
      ...spec,
      learningPurpose: {
        ...spec.learningPurpose,
        outcomes: [
          ...spec.learningPurpose.outcomes,
          { id: `o-${generateId()}`, outcome: newOutcome.trim() },
        ],
      },
    }));
    setNewOutcome('');
  };

  const addLearnerTask = () => {
    if (!newLearnerTask.trim()) return;
    patchSpec((spec) => ({
      ...spec,
      learningPurpose: {
        ...spec.learningPurpose,
        learnerTasks: [
          ...spec.learningPurpose.learnerTasks,
          { id: `lt-${generateId()}`, task: newLearnerTask.trim() },
        ],
      },
    }));
    setNewLearnerTask('');
  };

  const addTechTask = () => {
    if (!newTechTask.trim()) return;
    patchSpec((spec) => ({
      ...spec,
      learningPurpose: {
        ...spec.learningPurpose,
        technicalTasks: [
          ...spec.learningPurpose.technicalTasks,
          { id: `tt-${generateId()}`, task: newTechTask.trim() },
        ],
      },
    }));
    setNewTechTask('');
  };

  const updateField = (field: keyof typeof p, value: string) => {
    const detection = detectSecrets(value);
    if (detection.detected) {
      alert(detection.warnings.join('\n'));
      return;
    }
    patchSpec((spec) => ({
      ...spec,
      learningPurpose: { ...spec.learningPurpose, [field]: value },
    }));
  };

  const removeOutcome = (id: string) =>
    patchSpec((spec) => ({
      ...spec,
      learningPurpose: {
        ...spec.learningPurpose,
        outcomes: spec.learningPurpose.outcomes.filter((o) => o.id !== id),
      },
    }));

  const removeLearnerTask = (id: string) =>
    patchSpec((spec) => ({
      ...spec,
      learningPurpose: {
        ...spec.learningPurpose,
        learnerTasks: spec.learningPurpose.learnerTasks.filter((t) => t.id !== id),
      },
    }));

  const removeTechTask = (id: string) =>
    patchSpec((spec) => ({
      ...spec,
      learningPurpose: {
        ...spec.learningPurpose,
        technicalTasks: spec.learningPurpose.technicalTasks.filter((t) => t.id !== id),
      },
    }));

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">Learning Outcomes</div>
        <p className="text-sm text-muted mb-4">
          Define what the learner should be able to do after completing the lab. Infrastructure
          requirements should trace back to at least one outcome.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            className="form-input"
            value={newOutcome}
            onChange={(e) => setNewOutcome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOutcome())}
            placeholder="e.g. Deploy a Linux virtual machine in Azure"
          />
          <button className="btn btn-primary" onClick={addOutcome}>
            Add
          </button>
        </div>
        {p.outcomes.length > 0 ? (
          <div className="checkbox-group">
            {p.outcomes.map((o) => (
              <div key={o.id} className="checkbox-item">
                <div className="checkbox-item-content">
                  <div className="checkbox-item-title">{o.outcome}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => removeOutcome(o.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No outcomes added yet.</p>
        )}
      </div>

      <div className="card mb-4">
        <div className="card-header">Learner Tasks</div>
        <p className="text-sm text-muted mb-4">
          Tasks the learner will perform during the lab. These inform which infrastructure
          components are required.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            className="form-input"
            value={newLearnerTask}
            onChange={(e) => setNewLearnerTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLearnerTask())}
            placeholder="e.g. Connect to the VM over SSH and install nginx"
          />
          <button className="btn btn-primary" onClick={addLearnerTask}>
            Add
          </button>
        </div>
        {p.learnerTasks.length > 0 ? (
          <div className="checkbox-group">
            {p.learnerTasks.map((t) => (
              <div key={t.id} className="checkbox-item">
                <div className="checkbox-item-content">
                  <div className="checkbox-item-title">{t.task}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => removeLearnerTask(t.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No learner tasks added yet.</p>
        )}
      </div>

      <div className="card mb-4">
        <div className="card-header">Technical / Infrastructure Tasks</div>
        <p className="text-sm text-muted mb-4">
          Infrastructure tasks that the template must satisfy (pre-deployed or learner-created).
        </p>
        <div className="flex gap-2 mb-4">
          <input
            className="form-input"
            value={newTechTask}
            onChange={(e) => setNewTechTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTechTask())}
            placeholder="e.g. Provision a Linux VM with SSH access"
          />
          <button className="btn btn-primary" onClick={addTechTask}>
            Add
          </button>
        </div>
        {p.technicalTasks.length > 0 ? (
          <div className="checkbox-group">
            {p.technicalTasks.map((t) => (
              <div key={t.id} className="checkbox-item">
                <div className="checkbox-item-content">
                  <div className="checkbox-item-title">{t.task}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => removeTechTask(t.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No technical tasks added yet.</p>
        )}
      </div>

      <div className="card">
        <div className="card-header">Environment Context</div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Required Software</label>
            <textarea
              className="form-textarea"
              value={p.requiredSoftware}
              onChange={(e) => updateField('requiredSoftware', e.target.value)}
              placeholder="Software the lab environment must provide..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Operating Systems</label>
            <textarea
              className="form-textarea"
              value={p.operatingSystems}
              onChange={(e) => updateField('operatingSystems', e.target.value)}
              placeholder="e.g. Ubuntu 22.04 LTS, Windows Server 2022"
            />
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Datasets</label>
            <textarea
              className="form-textarea"
              value={p.datasets}
              onChange={(e) => updateField('datasets', e.target.value)}
              placeholder="Datasets required by the lab, if any..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Expected Outputs</label>
            <textarea
              className="form-textarea"
              value={p.expectedOutputs}
              onChange={(e) => updateField('expectedOutputs', e.target.value)}
              placeholder="Artifacts or outputs the learner is expected to produce..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Deployment behaviour ─────────────────────────────────────────

export function Step4Deployment() {
  const { wizard, patchSpec } = useWizard();
  const d = wizard.spec.deployment;

  const update = <K extends keyof typeof d>(field: K, value: (typeof d)[K]) => {
    patchSpec((spec) => ({ ...spec, deployment: { ...spec.deployment, [field]: value } }));
  };

  return (
    <div className="card">
      <div className="card-header">Deployment Behaviour</div>
      <p className="text-sm text-muted mb-4">
        Configure how resources are deployed in the lab. This affects the Skillable deployment
        guidance produced in the review.
      </p>

      <div className="alert alert-info">
        <span>{'\u{2139}'}</span>
        <div>
          <strong>Pre-entry deployment</strong> (default): resources are deployed before the learner
          enters the lab.
          <br />
          <strong>Background deployment</strong>: resources deploy while the learner is in the lab.
          <br />
          <strong>Learner-created</strong>: the learner creates resources as part of the lab
          activities.
        </div>
      </div>

      <div className="form-group mt-4">
        <label className="form-label">Deployment Model</label>
        <select
          className="form-select"
          value={d.model}
          onChange={(e) => update('model', e.target.value as typeof d.model)}
        >
          <option value="pre-entry">Pre-entry (resources deployed before learner entry)</option>
          <option value="background">Background (deploys while learner is in the lab)</option>
          <option value="learner-created">Learner-created (learner creates resources)</option>
          <option value="mixed">Mixed (combination of the above)</option>
        </select>
      </div>

      <div className="form-grid-3 mt-4">
        <label className={`checkbox-item ${d.cleanup ? 'checked' : ''}`}>
          <input
            type="checkbox"
            checked={d.cleanup}
            onChange={(e) => update('cleanup', e.target.checked)}
          />
          <div className="checkbox-item-content">
            <div className="checkbox-item-title">Cleanup</div>
            <div className="checkbox-item-desc">Resources are removed after the lab</div>
          </div>
        </label>
        <label className={`checkbox-item ${d.validation ? 'checked' : ''}`}>
          <input
            type="checkbox"
            checked={d.validation}
            onChange={(e) => update('validation', e.target.checked)}
          />
          <div className="checkbox-item-content">
            <div className="checkbox-item-title">Validation</div>
            <div className="checkbox-item-desc">Lab includes validation scripts</div>
          </div>
        </label>
        <label className={`checkbox-item ${d.labSaveEnabled ? 'checked' : ''}`}>
          <input
            type="checkbox"
            checked={d.labSaveEnabled}
            onChange={(e) => update('labSaveEnabled', e.target.checked)}
          />
          <div className="checkbox-item-content">
            <div className="checkbox-item-title">Lab Save</div>
            <div className="checkbox-item-desc">Learner can save lab state</div>
          </div>
        </label>
      </div>

      <div className="form-grid-2 mt-4">
        <div className="form-group">
          <label className="form-label">Failure Behaviour</label>
          <select
            className="form-select"
            value={d.failureBehaviour}
            onChange={(e) =>
              update('failureBehaviour', e.target.value as typeof d.failureBehaviour)
            }
          >
            <option value="unspecified">Unspecified</option>
            <option value="fail-lab">Fail the lab</option>
            <option value="continue">Continue</option>
            <option value="retry">Retry</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Expected Duration (minutes)</label>
          <input
            className="form-input"
            type="number"
            value={d.expectedDurationMinutes}
            onChange={(e) => update('expectedDurationMinutes', e.target.value)}
            placeholder="60"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Region ───────────────────────────────────────────────────────

export function Step5Region() {
  const { wizard, patchSpec } = useWizard();
  const loc = wizard.spec.location;
  const regions = getRegions(wizard.spec.provider);

  const setPrimary = (value: string) => {
    patchSpec((spec) => ({
      ...spec,
      location: {
        ...spec.location,
        primaryRegion: value,
        approvedRegions: spec.location.approvedRegions.includes(value)
          ? spec.location.approvedRegions
          : [...spec.location.approvedRegions, value],
      },
    }));
  };

  return (
    <div className="card">
      <div className="card-header">Region and Location</div>
      <p className="text-sm text-muted mb-4">
        Choose the primary region for the lab infrastructure. Region availability is not validated
        against a live cloud account &mdash; confirm availability in your subscription before
        deployment.
      </p>

      <div className="form-group">
        <label className="form-label">Primary Region</label>
        <select
          className="form-select"
          value={loc.primaryRegion}
          onChange={(e) => setPrimary(e.target.value)}
        >
          <option value="">Select a region...</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.displayName} ({r.id})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Residency Notes</label>
        <textarea
          className="form-textarea"
          value={loc.residencyNotes}
          onChange={(e) => {
            const detection = detectSecrets(e.target.value);
            if (detection.detected) {
              alert(detection.warnings.join('\n'));
              return;
            }
            patchSpec((spec) => ({
              ...spec,
              location: { ...spec.location, residencyNotes: e.target.value },
            }));
          }}
          placeholder="Any data residency requirements or notes..."
        />
      </div>

      <div className="form-grid-2">
        <label className={`checkbox-item ${loc.globalResourcesRequired ? 'checked' : ''}`}>
          <input
            type="checkbox"
            checked={loc.globalResourcesRequired}
            onChange={(e) =>
              patchSpec((spec) => ({
                ...spec,
                location: { ...spec.location, globalResourcesRequired: e.target.checked },
              }))
            }
          />
          <div className="checkbox-item-content">
            <div className="checkbox-item-title">Global Resources Required</div>
            <div className="checkbox-item-desc">Lab needs global/regional resources</div>
          </div>
        </label>
        <label className={`checkbox-item ${loc.dataResidencyRequired ? 'checked' : ''}`}>
          <input
            type="checkbox"
            checked={loc.dataResidencyRequired}
            onChange={(e) =>
              patchSpec((spec) => ({
                ...spec,
                location: { ...spec.location, dataResidencyRequired: e.target.checked },
              }))
            }
          />
          <div className="checkbox-item-content">
            <div className="checkbox-item-title">Data Residency Required</div>
            <div className="checkbox-item-desc">Specific data residency constraints apply</div>
          </div>
        </label>
      </div>
    </div>
  );
}

// ─── Step 6: Architecture pattern ─────────────────────────────────────────

const PATTERNS: Array<{ id: ArchitecturePatternId; label: string; desc: string }> = [
  { id: 'single-vm', label: 'Single VM', desc: 'One virtual machine for the lab.' },
  { id: 'multiple-vms', label: 'Multiple VMs', desc: 'Several VMs in the same network.' },
  { id: 'client-server', label: 'Client / Server', desc: 'A client VM and a server VM.' },
  { id: 'multi-tier-web', label: 'Multi-tier Web', desc: 'Web, app and data tiers.' },
  {
    id: 'data-science-workstation',
    label: 'Data Science Workstation',
    desc: 'A single GPU-enabled workstation.',
  },
  { id: 'custom', label: 'Custom', desc: 'Define resources manually.' },
];

export function Step6Pattern() {
  const { wizard, patchSpec } = useWizard();
  const current = wizard.spec.architecturePattern;

  return (
    <div className="card">
      <div className="card-header">Architecture Pattern</div>
      <p className="text-sm text-muted mb-4">
        Patterns suggest resources but every suggestion must be reviewed. The application does not
        silently include resources based on a pattern alone.
      </p>

      <div className="form-grid-2">
        {PATTERNS.map((p) => (
          <label key={p.id} className={`checkbox-item ${current === p.id ? 'checked' : ''}`}>
            <input
              type="radio"
              name="pattern"
              checked={current === p.id}
              onChange={() => patchSpec((spec) => ({ ...spec, architecturePattern: p.id }))}
            />
            <div className="checkbox-item-content">
              <div className="checkbox-item-title">{p.label}</div>
              <div className="checkbox-item-desc">{p.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Step 7: Compute (VM/EC2) ─────────────────────────────────────────────

export function Step7Compute() {
  const { wizard, patchSpec } = useWizard();
  const provider = wizard.spec.provider;
  const sizes = getComputeSizes(provider);
  const compute = wizard.spec.compute;

  const ensureOne = (): ComputeRequirement[] => {
    if (compute.length > 0) return compute;
    const fresh: ComputeRequirement = {
      id: `vm-${generateId()}`,
      name: provider === 'azure' ? 'labvm' : 'lab-instance',
      osFamily: 'linux',
      sizeId: sizes[0]?.id ?? '',
      count: 1,
      authMethod: provider === 'azure' ? 'ssh-public-key' : 'ssh-public-key',
      publicIpRequested: false,
      dataDiskCount: 0,
      traceTo: [],
    };
    patchSpec((spec) => ({ ...spec, compute: [fresh] }));
    return [fresh];
  };

  const updateCompute = (patch: Partial<ComputeRequirement>) => {
    patchSpec((spec) => {
      const list = spec.compute.length ? spec.compute : ensureOne();
      const updated = list.map((c, i) => (i === 0 ? { ...c, ...patch } : c));
      return { ...spec, compute: updated };
    });
  };

  const current = compute[0];

  return (
    <div className="card">
      <div className="card-header">{provider === 'azure' ? 'Virtual Machine' : 'EC2 Instance'}</div>
      <p className="text-sm text-muted mb-4">
        Define the primary compute resource for the lab. Phase 2 supports a single VM; multiple VMs
        are planned for a later release.
      </p>

      {current ? (
        <>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                value={current.name}
                onChange={(e) => {
                  const detection = detectSecrets(e.target.value);
                  if (detection.detected) {
                    alert(detection.warnings.join('\n'));
                    return;
                  }
                  updateCompute({ name: e.target.value });
                }}
                placeholder={provider === 'azure' ? 'labvm' : 'lab-instance'}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Operating System Family</label>
              <select
                className="form-select"
                value={current.osFamily}
                onChange={(e) =>
                  updateCompute({ osFamily: e.target.value as OperatingSystemFamily })
                }
              >
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">
                {provider === 'azure' ? 'VM Size' : 'Instance Type'}
              </label>
              <select
                className="form-select"
                value={current.sizeId}
                onChange={(e) => updateCompute({ sizeId: e.target.value })}
              >
                {sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
              {sizes.find((s) => s.id === current.sizeId)?.costFlag && (
                <div className="form-hint" style={{ color: 'var(--accent-warning)' }}>
                  This size carries elevated cost risk. Review the cost findings before deploying.
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Authentication Method</label>
              <select
                className="form-select"
                value={current.authMethod}
                onChange={(e) => updateCompute({ authMethod: e.target.value as VmAuthMethod })}
              >
                <option value="ssh-public-key">SSH public key (Linux)</option>
                <option value="password-prompt">Password (supplied at deployment)</option>
                <option value="platform-managed">Platform-managed</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Instance Count</label>
              <input
                className="form-input"
                type="number"
                min={1}
                value={current.count}
                onChange={(e) => updateCompute({ count: Math.max(1, Number(e.target.value) || 1) })}
              />
              <div className="form-hint">Phase 2 generates a single VM regardless of count.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Data Disk Count</label>
              <input
                className="form-input"
                type="number"
                min={0}
                value={current.dataDiskCount}
                onChange={(e) =>
                  updateCompute({ dataDiskCount: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
          </div>

          <label className={`checkbox-item ${current.publicIpRequested ? 'checked' : ''} mt-2`}>
            <input
              type="checkbox"
              checked={current.publicIpRequested}
              onChange={(e) => updateCompute({ publicIpRequested: e.target.checked })}
            />
            <div className="checkbox-item-content">
              <div className="checkbox-item-title">Request Public IP</div>
              <div className="checkbox-item-desc">
                Opt-in only. A public IP exposes the VM to the internet and will trigger security
                and cost findings. Never enabled silently.
              </div>
            </div>
          </label>
        </>
      ) : (
        <button className="btn btn-primary" onClick={() => ensureOne()}>
          Add {provider === 'azure' ? 'Virtual Machine' : 'EC2 Instance'}
        </button>
      )}
    </div>
  );
}

// ─── Step 8: Networking ───────────────────────────────────────────────────

export function Step8Networking() {
  const { wizard, patchSpec } = useWizard();
  const net = wizard.spec.network[0];
  const [newPort, setNewPort] = useState('');
  const [newCidr, setNewCidr] = useState('');

  const ensureNet = () => {
    if (net) return net;
    const fresh = {
      id: `net-${generateId()}`,
      name: wizard.spec.provider === 'azure' ? 'lab-vnet' : 'lab-vpc',
      addressSpace: '10.0.0.0/16',
      subnetName: wizard.spec.provider === 'azure' ? 'lab-subnet' : 'lab-subnet',
      subnetPrefix: '10.0.0.0/24',
      inboundRules: [],
      traceTo: [],
    };
    patchSpec((spec) => ({ ...spec, network: [fresh] }));
    return fresh;
  };

  const updateNet = (patch: Partial<(typeof wizard.spec.network)[number]>) => {
    patchSpec((spec) => {
      const list = spec.network.length ? spec.network : [ensureNet()];
      return {
        ...spec,
        network: list.map((n, i) => (i === 0 ? { ...n, ...patch } : n)),
      };
    });
  };

  const addRule = () => {
    const port = Number(newPort);
    if (!port || port < 1 || port > 65535) {
      alert('Enter a valid port number between 1 and 65535.');
      return;
    }
    const cidr = newCidr.trim() || '0.0.0.0/0';
    const rule: InboundRule = {
      id: `rule-${generateId()}`,
      port,
      protocol: 'tcp',
      sourceCidr: cidr,
      description: `Allow TCP ${port} from ${cidr}`,
    };
    const current = wizard.spec.network[0];
    const base = current ?? ensureNet();
    updateNet({ inboundRules: [...base.inboundRules, rule] });
    setNewPort('');
    setNewCidr('');
  };

  const removeRule = (id: string) => {
    const current = wizard.spec.network[0];
    if (!current) return;
    updateNet({ inboundRules: current.inboundRules.filter((r) => r.id !== id) });
  };

  return (
    <div className="card">
      <div className="card-header">Networking</div>
      <p className="text-sm text-muted mb-4">
        Define the virtual network and inbound rules. Inbound rules are opt-in; wildcard CIDRs
        (0.0.0.0/0) trigger security findings and are never enabled silently.
      </p>

      {net ? (
        <>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Network Name</label>
              <input
                className="form-input"
                value={net.name}
                onChange={(e) => {
                  const detection = detectSecrets(e.target.value);
                  if (detection.detected) {
                    alert(detection.warnings.join('\n'));
                    return;
                  }
                  updateNet({ name: e.target.value });
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address Space (CIDR)</label>
              <input
                className="form-input"
                value={net.addressSpace}
                onChange={(e) => updateNet({ addressSpace: e.target.value })}
                placeholder="10.0.0.0/16"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Subnet Name</label>
              <input
                className="form-input"
                value={net.subnetName}
                onChange={(e) => updateNet({ subnetName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Subnet Prefix (CIDR)</label>
              <input
                className="form-input"
                value={net.subnetPrefix}
                onChange={(e) => updateNet({ subnetPrefix: e.target.value })}
                placeholder="10.0.0.0/24"
              />
            </div>
          </div>

          <div className="card-header mt-4">Inbound Rules (opt-in)</div>
          <div className="flex gap-2 mb-4 mt-2">
            <input
              className="form-input"
              type="number"
              value={newPort}
              onChange={(e) => setNewPort(e.target.value)}
              placeholder="Port (e.g. 22, 80, 443)"
              style={{ maxWidth: '180px' }}
            />
            <input
              className="form-input"
              value={newCidr}
              onChange={(e) => setNewCidr(e.target.value)}
              placeholder="Source CIDR (default 0.0.0.0/0)"
            />
            <button className="btn btn-primary" onClick={addRule}>
              Add Rule
            </button>
          </div>

          {net.inboundRules.length > 0 ? (
            <div className="checkbox-group">
              {net.inboundRules.map((r) => (
                <div key={r.id} className="checkbox-item">
                  <div className="checkbox-item-content">
                    <div className="checkbox-item-title">
                      TCP {r.port} &mdash; {r.sourceCidr}
                    </div>
                    <div className="checkbox-item-desc">{r.description}</div>
                    {r.sourceCidr.trim() === '0.0.0.0/0' && (
                      <div className="form-hint" style={{ color: 'var(--accent-warning)' }}>
                        Wildcard CIDR &mdash; this rule is open to the internet.
                      </div>
                    )}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeRule(r.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              No inbound rules added. The default posture denies inbound internet traffic.
            </p>
          )}
        </>
      ) : (
        <button className="btn btn-primary" onClick={() => ensureNet()}>
          Add Network
        </button>
      )}
    </div>
  );
}

// ─── Step 9: Initialization / Provider options ────────────────────────────

export function Step9Initialization() {
  const { wizard, patchSpec } = useWizard();
  const provider = wizard.spec.provider;
  const init = wizard.spec.initialisation[0];
  const azureCfg =
    wizard.spec.providerConfig.kind === 'azure' ? wizard.spec.providerConfig.azure : null;
  const awsCfg = wizard.spec.providerConfig.kind === 'aws' ? wizard.spec.providerConfig.aws : null;
  const osFamily = wizard.spec.compute[0]?.osFamily ?? 'linux';
  const azureImages = getAzureImages().filter((i) => i.osFamily === osFamily);
  const awsImages = getAwsImages().filter((i) => i.osFamily === osFamily);

  const ensureInit = () => {
    if (init) return init;
    const compute = wizard.spec.compute[0];
    if (!compute) {
      alert('Add a compute resource first (Step 7).');
      return null;
    }
    const fresh = {
      id: `init-${generateId()}`,
      targetComputeId: compute.id,
      kind: provider === 'azure' ? ('cloud-init' as const) : ('aws-user-data' as const),
      script: '',
      description: '',
      traceTo: [],
    };
    patchSpec((spec) => ({ ...spec, initialisation: [fresh] }));
    return fresh;
  };

  const updateInit = (patch: Partial<(typeof wizard.spec.initialisation)[number]>) => {
    patchSpec((spec) => {
      const list = spec.initialisation.length ? spec.initialisation : [ensureInit()!];
      return {
        ...spec,
        initialisation: list.map((i, idx) => (idx === 0 ? { ...i, ...patch } : i)),
      };
    });
  };

  const setAzureImage = (imageId: string | null) => {
    patchSpec((spec) => {
      if (spec.providerConfig.kind !== 'azure') return spec;
      return {
        ...spec,
        providerConfig: {
          kind: 'azure',
          azure: { ...spec.providerConfig.azure, imageId, imageReference: null },
        },
      };
    });
  };

  const setAwsImage = (imageId: string | null) => {
    patchSpec((spec) => {
      if (spec.providerConfig.kind !== 'aws') return spec;
      return {
        ...spec,
        providerConfig: {
          kind: 'aws',
          aws: {
            ...spec.providerConfig.aws,
            imageId,
            amiStrategy: 'ssm-parameter',
            explicitAmiId: null,
          },
        },
      };
    });
  };

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">
          {provider === 'azure' ? 'Azure Provider Options' : 'AWS Provider Options'}
        </div>

        {provider === 'azure' && azureCfg && (
          <>
            <div className="form-group">
              <label className="form-label">Resource Group Name</label>
              <input
                className="form-input"
                value={azureCfg.resourceGroupName}
                onChange={(e) => {
                  const detection = detectSecrets(e.target.value);
                  if (detection.detected) {
                    alert(detection.warnings.join('\n'));
                    return;
                  }
                  patchSpec((spec) => {
                    if (spec.providerConfig.kind !== 'azure') return spec;
                    return {
                      ...spec,
                      providerConfig: {
                        kind: 'azure',
                        azure: { ...spec.providerConfig.azure, resourceGroupName: e.target.value },
                      },
                    };
                  });
                }}
                placeholder="e.g. rg-lab-prod"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Operating System Image</label>
              <select
                className="form-select"
                value={azureCfg.imageId ?? ''}
                onChange={(e) => setAzureImage(e.target.value || null)}
              >
                <option value="">
                  Default {osFamily} image (application-generated, Classification E)
                </option>
                {azureImages.map((img) => (
                  <option key={img.id} value={img.id}>
                    {img.displayName}
                  </option>
                ))}
              </select>
              <div className="form-hint">
                Curated image references from the Azure Marketplace. Selecting one sets the
                publisher/offer/sku on the VM. The default is flagged as an application-generated
                default (Classification E) and should be reviewed.
              </div>
            </div>

            <label
              className={`checkbox-item ${azureCfg.bootDiagnosticsEnabled ? 'checked' : ''} mt-2`}
            >
              <input
                type="checkbox"
                checked={azureCfg.bootDiagnosticsEnabled}
                onChange={(e) =>
                  patchSpec((spec) => {
                    if (spec.providerConfig.kind !== 'azure') return spec;
                    return {
                      ...spec,
                      providerConfig: {
                        kind: 'azure',
                        azure: {
                          ...spec.providerConfig.azure,
                          bootDiagnosticsEnabled: e.target.checked,
                        },
                      },
                    };
                  })
                }
              />
              <div className="checkbox-item-content">
                <div className="checkbox-item-title">Boot Diagnostics Storage</div>
                <div className="checkbox-item-desc">
                  Opt-in only. Creates a Storage Account for boot diagnostics. This is NOT a managed
                  disk and is never enabled silently.
                </div>
              </div>
            </label>
          </>
        )}

        {provider === 'aws' && awsCfg && (
          <>
            <div className="form-group">
              <label className="form-label">CloudFormation Stack Name</label>
              <input
                className="form-input"
                value={awsCfg.stackName}
                onChange={(e) => {
                  const detection = detectSecrets(e.target.value);
                  if (detection.detected) {
                    alert(detection.warnings.join('\n'));
                    return;
                  }
                  patchSpec((spec) => {
                    if (spec.providerConfig.kind !== 'aws') return spec;
                    return {
                      ...spec,
                      providerConfig: {
                        kind: 'aws',
                        aws: { ...spec.providerConfig.aws, stackName: e.target.value },
                      },
                    };
                  });
                }}
                placeholder="e.g. lab-stack"
              />
            </div>

            <div className="form-group">
              <label className="form-label">AMI / Operating System Image</label>
              <select
                className="form-select"
                value={awsCfg.imageId ?? ''}
                onChange={(e) => setAwsImage(e.target.value || null)}
              >
                <option value="">Default {osFamily} AMI (SSM parameter, Classification E)</option>
                {awsImages.map((img) => (
                  <option key={img.id} value={img.id}>
                    {img.displayName}
                  </option>
                ))}
              </select>
              <div className="form-hint">
                SSM public parameter aliases are preferred over hard-coded AMI ids because they are
                region-independent and always resolve to a current image. The default is flagged as
                an application-generated default (Classification E).
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Key Pair Strategy</label>
              <select
                className="form-select"
                value={awsCfg.keyPairStrategy}
                onChange={(e) =>
                  patchSpec((spec) => {
                    if (spec.providerConfig.kind !== 'aws') return spec;
                    return {
                      ...spec,
                      providerConfig: {
                        kind: 'aws',
                        aws: {
                          ...spec.providerConfig.aws,
                          keyPairStrategy: e.target.value as 'existing-name' | 'none',
                        },
                      },
                    };
                  })
                }
              >
                <option value="none">
                  None (use SSM Session Manager or supply at deploy time)
                </option>
                <option value="existing-name">Reference an existing key pair name</option>
              </select>
              {awsCfg.keyPairStrategy === 'existing-name' && (
                <input
                  className="form-input mt-2"
                  value={awsCfg.keyPairName ?? ''}
                  onChange={(e) => {
                    const detection = detectSecrets(e.target.value);
                    if (detection.detected) {
                      alert(detection.warnings.join('\n'));
                      return;
                    }
                    patchSpec((spec) => {
                      if (spec.providerConfig.kind !== 'aws') return spec;
                      return {
                        ...spec,
                        providerConfig: {
                          kind: 'aws',
                          aws: { ...spec.providerConfig.aws, keyPairName: e.target.value },
                        },
                      };
                    });
                  }}
                  placeholder="e.g. lab-keypair"
                />
              )}
              <div className="form-hint">
                The private key is never stored in the template or the project. Only the key pair
                name is referenced.
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-header">Initialization Script (optional)</div>
        <p className="text-sm text-muted mb-4">
          User-supplied scripts are Classification F (user-supplied custom configuration). Scripts
          are secret-scanned and never allowed to embed credentials.
        </p>

        {init ? (
          <>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                className="form-input"
                value={init.description}
                onChange={(e) => {
                  const detection = detectSecrets(e.target.value);
                  if (detection.detected) {
                    alert(detection.warnings.join('\n'));
                    return;
                  }
                  updateInit({ description: e.target.value });
                }}
                placeholder="What this script does..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Script Content</label>
              <textarea
                className="form-textarea"
                rows={10}
                value={init.script}
                onChange={(e) => {
                  const detection = detectSecrets(e.target.value);
                  if (detection.detected) {
                    alert(detection.warnings.join('\n'));
                    return;
                  }
                  updateInit({ script: e.target.value });
                }}
                placeholder={
                  provider === 'azure'
                    ? '#cloud-init\npackage_update: true\npackages:\n  - nginx'
                    : '#!/bin/bash\nset -e\napt-get update && apt-get install -y nginx'
                }
              />
              <div className="form-hint">
                {provider === 'azure'
                  ? 'Cloud-init (base64-encoded at generation time). VM extensions remain opt-in.'
                  : 'EC2 user-data. Rendered as-is into the CloudFormation template.'}
              </div>
            </div>
          </>
        ) : (
          <button className="btn btn-secondary" onClick={() => ensureInit()}>
            Add Initialization Script
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 10: Review & generate ───────────────────────────────────────────

export function Step10Review() {
  const { wizard } = useWizard();
  const spec = wizard.spec;
  const compute = spec.compute[0];
  const net = spec.network[0];

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-1 border-bottom">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value || '\u2014'}</span>
    </div>
  );

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">Specification Summary</div>
        <Row label="Project name" value={spec.metadata.projectName} />
        <Row
          label="Provider"
          value={spec.provider === 'azure' ? 'Microsoft Azure' : 'Amazon Web Services'}
        />
        <Row label="Architecture pattern" value={spec.architecturePattern} />
        <Row label="Primary region" value={spec.location.primaryRegion} />
        <Row label="Deployment model" value={spec.deployment.model} />
        <Row label="Lab duration" value={`${spec.metadata.labDuration} min`} />
      </div>

      {compute && (
        <div className="card mb-4">
          <div className="card-header">Compute</div>
          <Row label="Name" value={compute.name} />
          <Row label="OS family" value={compute.osFamily} />
          <Row label="Size" value={compute.sizeId} />
          <Row label="Auth method" value={compute.authMethod} />
          <Row
            label="Public IP requested"
            value={compute.publicIpRequested ? 'Yes (opt-in)' : 'No'}
          />
        </div>
      )}

      {net && (
        <div className="card mb-4">
          <div className="card-header">Networking</div>
          <Row label="Network name" value={net.name} />
          <Row label="Address space" value={net.addressSpace} />
          <Row label="Subnet" value={`${net.subnetName} (${net.subnetPrefix})`} />
          <Row label="Inbound rules" value={String(net.inboundRules.length)} />
        </div>
      )}

      <div className="alert alert-info">
        <span>{'\u{2139}'}</span>
        <div>
          Select <strong>Generate</strong> to build the provider templates and review page. The
          internal model, evidence, security and cost findings are produced from this specification
          and shown on the review page.
        </div>
      </div>

      {spec.provider === 'aws' && (
        <div className="alert alert-info mt-2">
          <span>{'\u{2139}'}</span>
          <div>
            AWS CloudFormation YAML and JSON will be generated from this specification. Review the
            output on the review page.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 9: Storage (Phase 5) ────────────────────────────────────────────

export function Step9Storage() {
  const { wizard, patchSpec } = useWizard();
  const items = wizard.spec.storage;
  const provider = wizard.spec.provider;

  const storageKinds =
    provider === 'azure'
      ? (['azure-managed-disk', 'azure-storage-account'] as const)
      : (['aws-ebs-volume', 'aws-s3-bucket'] as const);

  const addStorage = () => {
    const item: StorageRequirement = {
      id: `storage-${generateId()}`,
      name: `storage-${items.length + 1}`,
      kind: storageKinds[0],
      sizeGb: 64,
      publicAccessBlocked: true,
      traceTo: [],
    };
    patchSpec((spec) => ({ ...spec, storage: [...spec.storage, item] }));
  };

  const updateStorage = (id: string, patch: Partial<StorageRequirement>) => {
    patchSpec((spec) => ({
      ...spec,
      storage: spec.storage.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const removeStorage = (id: string) => {
    patchSpec((spec) => ({ ...spec, storage: spec.storage.filter((s) => s.id !== id) }));
  };

  return (
    <div className="card">
      <div className="card-header">Storage &amp; Data</div>
      <p className="text-sm text-muted mb-4">
        Add standalone storage resources. Public access is blocked by default and must be explicitly
        opted in. Storage accounts and S3 buckets are generated with encryption enabled.
      </p>

      {items.length === 0 && (
        <div className="empty-state">
          <p className="text-muted">No storage resources added.</p>
        </div>
      )}

      {items.map((s) => (
        <div key={s.id} className="project-item">
          <div className="flex-1">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={s.name}
                  onChange={(e) => updateStorage(s.id, { name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-input"
                  value={s.kind}
                  onChange={(e) =>
                    updateStorage(s.id, { kind: e.target.value as StorageRequirement['kind'] })
                  }
                >
                  {storageKinds.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Size (GB)</label>
                <input
                  className="form-input"
                  type="number"
                  value={s.sizeGb ?? 64}
                  onChange={(e) => updateStorage(s.id, { sizeGb: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Public Access</label>
                <select
                  className="form-input"
                  value={s.publicAccessBlocked ? 'blocked' : 'allowed'}
                  onChange={(e) =>
                    updateStorage(s.id, { publicAccessBlocked: e.target.value === 'blocked' })
                  }
                >
                  <option value="blocked">Blocked (recommended)</option>
                  <option value="allowed">Allowed (requires review)</option>
                </select>
              </div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => removeStorage(s.id)}>
            Remove
          </button>
        </div>
      ))}

      <button className="btn btn-primary mt-4" onClick={addStorage}>
        {'\u{2795}'} Add Storage
      </button>
    </div>
  );
}

// ─── Step 10: Identity (Phase 5) ──────────────────────────────────────────

export function Step10Identity() {
  const { wizard, patchSpec } = useWizard();
  const items = wizard.spec.identity;
  const provider = wizard.spec.provider;

  const identityKind = provider === 'azure' ? 'azure-managed-identity' : 'aws-iam-role';

  const addIdentity = () => {
    const item: IdentityRequirement = {
      id: `identity-${generateId()}`,
      name: `identity-${items.length + 1}`,
      kind: identityKind as IdentityRequirement['kind'],
      purpose: '',
      traceTo: [],
    };
    patchSpec((spec) => ({ ...spec, identity: [...spec.identity, item] }));
  };

  const updateIdentity = (id: string, patch: Partial<IdentityRequirement>) => {
    patchSpec((spec) => ({
      ...spec,
      identity: spec.identity.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  };

  const removeIdentity = (id: string) => {
    patchSpec((spec) => ({ ...spec, identity: spec.identity.filter((i) => i.id !== id) }));
  };

  return (
    <div className="card">
      <div className="card-header">Identity &amp; Access</div>
      <p className="text-sm text-muted mb-4">
        Add managed identities (Azure) or IAM roles (AWS). Generated identities follow
        least-privilege principles. Role assignments and permissions must be configured separately.
      </p>

      {items.length === 0 && (
        <div className="empty-state">
          <p className="text-muted">No identity resources added.</p>
        </div>
      )}

      {items.map((i) => (
        <div key={i.id} className="project-item">
          <div className="flex-1">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={i.name}
                  onChange={(e) => updateIdentity(i.id, { name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <input className="form-input" value={i.kind} disabled />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Purpose</label>
              <input
                className="form-input"
                value={i.purpose}
                onChange={(e) => updateIdentity(i.id, { purpose: e.target.value })}
                placeholder="Describe what this identity is for"
              />
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => removeIdentity(i.id)}>
            Remove
          </button>
        </div>
      ))}

      <button className="btn btn-primary mt-4" onClick={addIdentity}>
        {'\u{2795}'} Add Identity
      </button>
    </div>
  );
}

// ─── Step 11: App Hosting (Phase 5) ───────────────────────────────────────

export function Step11AppHosting() {
  const { wizard, patchSpec } = useWizard();
  const items = wizard.spec.appHosting;
  const provider = wizard.spec.provider;
  const appKind = provider === 'azure' ? 'azure-app-service' : 'aws-app-runner';

  const addApp = () => {
    const item: AppHostingRequirement = {
      id: `app-${generateId()}`,
      name: `app-${items.length + 1}`,
      kind: appKind as AppHostingRequirement['kind'],
      runtime: 'nodejs',
      imageRef: '',
      publicEndpointRequested: false,
      environmentVariables: [],
      traceTo: [],
    };
    patchSpec((spec) => ({ ...spec, appHosting: [...spec.appHosting, item] }));
  };

  const updateApp = (id: string, patch: Partial<AppHostingRequirement>) => {
    patchSpec((spec) => ({
      ...spec,
      appHosting: spec.appHosting.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const removeApp = (id: string) => {
    patchSpec((spec) => ({ ...spec, appHosting: spec.appHosting.filter((a) => a.id !== id) }));
  };

  return (
    <div className="card">
      <div className="card-header">App Hosting</div>
      <p className="text-sm text-muted mb-4">
        Add managed web application hosting: Azure App Service or AWS App Runner. Public endpoints
        are opt-in only.
      </p>

      {items.length === 0 && (
        <div className="empty-state">
          <p className="text-muted">No app hosting resources added.</p>
        </div>
      )}

      {items.map((a) => (
        <div key={a.id} className="project-item">
          <div className="flex-1">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={a.name}
                  onChange={(e) => updateApp(a.id, { name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Runtime</label>
                <select
                  className="form-input"
                  value={a.runtime}
                  onChange={(e) => updateApp(a.id, { runtime: e.target.value })}
                >
                  <option value="nodejs">Node.js</option>
                  <option value="python">Python</option>
                  <option value="dotnet">.NET</option>
                  <option value="java">Java</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Image / Artifact Reference</label>
              <input
                className="form-input"
                value={a.imageRef}
                onChange={(e) => {
                  const detection = detectSecrets(e.target.value);
                  if (detection.detected) {
                    alert(detection.warnings.join('\n'));
                    return;
                  }
                  updateApp(a.id, { imageRef: e.target.value });
                }}
                placeholder="e.g. public.ecr.aws/nginx/nginx:latest"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Public Endpoint</label>
              <select
                className="form-input"
                value={a.publicEndpointRequested ? 'yes' : 'no'}
                onChange={(e) =>
                  updateApp(a.id, { publicEndpointRequested: e.target.value === 'yes' })
                }
              >
                <option value="no">No (private only)</option>
                <option value="yes">Yes (opt-in, requires review)</option>
              </select>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => removeApp(a.id)}>
            Remove
          </button>
        </div>
      ))}

      <button className="btn btn-primary mt-4" onClick={addApp}>
        {'\u{2795}'} Add App Hosting
      </button>
    </div>
  );
}

// ─── Step 12: Serverless (Phase 5) ────────────────────────────────────────

export function Step12Serverless() {
  const { wizard, patchSpec } = useWizard();
  const items = wizard.spec.serverless;
  const provider = wizard.spec.provider;
  const fnKind = provider === 'azure' ? 'azure-function' : 'aws-lambda';

  const addFn = () => {
    const item: ServerlessRequirement = {
      id: `fn-${generateId()}`,
      name: `function-${items.length + 1}`,
      kind: fnKind as ServerlessRequirement['kind'],
      runtime: 'nodejs18.x',
      handler: 'index.handler',
      codeArtifact: '',
      memoryMb: 128,
      timeoutSeconds: 30,
      httpTriggerRequested: false,
      environmentVariables: [],
      traceTo: [],
    };
    patchSpec((spec) => ({ ...spec, serverless: [...spec.serverless, item] }));
  };

  const updateFn = (id: string, patch: Partial<ServerlessRequirement>) => {
    patchSpec((spec) => ({
      ...spec,
      serverless: spec.serverless.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  };

  const removeFn = (id: string) => {
    patchSpec((spec) => ({ ...spec, serverless: spec.serverless.filter((f) => f.id !== id) }));
  };

  return (
    <div className="card">
      <div className="card-header">Serverless</div>
      <p className="text-sm text-muted mb-4">
        Add serverless functions: Azure Functions or AWS Lambda. HTTP triggers are opt-in only. AWS
        Lambda auto-includes a minimal execution role.
      </p>

      {items.length === 0 && (
        <div className="empty-state">
          <p className="text-muted">No serverless functions added.</p>
        </div>
      )}

      {items.map((f) => (
        <div key={f.id} className="project-item">
          <div className="flex-1">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={f.name}
                  onChange={(e) => updateFn(f.id, { name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Runtime</label>
                <input
                  className="form-input"
                  value={f.runtime}
                  onChange={(e) => updateFn(f.id, { runtime: e.target.value })}
                  placeholder="e.g. nodejs18.x, python3.11"
                />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Handler</label>
                <input
                  className="form-input"
                  value={f.handler}
                  onChange={(e) => updateFn(f.id, { handler: e.target.value })}
                  placeholder="e.g. index.handler"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Code Artifact</label>
                <input
                  className="form-input"
                  value={f.codeArtifact}
                  onChange={(e) => {
                    const detection = detectSecrets(e.target.value);
                    if (detection.detected) {
                      alert(detection.warnings.join('\n'));
                      return;
                    }
                    updateFn(f.id, { codeArtifact: e.target.value });
                  }}
                  placeholder="Inline code or zip reference"
                />
              </div>
            </div>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Memory (MB)</label>
                <input
                  className="form-input"
                  type="number"
                  value={f.memoryMb}
                  onChange={(e) => updateFn(f.id, { memoryMb: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Timeout (s)</label>
                <input
                  className="form-input"
                  type="number"
                  value={f.timeoutSeconds}
                  onChange={(e) => updateFn(f.id, { timeoutSeconds: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">HTTP Trigger</label>
                <select
                  className="form-input"
                  value={f.httpTriggerRequested ? 'yes' : 'no'}
                  onChange={(e) =>
                    updateFn(f.id, { httpTriggerRequested: e.target.value === 'yes' })
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes (opt-in)</option>
                </select>
              </div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => removeFn(f.id)}>
            Remove
          </button>
        </div>
      ))}

      <button className="btn btn-primary mt-4" onClick={addFn}>
        {'\u{2795}'} Add Function
      </button>
    </div>
  );
}

// ─── Step 13: Containers (Phase 5) ────────────────────────────────────────

export function Step13Containers() {
  const { wizard, patchSpec } = useWizard();
  const items = wizard.spec.containers;
  const provider = wizard.spec.provider;
  const ctrKind = provider === 'azure' ? 'azure-container-instance' : 'aws-ecs-fargate';

  const addCtr = () => {
    const item: ContainerRequirement = {
      id: `ctr-${generateId()}`,
      name: `container-${items.length + 1}`,
      kind: ctrKind as ContainerRequirement['kind'],
      image: 'nginx:latest',
      cpu: 1,
      memoryGb: 1.5,
      port: 80,
      publicEndpointRequested: false,
      environmentVariables: [],
      traceTo: [],
    };
    patchSpec((spec) => ({ ...spec, containers: [...spec.containers, item] }));
  };

  const updateCtr = (id: string, patch: Partial<ContainerRequirement>) => {
    patchSpec((spec) => ({
      ...spec,
      containers: spec.containers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const removeCtr = (id: string) => {
    patchSpec((spec) => ({ ...spec, containers: spec.containers.filter((c) => c.id !== id) }));
  };

  return (
    <div className="card">
      <div className="card-header">Containers</div>
      <p className="text-sm text-muted mb-4">
        Add container workloads: Azure Container Instances or AWS ECS Fargate. Public endpoints are
        opt-in only. AWS ECS Fargate auto-includes a task execution role.
      </p>

      {items.length === 0 && (
        <div className="empty-state">
          <p className="text-muted">No container resources added.</p>
        </div>
      )}

      {items.map((c) => (
        <div key={c.id} className="project-item">
          <div className="flex-1">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={c.name}
                  onChange={(e) => updateCtr(c.id, { name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Image</label>
                <input
                  className="form-input"
                  value={c.image}
                  onChange={(e) => {
                    const detection = detectSecrets(e.target.value);
                    if (detection.detected) {
                      alert(detection.warnings.join('\n'));
                      return;
                    }
                    updateCtr(c.id, { image: e.target.value });
                  }}
                  placeholder="e.g. nginx:latest"
                />
              </div>
            </div>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">CPU</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.5"
                  value={c.cpu}
                  onChange={(e) => updateCtr(c.id, { cpu: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Memory (GB)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.5"
                  value={c.memoryGb}
                  onChange={(e) => updateCtr(c.id, { memoryGb: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Port</label>
                <input
                  className="form-input"
                  type="number"
                  value={c.port}
                  onChange={(e) => updateCtr(c.id, { port: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Public Endpoint</label>
              <select
                className="form-input"
                value={c.publicEndpointRequested ? 'yes' : 'no'}
                onChange={(e) =>
                  updateCtr(c.id, { publicEndpointRequested: e.target.value === 'yes' })
                }
              >
                <option value="no">No (private only)</option>
                <option value="yes">Yes (opt-in, requires review)</option>
              </select>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => removeCtr(c.id)}>
            Remove
          </button>
        </div>
      ))}

      <button className="btn btn-primary mt-4" onClick={addCtr}>
        {'\u{2795}'} Add Container
      </button>
    </div>
  );
}

// ─── Step 14: Professional Mode (Phase 6) ─────────────────────────────────

export function Step14Professional() {
  const { wizard, patchSpec } = useWizard();
  const prof = wizard.spec.professional ?? { azureFragments: [], awsFragments: [], notes: '' };
  const provider = wizard.spec.provider;
  const [newFragment, setNewFragment] = useState('');

  const ensureProf = () => {
    if (wizard.spec.professional) return wizard.spec.professional;
    const fresh = { azureFragments: [], awsFragments: [], notes: '' };
    patchSpec((spec) => ({ ...spec, professional: fresh }));
    return fresh;
  };

  const addFragment = () => {
    if (!newFragment.trim()) return;
    const detection = detectSecrets(newFragment);
    if (detection.detected) {
      alert(`Potential secret detected in fragment:\n${detection.warnings.join('\n')}`);
      return;
    }
    const current = ensureProf();
    if (provider === 'azure') {
      patchSpec((spec) => ({
        ...spec,
        professional: { ...current, azureFragments: [...current.azureFragments, newFragment] },
      }));
    } else {
      patchSpec((spec) => ({
        ...spec,
        professional: { ...current, awsFragments: [...current.awsFragments, newFragment] },
      }));
    }
    setNewFragment('');
  };

  const removeFragment = (index: number) => {
    const current = ensureProf();
    if (provider === 'azure') {
      patchSpec((spec) => ({
        ...spec,
        professional: {
          ...current,
          azureFragments: current.azureFragments.filter((_, i) => i !== index),
        },
      }));
    } else {
      patchSpec((spec) => ({
        ...spec,
        professional: {
          ...current,
          awsFragments: current.awsFragments.filter((_, i) => i !== index),
        },
      }));
    }
  };

  const updateNotes = (value: string) => {
    const detection = detectSecrets(value);
    if (detection.detected) {
      alert(detection.warnings.join('\n'));
      return;
    }
    const current = ensureProf();
    patchSpec((spec) => ({ ...spec, professional: { ...current, notes: value } }));
  };

  const fragments = provider === 'azure' ? prof.azureFragments : prof.awsFragments;

  return (
    <div className="card">
      <div className="card-header">Professional Mode — Custom Fragments</div>
      <p className="text-sm text-muted mb-4">
        Add custom provider-native fragments (Bicep, ARM JSON, CloudFormation YAML/JSON). These are
        Classification F (user-supplied) and are injected into the generated template with clear
        boundary markers. They are NOT validated against official evidence.
      </p>

      <div className="alert alert-warning mb-4">
        <span>{'\u{26A0}'}</span>
        <div>
          Custom fragments are <strong>not</strong> evidence-backed. They must be manually reviewed
          for correctness, security, and duplicate identifiers before deployment.
        </div>
      </div>

      {fragments.length > 0 && (
        <div className="project-list mb-4">
          {fragments.map((frag, i) => (
            <div key={i} className="project-item">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-warning">Classification F</span>
                  <span className="text-sm text-muted">Fragment {i + 1}</span>
                </div>
                <pre className="code-block" data-language={provider === 'azure' ? 'bicep' : 'yaml'}>
                  <code>{frag}</code>
                </pre>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => removeFragment(i)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Add Custom Fragment</label>
        <textarea
          className="form-input"
          rows={6}
          value={newFragment}
          onChange={(e) => setNewFragment(e.target.value)}
          placeholder={
            provider === 'azure'
              ? '// Paste Bicep or ARM JSON fragment here...'
              : '# Paste CloudFormation YAML or JSON fragment here...'
          }
        />
        <div className="form-hint">
          Fragments are secret-scanned before being added. No credentials or keys are allowed.
        </div>
      </div>
      <button className="btn btn-primary mt-2" onClick={addFragment}>
        {'\u{2795}'} Add Fragment
      </button>

      <div className="form-group mt-4">
        <label className="form-label">Notes</label>
        <textarea
          className="form-input"
          rows={3}
          value={prof.notes}
          onChange={(e) => updateNotes(e.target.value)}
          placeholder="Document why these custom fragments are needed..."
        />
      </div>
    </div>
  );
}

export const WIZARD_STEPS: Array<{ label: string; component: () => JSX.Element }> = [
  { label: 'Project', component: Step1Project },
  { label: 'Provider', component: Step2Provider },
  { label: 'Purpose', component: Step3Purpose },
  { label: 'Deployment', component: Step4Deployment },
  { label: 'Region', component: Step5Region },
  { label: 'Pattern', component: Step6Pattern },
  { label: 'Compute', component: Step7Compute },
  { label: 'Networking', component: Step8Networking },
  { label: 'Storage', component: Step9Storage },
  { label: 'Identity', component: Step10Identity },
  { label: 'App Hosting', component: Step11AppHosting },
  { label: 'Serverless', component: Step12Serverless },
  { label: 'Containers', component: Step13Containers },
  { label: 'Professional', component: Step14Professional },
  { label: 'Init', component: Step9Initialization },
  { label: 'Review', component: Step10Review },
];

export function canProceed(step: number, spec: LabSpecification): boolean {
  if (step === 0) return spec.metadata.projectName.trim().length > 0;
  if (step === 1) return spec.provider === 'azure' || spec.provider === 'aws';
  return true;
}
