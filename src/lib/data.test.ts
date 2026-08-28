import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import {
  getResourceCatalogue,
  getComputeSizes,
  findEvidence,
  findResource,
  azurePatternList,
  awsPatternList,
} from './data';
import resourceCatalogueSchema from '@/data-schemas/resource-catalogue.schema.json';
import azureResourceCatalogue from '@data/azure-resource-catalogue.json';
import awsResourceCatalogue from '@data/aws-resource-catalogue.json';
import type { CloudProvider } from '@/types';

const ajv = new Ajv({ allErrors: true });
const validateCatalogue = ajv.compile(resourceCatalogueSchema);

describe('catalogue schema validation', () => {
  it('validates the Azure resource catalogue against the JSON schema', () => {
    const valid = validateCatalogue(azureResourceCatalogue);
    expect(validateCatalogue.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('validates the AWS resource catalogue against the JSON schema', () => {
    const valid = validateCatalogue(awsResourceCatalogue);
    expect(validateCatalogue.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });
});

describe('referential integrity', () => {
  const providers: CloudProvider[] = ['azure', 'aws'];

  it('every resource lives in its own provider catalogue (no cross-provider entries)', () => {
    for (const provider of providers) {
      for (const resource of getResourceCatalogue(provider)) {
        expect(resource.provider).toBe(provider);
        for (const dep of resource.dependencies) {
          expect(dep.provider).toBe(provider);
        }
      }
    }
  });

  it('every dependency evidenceReference resolves in the evidence index', () => {
    for (const provider of providers) {
      for (const resource of getResourceCatalogue(provider)) {
        for (const dep of resource.dependencies) {
          expect(
            findEvidence(dep.evidenceReference),
            `missing evidence: ${dep.evidenceReference}`,
          ).toBeDefined();
        }
      }
    }
  });

  it('every compute size evidenceReference resolves in the evidence index', () => {
    for (const provider of providers) {
      for (const size of getComputeSizes(provider)) {
        expect(
          findEvidence(size.evidenceReference),
          `missing evidence: ${size.evidenceReference}`,
        ).toBeDefined();
      }
    }
  });

  it('every pattern suggestedResource resolves to a catalogue resource of the same provider', () => {
    for (const pattern of [...azurePatternList, ...awsPatternList]) {
      for (const id of pattern.suggestedResources) {
        expect(findResource(pattern.provider, id), `missing resource: ${id}`).toBeDefined();
      }
    }
  });
});
