/**
 * Simplified Kn0wdZ Content Import
 * Matches exact structure of existing PennyDrops content
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const developerContent = [
  {
    slug: 'qiri-sdk-quick-start',
    title: 'QIRI SDK Quick Start',
    excerpt: 'Get started with the QIRI SDK in minutes. Build your first iQube-powered application.',
    status: 'published',
    tags: ['21knowdz', 'developer', 'sdk', 'quickstart'],
    placement: { section: '21knowdz', tab: 'developer' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# QIRI SDK Quick Start\n\nThe QIRI SDK provides a simple interface for building iQube-powered applications.\n\n## Installation\n\n```bash\nnpm install @qriptopian/sdk\n```\n\n## Basic Usage\n\n```javascript\nimport { QIRI } from \'@qriptopian/sdk\';\n\nconst qiri = new QIRI({\n  network: \'mainnet\',\n  apiKey: process.env.QIRI_KEY\n});\n\n// Create a transaction\nconst tx = await qiri.send({\n  to: \'did:qiri:recipient\',\n  amount: 100,\n  memo: \'Payment for services\'\n});\n```',
        duration: '5 min read'
      },
      link: {
        available: true,
        url: 'https://docs.qripto.net/sdk/quickstart',
        allow_embed: false
      }
    },
  },
  {
    slug: 'building-with-iqubes',
    title: 'Building with iQubes',
    excerpt: 'Learn how to create, manage, and interact with iQubes in your applications.',
    status: 'published',
    tags: ['21knowdz', 'developer', 'iqubes', 'tutorial'],
    placement: { section: '21knowdz', tab: 'developer' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Building with iQubes\n\niQubes are the fundamental building blocks of the Qriptopian ecosystem.\n\n## What is an iQube?\n\nAn iQube is a self-contained unit of value, data, and logic that can be transferred, stored, and executed across chains.\n\n## Creating an iQube\n\n```javascript\nconst iqube = await qiri.createIQube({\n  type: \'content\',\n  data: {\n    title: \'My Article\',\n    content: \'...\'\n  },\n  value: 100 // Q¢\n});\n```',
        duration: '8 min read'
      }
    },
  },
  {
    slug: 'cross-chain-integration',
    title: 'Cross-Chain Integration',
    excerpt: 'Connect your application to multiple blockchains using the QIRI protocol.',
    status: 'published',
    tags: ['21knowdz', 'developer', 'cross-chain', 'integration'],
    placement: { section: '21knowdz', tab: 'developer' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Cross-Chain Integration\n\nQIRI enables seamless cross-chain operations.\n\n## Supported Chains\n\n- Ethereum\n- Polygon\n- Arbitrum\n- Optimism\n- Base\n- Internet Computer\n- Bitcoin (via PSBT)\n\n## Example: Cross-Chain Transfer\n\n```javascript\nconst transfer = await qiri.crossChainTransfer({\n  from: { chain: \'ethereum\', address: \'0x...\' },\n  to: { chain: \'polygon\', address: \'0x...\' },\n  amount: 1000\n});\n```',
        duration: '10 min read'
      }
    },
  },
  {
    slug: 'aigent-integration-guide',
    title: 'Aigent Integration Guide',
    excerpt: 'Integrate AI agents into your application for autonomous operations.',
    status: 'published',
    tags: ['21knowdz', 'developer', 'aigents', 'ai'],
    placement: { section: '21knowdz', tab: 'developer' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Aigent Integration Guide\n\nAigents are autonomous AI agents that can execute transactions on behalf of users.\n\n## Creating an Aigent\n\n```javascript\nconst aigent = await qiri.createAigent({\n  name: \'MyAigent\',\n  capabilities: [\'send\', \'receive\', \'swap\'],\n  budget: 1000 // Q¢\n});\n```\n\n## Aigent Operations\n\nAigents can:\n- Monitor balances\n- Execute trades\n- Manage portfolios\n- Process payments',
        duration: '12 min read'
      }
    },
  },
  {
    slug: 'api-reference-examples',
    title: 'API Reference & Examples',
    excerpt: 'Complete API documentation with code examples and best practices.',
    status: 'published',
    tags: ['21knowdz', 'developer', 'api', 'reference'],
    placement: { section: '21knowdz', tab: 'developer' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# API Reference\n\n## Core Methods\n\n### qiri.send()\nSend Q¢ or iQubes to another address.\n\n### qiri.receive()\nReceive and process incoming transfers.\n\n### qiri.balance()\nCheck account balance across chains.\n\n### qiri.swap()\nExchange between different tokens.\n\n## Best Practices\n\n1. Always validate addresses\n2. Use error handling\n3. Implement retry logic\n4. Monitor gas fees',
        duration: '15 min read'
      },
      link: {
        available: true,
        url: 'https://docs.qripto.net/api',
        allow_embed: false
      }
    },
  }
];

const executiveContent = [
  {
    slug: 'strategic-impact-framework',
    title: 'Strategic Impact Framework',
    excerpt: 'Measure and report the real-world impact of iQube infrastructure deployment.',
    status: 'published',
    tags: ['21knowdz', 'executive', 'strategy', 'impact'],
    placement: { section: '21knowdz', tab: 'executive' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Strategic Impact Framework\n\n## Measuring Success\n\nTrack key metrics:\n- Transaction volume\n- User adoption\n- Cross-chain activity\n- Cost savings\n\n## Reporting Structure\n\n1. Executive Summary\n2. Key Performance Indicators\n3. Growth Metrics\n4. Strategic Recommendations',
        duration: '8 min read'
      }
    },
  },
  {
    slug: 'enterprise-integration-playbook',
    title: 'Enterprise Integration Playbook',
    excerpt: 'Step-by-step guide for integrating iQube infrastructure into enterprise systems.',
    status: 'published',
    tags: ['21knowdz', 'executive', 'enterprise', 'integration'],
    placement: { section: '21knowdz', tab: 'executive' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Enterprise Integration Playbook\n\n## Phase 1: Assessment\n- Current infrastructure audit\n- Requirements gathering\n- ROI analysis\n\n## Phase 2: Implementation\n- Pilot program\n- Integration testing\n- Staff training\n\n## Phase 3: Scale\n- Full deployment\n- Performance monitoring\n- Continuous optimization',
        duration: '10 min read'
      }
    },
  },
  {
    slug: 'revenue-models-business-cases',
    title: 'Revenue Models & Business Cases',
    excerpt: 'Explore sustainable revenue models and build compelling business cases.',
    status: 'published',
    tags: ['21knowdz', 'executive', 'revenue', 'business'],
    placement: { section: '21knowdz', tab: 'executive' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Revenue Models & Business Cases\n\n## Revenue Streams\n\n1. **Transaction Fees**: Micro-fees on Q¢ transfers\n2. **Enterprise Licensing**: SaaS model for businesses\n3. **Premium Features**: Advanced analytics and tools\n4. **Partnership Revenue**: Integration partnerships\n\n## Building the Business Case\n\n- Cost reduction analysis\n- Efficiency gains\n- New revenue opportunities\n- Competitive advantages',
        duration: '12 min read'
      }
    },
  },
  {
    slug: 'operational-scaling-strategy',
    title: 'Operational Scaling Strategy',
    excerpt: 'Scale operations efficiently while maintaining quality and performance.',
    status: 'published',
    tags: ['21knowdz', 'executive', 'operations', 'scaling'],
    placement: { section: '21knowdz', tab: 'executive' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Operational Scaling Strategy\n\n## Infrastructure Scaling\n\n- Horizontal scaling for high availability\n- Load balancing across chains\n- Automated failover systems\n\n## Team Scaling\n\n- Hiring roadmap\n- Training programs\n- Knowledge management\n\n## Process Optimization\n\n- Automation opportunities\n- Workflow improvements\n- Quality assurance',
        duration: '10 min read'
      }
    },
  },
  {
    slug: 'market-positioning-ecosystem-growth',
    title: 'Market Positioning & Ecosystem Growth',
    excerpt: 'Position your organization for success in the evolving Web3 ecosystem.',
    status: 'published',
    tags: ['21knowdz', 'executive', 'market', 'growth'],
    placement: { section: '21knowdz', tab: 'executive' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Market Positioning & Ecosystem Growth\n\n## Competitive Analysis\n\n- Market landscape\n- Key differentiators\n- Competitive advantages\n\n## Partnership Strategy\n\n- Strategic alliances\n- Integration partners\n- Ecosystem development\n\n## Growth Metrics\n\n- Market share\n- User acquisition\n- Revenue growth\n- Network effects',
        duration: '15 min read'
      }
    },
  },
  {
    slug: 'risk-management-compliance',
    title: 'Risk Management & Compliance',
    excerpt: 'Navigate regulatory requirements and manage operational risks effectively.',
    status: 'published',
    tags: ['21knowdz', 'executive', 'risk', 'compliance'],
    placement: { section: '21knowdz', tab: 'executive' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Risk Management & Compliance\n\n## Regulatory Landscape\n\n- Current regulations\n- Compliance requirements\n- Future outlook\n\n## Risk Mitigation\n\n- Security protocols\n- Audit procedures\n- Insurance coverage\n\n## Best Practices\n\n- Regular compliance reviews\n- Documentation standards\n- Incident response plans',
        duration: '12 min read'
      }
    },
  },
  {
    slug: 'executive-dashboard-analytics',
    title: 'Executive Dashboard & Analytics',
    excerpt: 'Real-time insights and analytics for data-driven decision making.',
    status: 'published',
    tags: ['21knowdz', 'executive', 'analytics', 'dashboard'],
    placement: { section: '21knowdz', tab: 'executive' },
    domain: 'qriptopian',
    type: 'tutorial',
    format: 'article',
    modalities: {
      read: {
        available: true,
        text: '# Executive Dashboard & Analytics\n\n## Key Metrics\n\n- Transaction volume\n- Active users\n- Revenue trends\n- Cost efficiency\n\n## Analytics Tools\n\n- Real-time monitoring\n- Predictive analytics\n- Custom reports\n- Data visualization\n\n## Decision Support\n\n- Scenario modeling\n- Trend analysis\n- Performance benchmarks',
        duration: '8 min read'
      }
    },
  }
];

async function importContent() {
  console.log('Starting simplified content import...\n');

  // Check existing content
  const { data: existingDev } = await supabase
    .from('content')
    .select('id, title')
    .eq('placement->>section', '21knowdz')
    .eq('placement->>tab', 'developer');

  const { data: existingExec } = await supabase
    .from('content')
    .select('id, title')
    .eq('placement->>section', '21knowdz')
    .eq('placement->>tab', 'executive');

  console.log(`Found ${existingDev?.length || 0} existing Developer articles`);
  console.log(`Found ${existingExec?.length || 0} existing Executive articles\n`);

  let devImported = 0, devSkipped = 0;
  let execImported = 0, execSkipped = 0;

  // Import Developer content
  console.log('Importing Developer tab content...');
  for (const item of developerContent) {
    const exists = existingDev?.some(e => e.title === item.title);
    if (exists) {
      console.log(`⊘ Skipped: ${item.title}`);
      devSkipped++;
      continue;
    }

    const { error } = await supabase.from('content').insert(item);
    if (error) {
      console.error(`✗ Error importing "${item.title}":`, error.message);
    } else {
      console.log(`✓ Imported: ${item.title}`);
      devImported++;
    }
  }

  // Import Executive content
  console.log('\nImporting Executive tab content...');
  for (const item of executiveContent) {
    const exists = existingExec?.some(e => e.title === item.title);
    if (exists) {
      console.log(`⊘ Skipped: ${item.title}`);
      execSkipped++;
      continue;
    }

    const { error } = await supabase.from('content').insert(item);
    if (error) {
      console.error(`✗ Error importing "${item.title}":`, error.message);
    } else {
      console.log(`✓ Imported: ${item.title}`);
      execImported++;
    }
  }

  console.log('\n✅ Content import complete!');
  console.log(`\nResults:`);
  console.log(`- Developer: ${devImported} imported, ${devSkipped} skipped`);
  console.log(`- Executive: ${execImported} imported, ${execSkipped} skipped`);
  console.log(`\nTotal: ${devImported + execImported} new articles added`);
}

importContent().catch(console.error);
