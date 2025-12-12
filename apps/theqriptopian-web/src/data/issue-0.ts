/**
 * The Qriptopian - Issue #0: The Genesis Issue
 * PUBLISHED VERSION (v1.0) - Aligned with deployed application
 * 
 * iQube Protocol compliant CodexQube
 * ACTIVE DOMAINS: PennyDrops, Scrolls, Kn0wdZ
 * HIDDEN DOMAINS: Signals (exists but filtered from nav)
 * EXCLUDED: StayBull (reserved for MoneyPenny franchise)
 * 
 * Implements contentQube and AigentQube primitives
 * Integrates with RQH, CRM, x402, DVN platform services
 */

import type { CodexQube } from '@agentiq/codex';

export const issue0: CodexQube = {
  qubeId: 'qube://theqriptopian/codex/issue-0',
  qubeType: 'codexQube',
  protocolVersion: '0.1.0',
  createdAt: '2025-12-01T00:00:00Z',
  updatedAt: '2025-12-07T16:00:00Z',
  
  codexId: 'theqriptopian-issue-0',
  franchiseId: 'theqriptopian',
  issueNumber: 0,
  title: 'The Genesis Issue',
  description: 'Stories from the Quantum-Ready Internet',
  publishedAt: '2025-12-01T00:00:00Z',
  status: 'published',
  version: '0.1',
  
  tags: ['genesis', 'qriptocent', 'scrolls', 'knowledge', 'aigentiq'],
  
  editorial: {
    editor: 'The Qriptopian Editorial Team',
    theme: 'Q¢ use cases, Chronicles, and Knowledge',
    notes: 'Our inaugural issue features practical Q¢ stories, Chronicles from the Quantum-Ready Internet, and knowledge resources for devs, creatives, and execs.',
  },
  
  domains: [
    // Signals Domain
    {
      qubeId: 'qube://theqriptopian/domain/signals',
      qubeType: 'domainQube',
      protocolVersion: '1.0.0',
      createdAt: '2025-12-01T00:00:00Z',
      updatedAt: '2025-12-07T13:40:00Z',
      
      domainId: 'signals',
      title: 'Signals',
      description: 'What\'s happening now - Real-time market signals and live analysis',
      icon: 'Zap',
      color: 'cyan',
      
      articles: [
        {
          qubeId: 'qube://theqriptopian/article/signals-qc-hft-update',
          qubeType: 'articleQube',
          protocolVersion: '1.0.0',
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-01T00:00:00Z',
          
          title: 'Real-Time Market Signals: Q¢ HFT Update',
          slug: 'qc-hft-market-signals',
          description: 'Q¢ Market Intelligence - Real-time insights across all major protocols',
          content: 'Live analysis of high-frequency trading patterns in the Q¢ token ecosystem...',
          
          author: {
            name: 'Signal Analytics Team',
            role: 'Market Intelligence',
          },
          
          image: {
            url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&h=800&fit=crop',
            alt: 'Market Overview',
          },
          
          publishedAt: '2025-12-01T08:00:00Z',
          tags: ['signals', 'hft', 'qc', 'live', 'trading'],
          readingTime: 3,
          status: 'published',
          
          metadata: {
            badge: 'LIVE',
            isLive: true,
          },
          
          aigentMetadata: {
            recommendedAgents: ['nakamoto', 'moneypenny'],
            contextHints: ['market signals', 'hft', 'real-time data'],
            intents: ['monitor', 'analyze', 'trade'],
          },
        },
        {
          qubeId: 'qube://theqriptopian/article/signals-cross-chain-surge',
          qubeType: 'articleQube',
          protocolVersion: '1.0.0',
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-01T00:00:00Z',
          
          title: 'Cross-Chain Activity Surge Detected',
          slug: 'cross-chain-activity-surge',
          description: 'Multi-chain analytics reveal unprecedented cross-chain transaction volumes',
          content: 'Cross-chain bridge activity has reached all-time highs...',
          
          author: {
            name: 'Signal Analytics Team',
            role: 'Market Intelligence',
          },
          
          image: {
            url: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=1200&h=800&fit=crop',
            alt: 'Cross-Chain Activity',
          },
          
          publishedAt: '2025-12-01T09:00:00Z',
          tags: ['signals', 'cross-chain', 'bridges', 'hot'],
          readingTime: 4,
          status: 'published',
          
          metadata: {
            badge: 'HOT',
          },
          
          aigentMetadata: {
            recommendedAgents: ['nakamoto'],
            contextHints: ['cross-chain', 'bridges', 'interoperability'],
            intents: ['monitor', 'analyze'],
          },
        },
        {
          qubeId: 'qube://theqriptopian/article/signals-defi-governance',
          qubeType: 'articleQube',
          protocolVersion: '1.0.0',
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-01T00:00:00Z',
          
          title: 'DeFi Protocol Governance Changes',
          slug: 'defi-governance-changes',
          description: 'Track governance changes across major DeFi protocols',
          content: 'Several major DeFi protocols have proposed significant governance updates...',
          
          author: {
            name: 'Signal Analytics Team',
            role: 'Market Intelligence',
          },
          
          image: {
            url: 'https://images.unsplash.com/photo-1642790551116-18e150f248e4?w=1200&h=800&fit=crop',
            alt: 'DeFi Governance',
          },
          
          publishedAt: '2025-12-01T10:00:00Z',
          tags: ['signals', 'defi', 'governance', 'new'],
          readingTime: 5,
          status: 'published',
          
          metadata: {
            badge: 'NEW',
          },
          
          aigentMetadata: {
            recommendedAgents: ['nakamoto'],
            contextHints: ['governance', 'defi', 'voting'],
            intents: ['participate', 'analyze'],
          },
        },
      ],
      
      config: {
        layout: 'grid',
        itemsPerPage: 6,
      },
    },
    
    // Mythos Domain
    {
      qubeId: 'qube://theqriptopian/domain/mythos',
      qubeType: 'domainQube',
      protocolVersion: '1.0.0',
      createdAt: '2025-12-01T00:00:00Z',
      updatedAt: '2025-12-07T13:40:00Z',
      
      domainId: 'mythos',
      title: 'Mythos',
      description: 'Deep narratives exploring the cultural and philosophical dimensions of technology',
      icon: 'BookOpen',
      color: 'purple',
      
      articles: [
        {
          qubeId: 'qube://theqriptopian/article/mythos-awakening',
          qubeType: 'articleQube',
          protocolVersion: '1.0.0',
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-01T00:00:00Z',
          
          title: 'Mythos: The Awakening',
          slug: 'mythos-awakening-chapter-1',
          description: 'Chapter 1 - The quantum realm opens, and the first agents emerge',
          content: 'In the beginning, there was data. Unstructured, chaotic, infinite...',
          
          author: {
            name: 'The Chronicler',
            role: 'Narrative Architect',
          },
          
          image: {
            url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop',
            alt: 'The Awakening',
          },
          
          publishedAt: '2025-12-01T00:00:00Z',
          tags: ['mythos', 'comic', 'story', 'quantum', 'agents'],
          readingTime: 12,
          status: 'published',
          
          metadata: {
            badge: 'COMIC',
            format: 'visual-narrative',
          },
          
          aigentMetadata: {
            recommendedAgents: ['know1'],
            contextHints: ['narrative', 'origin story', 'mythology'],
            intents: ['explore', 'immerse', 'reflect'],
          },
        },
        {
          qubeId: 'qube://theqriptopian/article/mythos-quantum-chronicles',
          qubeType: 'articleQube',
          protocolVersion: '1.0.0',
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-01T00:00:00Z',
          
          title: 'Chronicles of the Quantum Realm',
          slug: 'quantum-realm-chronicles',
          description: 'Tales from the digital frontier where data becomes legend',
          content: 'Long before the first blockchain was minted, stories were told...',
          
          author: {
            name: 'The Chronicler',
            role: 'Narrative Architect',
          },
          
          image: {
            url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&h=300&fit=crop',
            alt: 'Quantum Chronicles',
          },
          
          publishedAt: '2025-12-01T00:00:00Z',
          tags: ['mythos', 'story', 'quantum', 'legend'],
          readingTime: 15,
          status: 'published',
          
          metadata: {
            badge: 'STORY',
            format: 'long-form',
          },
          
          aigentMetadata: {
            recommendedAgents: ['know1', 'nakamoto'],
            contextHints: ['narrative', 'history', 'quantum computing'],
            intents: ['explore', 'learn', 'reflect'],
          },
        },
      ],
      
      config: {
        layout: 'list',
        itemsPerPage: 4,
      },
    },
    
    // Markets Domain
    {
      qubeId: 'qube://theqriptopian/domain/markets',
      qubeType: 'domainQube',
      protocolVersion: '1.0.0',
      createdAt: '2025-12-01T00:00:00Z',
      updatedAt: '2025-12-07T13:40:00Z',
      
      domainId: 'markets',
      title: 'Markets',
      description: 'Financial analysis and market dynamics in the decentralized economy',
      icon: 'DollarSign',
      color: 'green',
      
      articles: [
        {
          qubeId: 'qube://theqriptopian/article/markets-watch',
          qubeType: 'articleQube',
          protocolVersion: '1.0.0',
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-01T00:00:00Z',
          
          title: 'Markets Watch',
          slug: 'markets-watch',
          description: 'Tracking trends in crypto, quantum tech, and emerging markets',
          content: 'This week\'s market overview shows significant movement in quantum-related tokens...',
          
          author: {
            name: 'Market Analysis Team',
            role: 'Financial Analysts',
          },
          
          image: {
            url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=300&fit=crop',
            alt: 'Markets Watch',
          },
          
          publishedAt: '2025-12-01T06:00:00Z',
          tags: ['markets', 'analysis', 'crypto', 'trends'],
          readingTime: 8,
          status: 'published',
          
          aigentMetadata: {
            recommendedAgents: ['moneypenny', 'nakamoto'],
            contextHints: ['markets', 'trends', 'analysis'],
            intents: ['monitor', 'invest', 'analyze'],
          },
        },
        {
          qubeId: 'qube://theqriptopian/article/markets-quantum-trading',
          qubeType: 'articleQube',
          protocolVersion: '1.0.0',
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-01T00:00:00Z',
          
          title: 'Quantum Trading Algorithms',
          slug: 'quantum-trading-algorithms',
          description: 'Advanced strategies using quantum computing for market predictions',
          content: 'Quantum computing is revolutionizing algorithmic trading strategies...',
          
          author: {
            name: 'Quantum Trading Research',
            role: 'Algorithm Specialists',
          },
          
          image: {
            url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
            alt: 'Quantum Trading',
          },
          
          publishedAt: '2025-12-01T07:00:00Z',
          tags: ['markets', 'quantum', 'algorithms', 'premium', 'trading'],
          readingTime: 20,
          status: 'published',
          
          metadata: {
            isPremium: true,
            unlockPrice: 100,
            unlockCurrency: 'QCT',
          },
          
          aigentMetadata: {
            recommendedAgents: ['moneypenny'],
            contextHints: ['quantum trading', 'algorithms', 'advanced strategies'],
            intents: ['learn', 'implement', 'optimize'],
          },
        },
      ],
      
      config: {
        layout: 'grid',
        itemsPerPage: 6,
      },
    },
    
    // City Domain
    {
      qubeId: 'qube://theqriptopian/domain/city',
      qubeType: 'domainQube',
      protocolVersion: '1.0.0',
      createdAt: '2025-12-01T00:00:00Z',
      updatedAt: '2025-12-07T13:40:00Z',
      
      domainId: 'city',
      title: 'City',
      description: 'Updates and stories from quantum-ready urban centers',
      icon: 'Building2',
      color: 'yellow',
      
      articles: [
        {
          qubeId: 'qube://theqriptopian/article/city-dispatches',
          qubeType: 'articleQube',
          protocolVersion: '1.0.0',
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-01T00:00:00Z',
          
          title: 'City Dispatches',
          slug: 'city-dispatches',
          description: 'Updates and stories from quantum-ready urban centers',
          content: 'As quantum infrastructure rolls out across major cities...',
          
          author: {
            name: 'City Correspondents',
            role: 'Urban Reporters',
          },
          
          image: {
            url: 'https://images.unsplash.com/photo-1622186477895-f2af6a0f5a97?w=400&h=300&fit=crop',
            alt: 'City Dispatches',
          },
          
          publishedAt: '2025-12-01T00:00:00Z',
          tags: ['city', 'urban', 'infrastructure', 'community'],
          readingTime: 10,
          status: 'published',
          
          aigentMetadata: {
            recommendedAgents: ['know1'],
            contextHints: ['urban development', 'infrastructure', 'community'],
            intents: ['explore', 'participate', 'learn'],
          },
        },
      ],
      
      config: {
        layout: 'grid',
        itemsPerPage: 4,
      },
    },
  ],
  
  metadata: {
    totalArticles: 9,
    totalDomains: 4,
    contributors: 5,
    version: '1.0.0',
    iQubeCompliant: true,
    agentiqEnabled: true,
    metavatarCompatible: true,
  },
};
