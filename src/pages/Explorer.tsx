import { useState } from 'react';
import type { CloudProvider, PatternDef } from '@/types';
import { azurePatternList, awsPatternList, findResource } from '@/lib/data';
import EvidenceBadge from '@/components/EvidenceBadge';

function PatternCard({ pattern }: { pattern: PatternDef }) {
  return (
    <div className="card mb-4">
      <div className="card-header flex items-center justify-between">
        <span>{pattern.title}</span>
        <span className="badge badge-neutral">{pattern.patternId}</span>
      </div>
      <p className="text-sm text-secondary">{pattern.purpose}</p>

      <h4 className="font-semibold text-sm mt-4">Suggested resources</h4>
      <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
        {pattern.suggestedResources.map((id) => {
          const res = findResource(pattern.provider, id);
          return (
            <span key={id} className="badge badge-info" title={res?.resourceType}>
              {res ? res.resourceType : id}
            </span>
          );
        })}
      </div>

      <h4 className="font-semibold text-sm mt-4">Security observations</h4>
      <ul className="text-sm text-secondary">
        {pattern.securityObservations.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <h4 className="font-semibold text-sm mt-4">Cost considerations</h4>
      <ul className="text-sm text-secondary">
        {pattern.costConsiderations.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <h4 className="font-semibold text-sm mt-4">Limitations</h4>
      <ul className="text-sm text-secondary">
        {pattern.limitations.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
        {pattern.evidence.map((e, i) => (
          <EvidenceBadge key={i} classification={e.classification} title={e.sourceTitle} />
        ))}
        <a
          className="badge badge-neutral"
          href={pattern.documentationUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Documentation
        </a>
      </div>
    </div>
  );
}

export default function Explorer() {
  const [provider, setProvider] = useState<CloudProvider>('azure');
  const patterns = provider === 'azure' ? azurePatternList : awsPatternList;

  return (
    <div>
      <div className="mb-6">
        <h2 className="section-title">Official Pattern Explorer</h2>
        <p className="section-subtitle">
          Trusted Azure and AWS infrastructure patterns with sources, classifications, security
          observations, cost considerations and limitations. Patterns may suggest resources but
          always require review.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          className={`btn ${provider === 'azure' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setProvider('azure')}
        >
          Microsoft Azure
        </button>
        <button
          className={`btn ${provider === 'aws' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setProvider('aws')}
        >
          Amazon Web Services
        </button>
      </div>

      {patterns.map((p) => (
        <PatternCard key={p.id} pattern={p} />
      ))}
    </div>
  );
}
