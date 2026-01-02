/**
 * Import Kn0wdZ and PennyDrops content to Supabase
 * 
 * This script imports missing content for:
 * - 21knowdz developer tab
 * - 21knowdz executive tab
 * - Fixes PennyDrops image URLs
 * 
 * Usage: node --env-file=.env.local scripts/import-knowdz-content.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Kn0wdZ Developer Tab Content
const developerContent = [
  {
    title: 'QIRI SDK Quick Start',
    slug: 'qiri-sdk-quick-start',
    excerpt: 'Get started with the QIRI SDK in minutes. Build your first iQube-powered application.',
    thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'developer', position: 1 },
    status: 'published',
    tags: ['developer', 'sdk', 'quickstart'],
    modalities: {
      read: {
        text: '# QIRI SDK Quick Start\n\nThe QIRI SDK provides a simple interface for building iQube-powered applications.\n\n## Installation\n\n```bash\nnpm install @qriptopian/sdk\n```\n\n## Basic Usage\n\n```javascript\nimport { QIRI } from \'@qriptopian/sdk\';\n\nconst qiri = new QIRI({\n  network: \'mainnet\',\n  apiKey: process.env.QIRI_KEY\n});\n\n// Create a transaction\nconst tx = await qiri.send({\n  to: \'did:qiri:recipient\',\n  amount: 100,\n  memo: \'Payment for services\'\n});\n```',
        duration: '5 min read'
      },
      link: {
        url: 'https://docs.qripto.net/sdk/quickstart',
        allow_embed: false
      }
    }
  },
  {
    title: 'Building with iQubes',
    slug: 'building-with-iqubes',
    excerpt: 'Learn how to create, manage, and interact with iQubes in your applications.',

    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'developer', position: 2 },
    status: 'published',
    tags: ['developer', 'iqubes', 'tutorial'],
    modalities: {
      read: {
        duration: '8 min read'
      }
    }
  },
  {
    title: 'Cross-Chain Integration',
    slug: 'cross-chain-integration',
    excerpt: 'Connect your application to multiple blockchains using the QIRI protocol.',

    thumbnail: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'developer', position: 3 },
    status: 'published',
    tags: ['developer', 'cross-chain', 'integration'],
    modalities: {
      read: {
        text: '# Cross-Chain Integration\n\nQIRI enables seamless cross-chain operations.\n\n## Supported Chains\n\n- Ethereum\n- Polygon\n- Arbitrum\n- Optimism\n- Base\n- Internet Computer\n- Bitcoin (via PSBT)\n\n## Example: Cross-Chain Transfer\n\n```javascript\nconst transfer = await qiri.crossChainTransfer({\n  from: { chain: \'ethereum\', address: \'0x...\' },\n  to: { chain: \'polygon\', address: \'0x...\' },\n  amount: 1000\n});\n```',
        duration: '10 min read'
      }
    }
  },
  {
    title: 'Aigent Integration Guide',
    slug: 'aigent-integration-guide',
    excerpt: 'Integrate AI agents into your application for autonomous operations.',

    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'developer', position: 4 },
    status: 'published',
    tags: ['developer', 'aigents', 'ai'],
    modalities: {
      read: {
        text: '# Aigent Integration Guide\n\nAigents are autonomous AI agents that can execute transactions on behalf of users.\n\n## Creating an Aigent\n\n```javascript\nconst aigent = await qiri.createAigent({\n  name: \'MyAigent\',\n  capabilities: [\'send\', \'receive\', \'swap\'],\n  budget: 1000 // Q¢\n});\n```\n\n## Aigent Operations\n\nAigents can:\n- Monitor balances\n- Execute trades\n- Manage portfolios\n- Process payments',
        duration: '12 min read'
      }
    }
  },
  {
    title: 'API Reference & Examples',
    slug: 'api-reference-examples',
    excerpt: 'Complete API documentation with code examples and best practices.',

    thumbnail: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'developer', position: 5 },
    status: 'published',
    tags: ['developer', 'api', 'reference'],
    modalities: {
      read: {
        text: '# API Reference\n\n## Core Methods\n\n### qiri.send()\nSend Q¢ or iQubes to another address.\n\n### qiri.receive()\nReceive and process incoming transfers.\n\n### qiri.balance()\nCheck account balance across chains.\n\n### qiri.swap()\nExchange between different tokens.\n\n## Best Practices\n\n1. Always validate addresses\n2. Use error handling\n3. Implement retry logic\n4. Monitor gas fees',
        duration: '15 min read'
      },
      link: {
        url: 'https://docs.qripto.net/api',
        allow_embed: false
      }
    }
  }
];

// Kn0wdZ Executive Tab Content
const executiveContent = [
  {
    title: 'Strategic Impact Framework',
    slug: 'strategic-impact-framework',
    excerpt: 'Measure and report the real-world impact of iQube infrastructure deployment.',

    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'executive', position: 1 },
    status: 'published',
    tags: ['executive', 'strategy', 'impact'],
    modalities: {
      read: {
        text: '# Strategic Impact Framework\n\n## Measuring Success\n\nTrack key metrics:\n- Transaction volume\n- User adoption\n- Cross-chain activity\n- Cost savings\n\n## Reporting Structure\n\n1. Executive Summary\n2. Key Performance Indicators\n3. Growth Metrics\n4. Strategic Recommendations',
        duration: '8 min read'
      }
    }
  },
  {
    title: 'Enterprise Integration Playbook',
    slug: 'enterprise-integration-playbook',
    excerpt: 'Step-by-step guide for integrating iQube infrastructure into enterprise systems.',

    thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'executive', position: 2 },
    status: 'published',
    tags: ['executive', 'enterprise', 'integration'],
    modalities: {
      read: {
        text: '# Enterprise Integration Playbook\n\n## Phase 1: Assessment\n- Current infrastructure audit\n- Requirements gathering\n- ROI analysis\n\n## Phase 2: Implementation\n- Pilot program\n- Integration testing\n- Staff training\n\n## Phase 3: Scale\n- Full deployment\n- Performance monitoring\n- Continuous optimization',
        duration: '10 min read'
      }
    }
  },
  {
    title: 'Revenue Models & Business Cases',
    slug: 'revenue-models-business-cases',
    excerpt: 'Explore sustainable revenue models and build compelling business cases.',

    thumbnail: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'executive', position: 3 },
    status: 'published',
    tags: ['executive', 'revenue', 'business'],
    modalities: {
      read: {
        text: '# Revenue Models & Business Cases\n\n## Revenue Streams\n\n1. **Transaction Fees**: Micro-fees on Q¢ transfers\n2. **Enterprise Licensing**: SaaS model for businesses\n3. **Premium Features**: Advanced analytics and tools\n4. **Partnership Revenue**: Integration partnerships\n\n## Building the Business Case\n\n- Cost reduction analysis\n- Efficiency gains\n- New revenue opportunities\n- Competitive advantages',
        duration: '12 min read'
      }
    }
  },
  {
    title: 'Operational Scaling Strategy',
    slug: 'operational-scaling-strategy',
    excerpt: 'Scale operations efficiently while maintaining quality and performance.',

    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'executive', position: 4 },
    status: 'published',
    tags: ['executive', 'operations', 'scaling'],
    modalities: {
      read: {
        text: '# Operational Scaling Strategy\n\n## Infrastructure Scaling\n\n- Horizontal scaling for high availability\n- Load balancing across chains\n- Automated failover systems\n\n## Team Scaling\n\n- Hiring roadmap\n- Training programs\n- Knowledge management\n\n## Process Optimization\n\n- Automation opportunities\n- Workflow improvements\n- Quality assurance',
        duration: '10 min read'
      }
    }
  },
  {
    title: 'Market Positioning & Ecosystem Growth',
    slug: 'market-positioning-ecosystem-growth',
    excerpt: 'Position your organization for success in the evolving Web3 ecosystem.',

    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'executive', position: 5 },
    status: 'published',
    tags: ['executive', 'market', 'growth'],
    modalities: {
      read: {
        text: '# Market Positioning & Ecosystem Growth\n\n## Competitive Analysis\n\n- Market landscape\n- Key differentiators\n- Competitive advantages\n\n## Partnership Strategy\n\n- Strategic alliances\n- Integration partners\n- Ecosystem development\n\n## Growth Metrics\n\n- Market share\n- User acquisition\n- Revenue growth\n- Network effects',
        duration: '15 min read'
      }
    }
  },
  {
    title: 'Risk Management & Compliance',
    slug: 'risk-management-compliance',
    excerpt: 'Navigate regulatory requirements and manage operational risks effectively.',

    thumbnail: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'executive', position: 6 },
    status: 'published',
    tags: ['executive', 'risk', 'compliance'],
    modalities: {
      read: {
        text: '# Risk Management & Compliance\n\n## Regulatory Landscape\n\n- Current regulations\n- Compliance requirements\n- Future outlook\n\n## Risk Mitigation\n\n- Security protocols\n- Audit procedures\n- Insurance coverage\n\n## Best Practices\n\n- Regular compliance reviews\n- Documentation standards\n- Incident response plans',
        duration: '12 min read'
      }
    }
  },
  {
    title: 'Executive Dashboard & Analytics',
    slug: 'executive-dashboard-analytics',
    excerpt: 'Real-time insights and analytics for data-driven decision making.',

    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
    placement: { section: '21knowdz', tab: 'executive', position: 7 },
    status: 'published',
    tags: ['executive', 'analytics', 'dashboard'],
    modalities: {
      read: {
        text: '# Executive Dashboard & Analytics\n\n## Key Metrics\n\n- Transaction volume\n- Active users\n- Revenue trends\n- Cost efficiency\n\n## Analytics Tools\n\n- Real-time monitoring\n- Predictive analytics\n- Custom reports\n- Data visualization\n\n## Decision Support\n\n- Scenario modeling\n- Trend analysis\n- Performance benchmarks',
        duration: '8 min read'
      }
    }
  }
];

async function importContent() {
  console.log('Starting content import...\n');

  // Safety check: Check existing content first
  console.log('Checking for existing content...');
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

  let devImported = 0;
  let devSkipped = 0;
  let execImported = 0;
  let execSkipped = 0;

  // Import Developer content
  console.log('Importing Developer tab content...');
  for (const item of developerContent) {
    // Check if title already exists
    const exists = existingDev?.some(e => e.title === item.title);
    if (exists) {
      console.log(`⊘ Skipped (already exists): ${item.title}`);
      devSkipped++;
      continue;
    }

    const { data, error } = await supabase
      .from('content')
      .insert(item)
      .select();

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
    // Check if title already exists
    const exists = existingExec?.some(e => e.title === item.title);
    if (exists) {
      console.log(`⊘ Skipped (already exists): ${item.title}`);
      execSkipped++;
      continue;
    }

    const { data, error } = await supabase
      .from('content')
      .insert(item)
      .select();

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
