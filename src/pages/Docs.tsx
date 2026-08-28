import { BOUNDARY_STATEMENT } from '@/lib/app-info';
import { EVIDENCE_LABELS } from '@/components/EvidenceBadge';
import type { EvidenceClassification } from '@/types';

const CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export default function Docs() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="section-title">Documentation &amp; Methodology</h2>
        <p className="section-subtitle">
          How SoT Cloud Template Studio generates evidence-backed Infrastructure-as-Code.
        </p>
      </div>

      <div className="alert alert-warning mb-6">
        <strong>Product boundary.</strong> {BOUNDARY_STATEMENT}
      </div>

      <div className="card mb-6">
        <div className="card-header">Evidence classification (A&ndash;G)</div>
        <p className="text-sm text-secondary">
          Every generated resource and important property carries at least one evidence
          classification. Nothing is presented as a provider or Skillable requirement unless it is
          backed by Classification A&ndash;D.
        </p>
        <table className="table mt-4">
          <thead>
            <tr>
              <th>Class</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((c) => (
              <tr key={c}>
                <td>
                  <span className={`badge badge-evidence-${c.toLowerCase()}`}>Class {c}</span>
                </td>
                <td className="text-sm">
                  {EVIDENCE_LABELS[c as EvidenceClassification].split(' \u00B7 ')[1]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mb-6">
        <div className="card-header">Provider models remain separate</div>
        <p className="text-sm text-secondary">
          Azure and AWS use different resource models, naming systems, identity models, networking
          models and deployment semantics. The studio provides conceptual mapping only and never
          performs a silent one-to-one conversion between providers.
        </p>
        <table className="table mt-4">
          <thead>
            <tr>
              <th>Concept</th>
              <th>Azure</th>
              <th>AWS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Infrastructure template</td>
              <td>Bicep / ARM</td>
              <td>CloudFormation</td>
            </tr>
            <tr>
              <td>Deployment container</td>
              <td>Resource Group</td>
              <td>CloudFormation Stack</td>
            </tr>
            <tr>
              <td>Virtual machine</td>
              <td>Azure Virtual Machine</td>
              <td>EC2 Instance</td>
            </tr>
            <tr>
              <td>Network</td>
              <td>Virtual Network</td>
              <td>VPC</td>
            </tr>
            <tr>
              <td>Firewall control</td>
              <td>Network Security Group</td>
              <td>Security Group</td>
            </tr>
            <tr>
              <td>Object storage</td>
              <td>Storage Account / Blob</td>
              <td>S3 Bucket</td>
            </tr>
            <tr>
              <td>Managed identity</td>
              <td>Managed Identity</td>
              <td>IAM Role / Instance Profile</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm text-muted mt-2">This mapping is conceptual guidance only.</p>
      </div>

      <div className="card mb-6">
        <div className="card-header">Dependency handling</div>
        <p className="text-sm text-secondary">
          Dependencies are a data-driven, first-class system. Required supporting resources (for
          example an Azure VM&rsquo;s managed disk, NIC, virtual network and network security group,
          or an EC2 instance&rsquo;s VPC, subnet, security group and root EBS volume) are marked as
          auto-included and can be inspected. Optional infrastructure &mdash; public IP addresses,
          internet gateways, boot-diagnostics storage &mdash; stays opt-in and is never added
          silently.
        </p>
      </div>

      <div className="card mb-6">
        <div className="card-header">Security &amp; cost review</div>
        <p className="text-sm text-secondary">
          The studio produces structured security findings (public exposure, unrestricted CIDRs,
          management ports, weak authentication, missing encryption, public storage, embedded
          credentials, oversized compute and missing dependencies) and cost-risk guidance. It does
          not fabricate prices; where exact pricing is unavailable it links to the provider&rsquo;s
          official pricing calculator. It never claims a template is penetration-tested or confirmed
          secure.
        </p>
      </div>

      <div className="card">
        <div className="card-header">Local storage &amp; privacy</div>
        <p className="text-sm text-secondary">
          Projects are stored in your browser&rsquo;s localStorage and can be exported/imported as
          JSON. There is no server, no database and no authentication. The studio never asks for or
          stores cloud credentials, access keys, secret keys, client secrets, private keys,
          connection strings, SAS tokens or passwords.
        </p>
      </div>
    </div>
  );
}
