import { IQubeTemplate } from '../../../../types/registry';

let templates: IQubeTemplate[] | null = null;

function seed(): IQubeTemplate[] {
  return [
    {
      id: 'template-001',
      name: 'Personal Data iQube',
      description: 'Template for storing and managing personal identity information with high security and privacy controls.',
      createdAt: '2025-08-15T12:00:00Z',
      iQubeType: 'DataQube',
      iQubeInstanceType: 'template',
      businessModel: 'Subscribe',
      sensitivityScore: 7,
      accuracyScore: 9,
      verifiabilityScore: 7,
      riskScore: 8,
    },
    {
      id: 'template-002',
      name: 'Financial Transaction iQube',
      description: 'Secure template for recording and verifying financial transactions with audit trails.',
      createdAt: '2025-08-10T14:30:00Z',
      iQubeType: 'DataQube',
      iQubeInstanceType: 'template',
      businessModel: 'Buy',
      sensitivityScore: 6,
      accuracyScore: 10,
      verifiabilityScore: 9,
      riskScore: 6,
    },
    {
      id: 'template-003',
      name: 'Content Verification iQube',
      description: 'Template for verifying the authenticity and provenance of digital content and media.',
      createdAt: '2025-08-05T09:15:00Z',
      iQubeType: 'ContentQube',
      iQubeInstanceType: 'template',
      businessModel: 'License',
      sensitivityScore: 3,
      accuracyScore: 8,
      verifiabilityScore: 10,
      riskScore: 4,
    },
  ];
}

export function getStore(): IQubeTemplate[] {
  if (!templates) templates = seed();
  return templates;
}

export function setStore(next: IQubeTemplate[]) {
  templates = next;
}
