import React, { useState, useEffect } from "react";
import { X, Loader2, Info, ChevronRight, ChevronLeft, PlusCircle, Lock } from "lucide-react";

import {
  fetchTemplateData, 
  fetchBlakQubeData, 
  connectToApi, 
  decryptData, 
  mintIQube, 
  activateIQube, 
  MetaQubeItem, 
  BlakQubeData 
} from "../services/iQubeService";

// Core data structures based on iQube Protocol specifications

// Business model types
type BusinessModelType = 'Buy' | 'Sell' | 'Rent' | 'Lease' | 'Subscribe' | 'Stake' | 'License' | 'Donate';

// iQube types
type IQubeType = 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AgentQube';

// Owner types
type OwnerType = 'Individual' | 'Organisation';

// Identifiability levels
type IdentifiabilityLevel = 'Anonymous' | 'Semi-Anonymous' | 'Semi-Identifiable' | 'Identifiable';

// Duration of rights
type DurationOfRights = 'Forever' | 'Per Use' | 'Per Minute' | 'Per Hour' | 'Per Day' | 'Per Week' | 'Per Month' | 'Per Year';

// Price target
type PriceTo = 'Use' | 'Mint' | 'Purchase' | 'Sell' | 'Lease' | 'Rent' | 'Stake' | 'License' | 'Donate';

// Encryption status
type EncryptionStatus = 'pending' | 'minted' | 'decrypted';

// iQube instance type
type IQubeInstanceType = 'template' | 'instance';

// BlakQube schema type
type BlakQubeSchemaType = 'Structured' | 'Unstructured' | 'Access Keys';

// Data source type
type DataSource = 'manual' | 'api' | 'csv' | 'database' | 'realtime' | 'wallet' | 'social' | 'verified' | 'self-declared' | 'linked' | 'system';

interface MetaQubeData {
  key: string;
  value: string;
  source: string;
  score: number; // Score from 1-10 for full scoring system
  scoreType: 'sensitivity' | 'verifiability' | 'accuracy' | 'risk' | 'trust' | 'reliability' | 'general';
  description: string; // Description for tooltip
}

interface BlakQubeItem {
  id: string;
  key: string;
  value: string;
  description: string;
  templateValue?: string;
  instanceValue?: string;
  source?: string;
  sourceType?: 'manual' | 'api' | 'csv' | 'database' | 'realtime' | 'wallet' | 'social';
  category: string;
  sourceUrl?: string;
  lastUpdated: string;
  isVerified: boolean;
  confidenceLevel: number; // 1-10 scale
}

interface TokenQubeData {
  keyId: string;
  accessType: 'decrypt' | 'use' | 'transfer' | 'view';
  keyStatus: 'active' | 'inactive' | 'pending';
  keyHolder?: string;
  expiresAt?: string;
  usageCount?: number;
  maxUsage?: number;
}

interface SubmenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  iQubeId: string;
  drawerType?: 'view' | 'decrypt' | 'mint' | 'activate' | 'use' | 'edit';
}

export const SubmenuDrawer = ({
  isOpen,
  onClose,
  iQubeId,
  drawerType
}: SubmenuDrawerProps) => {
  // Original state - keeping for backward compatibility
  const [metaQubeData, setMetaQubeData] = useState<MetaQubeItem[]>([]);
  const [blakQubeData, setBlakQubeData] = useState<BlakQubeData | Record<string, string>>({});
  const [decryptedData, setDecryptedData] = useState<Record<string, string> | null>(null);
  const [isTemplate, setIsTemplate] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [isUseMode, setIsUseMode] = useState(false);
  const [instanceNumber, setInstanceNumber] = useState<string>("AA001");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add state for editable iQubeId
  const [editableIQubeId, setIQubeId] = useState<string>("");
  
  // Enhanced state for redesigned drawer with protocol alignment
  const [formattedMetaQubeData, setFormattedMetaQubeData] = useState<MetaQubeData[]>([]);
  const [formattedBlakQubeData, setFormattedBlakQubeData] = useState<BlakQubeItem[]>([]);
  const [tokenQubeData, setTokenQubeData] = useState<TokenQubeData[]>([]);
  const [iQubeType, setIQubeType] = useState<IQubeType>('DataQube');
  const [businessModel, setBusinessModel] = useState<BusinessModelType>('Buy');
  const [price, setPrice] = useState<number>(100); // Price in Sats
  const [ownerType, setOwnerType] = useState<OwnerType>('Individual');
  const [identifiabilityLevel, setIdentifiabilityLevel] = useState<IdentifiabilityLevel>('Anonymous');
  const [compositeScores, setCompositeScores] = useState({
    trustScore: 0,
    reliabilityIndex: 0,
    sensitivityScore: 0,
    verifiabilityScore: 0,
    accuracyScore: 0,
    riskScore: 0
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMetaEditMode, setIsMetaEditMode] = useState(false);
  const [isEditingMetaQube, setIsEditingMetaQube] = useState(false);
  const [isBlakEditMode, setIsBlakEditMode] = useState(false);
  const [newMetaRecord, setNewMetaRecord] = useState<Partial<MetaQubeData>>({
    key: '',
    value: '',
    source: '',
    score: 5,
    scoreType: 'general',
    description: ''
  });
  const [newBlakRecord, setNewBlakRecord] = useState({
    key: '',
    templateValue: '',
    instanceValue: '',
    source: 'manual',
    description: ''
  });
  const [activeTab, setActiveTab] = useState<"view" | "decrypt" | "mint" | "activate" | "use" | "edit">("view");
  
  // BlakQube data type definition
  type BlakQubeField = {
    key: string;
    templateValue: string;
    instanceValue: string;
    source: DataSource;
    description: string;
  };

  // Sample BlakQube data for Qrypto Profile
  const [blakQubeProfileData, setBlakQubeProfileData] = useState<BlakQubeField[]>([
    {
      key: 'First-Name',
      templateValue: '',
      instanceValue: 'Alex',
      source: 'verified',
      description: 'User\'s first name, verified through KYC process'
    },
    {
      key: 'Last-Name',
      templateValue: '',
      instanceValue: 'Morgan',
      source: 'verified',
      description: 'User\'s last name, verified through KYC process'
    },
    {
      key: '@Qrypto ID',
      templateValue: '',
      instanceValue: '@alexmorgan',
      source: 'verified',
      description: 'Unique identifier in the Qrypto ecosystem'
    },
    {
      key: 'Profession',
      templateValue: '',
      instanceValue: 'Software Engineer',
      source: 'self-declared',
      description: 'User\'s primary professional occupation'
    },
    {
      key: 'Local-City',
      templateValue: '',
      instanceValue: 'San Francisco',
      source: 'self-declared',
      description: 'User\'s current city of residence'
    },
    {
      key: 'Email',
      templateValue: '',
      instanceValue: 'alex.morgan@example.com',
      source: 'verified',
      description: 'Primary email address, verified through confirmation'
    },
    {
      key: 'EVM Public Key',
      templateValue: '',
      instanceValue: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      source: 'verified',
      description: 'Ethereum Virtual Machine compatible public key'
    },
    {
      key: 'BTC-Public-Key',
      templateValue: '',
      instanceValue: 'bc1q9h6mqkm247xept28g3m4wj92tpgxp84x7hfvkz',
      source: 'verified',
      description: 'Bitcoin public key associated with the user'
    },
    {
      key: 'ThirdWeb Public Key',
      templateValue: '',
      instanceValue: 'thirdweb.eth',
      source: 'verified',
      description: 'ThirdWeb compatible public key or ENS name'
    },
    {
      key: 'LinkedIn ID',
      templateValue: '',
      instanceValue: 'alex-morgan-sf',
      source: 'linked',
      description: 'LinkedIn profile unique identifier'
    },
    {
      key: 'LinkedIn-Profile-URL',
      templateValue: '',
      instanceValue: 'https://linkedin.com/in/alex-morgan-sf',
      source: 'linked',
      description: 'Full URL to LinkedIn profile'
    },
    {
      key: 'Twitter-Handle',
      templateValue: '',
      instanceValue: '@alexmorgantech',
      source: 'linked',
      description: 'Twitter/X username including @ symbol'
    },
    {
      key: 'Telegram-Handle',
      templateValue: '',
      instanceValue: '@alexmorgan',
      source: 'linked',
      description: 'Telegram username'
    },
    {
      key: 'Discord-Handle',
      templateValue: '',
      instanceValue: 'alexmorgan#4291',
      source: 'linked',
      description: 'Discord username including discriminator'
    },
    {
      key: 'Instagram-Handle',
      templateValue: '',
      instanceValue: '@alexm_tech',
      source: 'linked',
      description: 'Instagram username'
    },
    {
      key: 'Luma-ID',
      templateValue: '',
      instanceValue: 'alexmorgan',
      source: 'linked',
      description: 'Luma platform identifier'
    },
    {
      key: 'YouTube ID',
      templateValue: '',
      instanceValue: '@AlexMorganTech',
      source: 'linked',
      description: 'YouTube channel identifier'
    },
    {
      key: 'Facebook ID',
      templateValue: '',
      instanceValue: 'alex.morgan.tech',
      source: 'linked',
      description: 'Facebook profile username'
    },
    {
      key: 'Tik Tok Handle',
      templateValue: '',
      instanceValue: '@alexm_tech',
      source: 'linked',
      description: 'TikTok username'
    },
    {
      key: 'Web3 Interests',
      templateValue: '',
      instanceValue: 'DeFi, NFTs, DAOs, Smart Contracts',
      source: 'self-declared',
      description: 'Web3 topics of interest to the user'
    },
    {
      key: 'Tokens-of-Interest',
      templateValue: '',
      instanceValue: 'ETH, BTC, SOL, AVAX, LINK',
      source: 'self-declared',
      description: 'Cryptocurrency tokens the user is interested in'
    },
    {
      key: 'Associated Public Keys',
      templateValue: '',
      instanceValue: '0x3a2t...7y2z, bc1q...4f2g',
      source: 'linked',
      description: 'Additional public keys associated with the user'
    },
  ]);
  
  // Using the existing blakQubeProfileData state variable defined above

  // Example iQubes for demonstration
  const [exampleIQubes, setExampleIQubes] = useState<{
    id: string;
    name: string;
    type: IQubeType;
    businessModel: BusinessModelType;
    ownerType: OwnerType;
    identifiability: IdentifiabilityLevel;
    description: string;
    metaQubeData: MetaQubeData[];
  }[]>([
    {
      id: "data-template-001",
      name: "Personal Health Records",
      type: "DataQube",
      businessModel: "Subscribe",
      ownerType: "Individual",
      identifiability: "Semi-Identifiable",
      description: "A DataQube template for storing personal health records with privacy controls",
      metaQubeData: [
        { key: "data_source", value: "Health API", source: "api", score: 8, scoreType: "verifiability", description: "Source of the health data" },
        { key: "privacy_level", value: "High", source: "manual", score: 9, scoreType: "sensitivity", description: "Level of privacy protection" },
        { key: "update_frequency", value: "Daily", source: "manual", score: 7, scoreType: "accuracy", description: "How often data is updated" }
      ]
    },
    {
      id: "content-template-002",
      name: "Research Publication",
      type: "ContentQube",
      businessModel: "License",
      ownerType: "Organisation",
      identifiability: "Identifiable",
      description: "A ContentQube template for publishing academic research with attribution",
      metaQubeData: [
        { key: "author_count", value: "3", source: "manual", score: 10, scoreType: "verifiability", description: "Number of authors" },
        { key: "peer_reviewed", value: "Yes", source: "api", score: 9, scoreType: "accuracy", description: "Whether content is peer-reviewed" },
        { key: "citation_index", value: "High", source: "api", score: 8, scoreType: "general", description: "Publication citation index" }
      ]
    },
    {
      id: "model-template-003",
      name: "Financial Prediction Model",
      type: "ModelQube",
      businessModel: "Rent",
      ownerType: "Organisation",
      identifiability: "Anonymous",
      description: "A ModelQube template for financial prediction algorithms with usage tracking",
      metaQubeData: [
        { key: "accuracy_rate", value: "87%", source: "api", score: 8, scoreType: "accuracy", description: "Model prediction accuracy" },
        { key: "training_dataset", value: "Financial Markets 2023", source: "database", score: 7, scoreType: "verifiability", description: "Dataset used for training" },
        { key: "algorithm_type", value: "Deep Learning", source: "manual", score: 6, scoreType: "general", description: "Type of algorithm used" }
      ]
    },
    {
      id: "agent-template-004",
      name: "Customer Service Agent",
      type: "AgentQube",
      businessModel: "Subscribe",
      ownerType: "Organisation",
      identifiability: "Semi-Anonymous",
      description: "An AigentQube template for customer service automation with personalization",
      metaQubeData: [
        { key: "response_time", value: "1.2s", source: "api", score: 9, scoreType: "accuracy", description: "Average agent response time" },
        { key: "knowledge_base", value: "Product Documentation v3", source: "database", score: 8, scoreType: "verifiability", description: "Agent knowledge source" },
        { key: "personalization_level", value: "Medium", source: "manual", score: 6, scoreType: "sensitivity", description: "Level of response personalization" }
      ]
    },
    {
      id: "tool-template-005",
      name: "Data Analysis Toolkit",
      type: "ToolQube",
      businessModel: "Buy",
      ownerType: "Individual",
      identifiability: "Identifiable",
      description: "A ToolQube template for data analysis with various visualization components",
      metaQubeData: [
        { key: "supported_formats", value: "CSV, JSON, Excel", source: "manual", score: 7, scoreType: "general", description: "Data formats supported" },
        { key: "processing_capacity", value: "1GB", source: "api", score: 8, scoreType: "accuracy", description: "Maximum data size for processing" },
        { key: "visualization_types", value: "Charts, Maps, Networks", source: "manual", score: 9, scoreType: "verifiability", description: "Available visualization types" }
      ]
    }
  ]);
  
  // Currently selected example index
  const [currentExampleIndex, setCurrentExampleIndex] = useState<number>(0);
  
  // Helper function to convert Sats to USD (10 Sats = $0.01)
  const satsToUSD = (sats: number): string => {
    const usd = sats / 1000; // 10 sats = $0.01, so 1000 sats = $1
    return usd.toFixed(2);
  };

  // Helper function to format price display
  const formatPrice = (sats: number): string => {
    return `${sats} Sats ($${satsToUSD(sats)})`;
  };

  // Helper function to generate next instance number
  const generateNextInstanceNumber = () => {
    // For a real implementation, this would fetch the latest instance number from backend
    // For demo, we'll use a pattern like AA001, AA002, etc.
    
    // Check if we already have an instance number
    if (instanceNumber) {
      const prefix = instanceNumber.substring(0, 2);
      const num = parseInt(instanceNumber.substring(2));
      const nextNum = (num + 1).toString().padStart(3, '0');
      return `${prefix}${nextNum}`;
    }
    
    // Default first instance
    return 'AA001';
  };
  
  // Helper function to update BlakQube instance label
  const getInstanceLabel = () => {
    // This would be dynamic based on total instances created from this template
    // For demo, we'll hardcode the total as 21
    const totalInstances = 21;
    if (!instanceNumber) return '0 of 0';
    const currentInstance = parseInt(instanceNumber.substring(2));
    return `${currentInstance} of ${totalInstances}`;
  };
  
  // Helper function to get instance name with template name and unique ID
  const getInstanceName = () => {
    if (!iQubeId) return '';
    // Extract template name without "template" suffix
    const templateName = iQubeId.toLowerCase().includes('template') 
      ? iQubeId.replace(/template/i, '').trim() 
      : iQubeId;
    
    return `${templateName} ${instanceNumber}`;
  };
  
  // Helper to calculate version increment based on changes
  const calculateVersionIncrement = (originalData: any, newData: any) => {
    // Count the number of changes
    // For a major version change: new fields added or removed
    // For a minor version change: values updated
    const changes = {
      major: 0,
      minor: 0
    };
    
    // In a real implementation, this would do deep comparison
    // For demo, we'll just increment the minor version
    return {
      major: 0,
      minor: 1
    };
  };
  
  // Validation functions for form data
  const validateMintData = () => {
    const errors: string[] = [];
    
    // Subject Type is required in Use mode
    if (!ownerType) {
      errors.push('Subject Type is required');
    }
    
    // Check if at least one BlakQube field has been populated
    const hasBlakQubeData = formattedBlakQubeData.some(item => item.instanceValue);
    if (!hasBlakQubeData) {
      errors.push('At least one BlakQube field must be populated');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };
  
  const validateTemplateData = () => {
    const errors: string[] = [];
    
    // iQube ID is required
    if (!iQubeId) {
      errors.push('iQube ID is required');
    }
    
    // iQube Type is required
    if (!iQubeType) {
      errors.push('iQube Type is required');
    }
    
    // Business Model is required
    if (!businessModel) {
      errors.push('Business Model is required');
    }
    
    // Subject Type is required
    if (!ownerType) {
      errors.push('Subject Type is required');
    }
    
    // Identifiability is required
    if (!identifiabilityLevel) {
      errors.push('Identifiability is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  useEffect(() => {
    if (isOpen && iQubeId) {
      // Check if it's a template
      const isTemplateIQube = iQubeId.toLowerCase().includes('template');
      setIsTemplate(isTemplateIQube);
      
      // Determine iQube type based on ID pattern or other logic
      if (iQubeId.toLowerCase().includes('data')) {
        setIQubeType('DataQube');
      } else if (iQubeId.toLowerCase().includes('content')) {
        setIQubeType('ContentQube');
      } else if (iQubeId.toLowerCase().includes('tool')) {
        setIQubeType('ToolQube');
      } else if (iQubeId.toLowerCase().includes('model')) {
        setIQubeType('ModelQube');
      } else if (iQubeId.toLowerCase().includes('agent')) {
        setIQubeType('AgentQube');
      }
    }
  }, [isOpen, iQubeId]);
  
  // Function to calculate composite scores
  const calculateCompositeScores = (metaData: MetaQubeData[]) => {
    // Extract scores by type
    const sensitivity = metaData.find(item => item.scoreType === 'sensitivity')?.score || 5;
    const verifiability = metaData.find(item => item.scoreType === 'verifiability')?.score || 5;
    const accuracy = metaData.find(item => item.scoreType === 'accuracy')?.score || 5;
    const risk = metaData.find(item => item.scoreType === 'risk')?.score || 5;
    
    // Calculate composite scores according to protocol
    const trustScore = (accuracy + verifiability) / 2;
    const reliabilityIndex = (accuracy + verifiability + (10 - risk)) / 3;
    
    return {
      sensitivityScore: sensitivity,
      verifiabilityScore: verifiability,
      accuracyScore: accuracy,
      riskScore: risk,
      trustScore,
      reliabilityIndex
    };
  };

  // Get color based on score type and value according to iQube Protocol 1-10 scale
  const getScoreColor = (score: number, type: string) => {
    // For risk and sensitivity - green (low) to red (high)
    if (type === 'risk' || type === 'sensitivity') {
      if (score >= 1 && score <= 4) return 'bg-green-500'; // Low sensitivity/risk (good)
      if (score >= 5 && score <= 7) return 'bg-yellow-500'; // Medium sensitivity/risk (caution)
      return 'bg-red-500'; // High sensitivity/risk (concern)
    }
    
    // For accuracy and verifiability - red (low) to green (high)
    if (score >= 1 && score <= 3) return 'bg-red-500'; // Poor accuracy/verifiability (concern)
    if (score >= 4 && score <= 6) return 'bg-yellow-500'; // Moderate accuracy/verifiability (caution)
    return 'bg-green-500'; // High accuracy/verifiability (good)
  };

  // Function to generate token qube data
  const generateTokenQubeData = () => {
    // In a real application, this would fetch from an API
    return [
      {
        keyId: `key-${iQubeId.substring(0, 8)}`,
        accessType: 'decrypt' as const,
        keyStatus: 'active' as const,
        keyHolder: 'Current User',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        usageCount: 0,
        maxUsage: 10
      },
      {
        keyId: `key-${iQubeId.substring(0, 6)}-view`,
        accessType: 'view' as const,
        keyStatus: 'active' as const,
        keyHolder: 'Public',
        expiresAt: undefined,
        usageCount: 12,
        maxUsage: undefined
      }
    ];
  };
  // Helper function to determine source icon based on key name
  const determineSourceIcon = (key: string): string => {
    key = key.toLowerCase();
    if (key.includes('wallet') || key.includes('address') || key.includes('crypto')) return 'wallet';
    if (key.includes('twitter') || key.includes('facebook') || key.includes('instagram')) return 'social';
    if (key.includes('api') || key.includes('service')) return 'api';
    if (key.includes('email') || key.includes('contact')) return 'contact';
    if (key.includes('file') || key.includes('document')) return 'file';
    return 'data';
  };

  // Source icon component to display appropriate icon based on source type
  const SourceIcon = ({ source }: { source: string }) => {
    const iconType = determineSourceIcon(source);
    
    const getIcon = () => {
      switch (iconType) {
        case 'wallet':
          return (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <path d="m16 8 4-4-4-4" />
            </svg>
          );
        case 'social':
          return (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          );
        case 'api':
          return (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          );
        case 'contact':
          return (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          );
        case 'file':
          return (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          );
        default: // 'data'
          return (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="m21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          );
      }
    };

    return (
      <div className="text-yellow-500" title={`${source} Source`}>
        {getIcon()}
      </div>
    );
  };
  
  // Enhanced Score indicator component with 1-10 scale
  const EnhancedScoreIndicator = ({ 
    value, 
    maxValue = 5, 
    type, 
    size = 'medium'
  }: { 
    value: number; 
    maxValue?: number; 
    type: string; 
    size?: 'small' | 'medium' | 'large'
  }) => {
    // Ensure value is between 1 and maxValue
    const normalizedValue = Math.max(1, Math.min(maxValue, value));
  
    // Convert to 5-dot scale
    const dotCount = Math.ceil((normalizedValue / maxValue) * 5);
    
    return (
      <div className={`flex items-center gap-1 relative group ${size === 'small' ? 'scale-90' : size === 'large' ? 'scale-110' : ''}`}>
        {[...Array(5)].map((_, i) => {
          // Get appropriate color for each dot based on score type and position
          const dotColor = i < dotCount ? getScoreColor(normalizedValue, type) : 'bg-gray-600';
          return (
            <div key={`dot-${i}`} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (drawerType) {
      setActiveTab(drawerType);
    }
  }, [drawerType]);

  useEffect(() => {
    const fetchData = async () => {
      if (isOpen && iQubeId) {
        setLoading(true);
        setError(null);
        try {
          // Fetch metaqube data
          const meta = await fetchTemplateData(iQubeId);
          setMetaQubeData(meta);
          
          // Format meta data for display with enhanced scoring system
          const formattedMeta = meta.map((item, index) => {
            // Assign different score types to demonstrate the full scoring system
            const scoreTypes = ['sensitivity', 'verifiability', 'accuracy', 'risk', 'general'] as const;
            const scoreType = scoreTypes[index % scoreTypes.length];
            
            // Generate realistic scores (1-10) based on score type
            let score = Math.floor(Math.random() * 10) + 1;
            
            return {
              key: item.key,
              value: item.value,
              source: item.source || 'manual',
              score,
              scoreType,
              description: item.description || `${item.key} data field`
            };
          });
          
          setFormattedMetaQubeData(formattedMeta);
          
          // Calculate and set composite scores
          const scores = calculateCompositeScores(formattedMeta);
          setCompositeScores(scores);
          
          // Generate token qube data
          const tokenData = generateTokenQubeData();
          setTokenQubeData(tokenData);
          
          // If template, fetch blakqube data
          if (isTemplate) {
            let blak;
            try {
              blak = await fetchBlakQubeData(iQubeId as string);
              // Handle various possible return types
              if (typeof blak === 'string') {
                blak = { content: blak };
              }
              setBlakQubeData(blak);
            } catch (error) {
              console.error('Error fetching BlakQube data:', error);
              blak = {};
              setBlakQubeData({});
            }
            
            // Format blak data with enhanced properties
            const formattedBlak = Object.entries(blak || {}).map(([key, value], index) => ({
              id: `blak-${index}-${Date.now().toString(36)}`,
              key,
              value: typeof value === 'string' ? value : JSON.stringify(value),
              sourceType: ['api', 'database', 'manual', 'csv', 'wallet'][index % 5] as any,
              category: ['Primary', 'Secondary', 'Reference', 'System'][index % 4],
              description: `${key} data from source`,
              sourceUrl: key.includes('url') ? value as string : undefined,
              lastUpdated: new Date().toISOString(),
              isVerified: Math.random() > 0.5,
              confidenceLevel: Math.floor(Math.random() * 10) + 1
            }));
            
            setFormattedBlakQubeData(formattedBlak);
          }
          
          // Set business model based on ID or other logic (for demo purposes)
          const businessModels: BusinessModelType[] = ['Buy', 'Sell', 'Rent', 'Lease', 'Subscribe', 'Stake', 'License', 'Donate'];
          setBusinessModel(businessModels[Math.floor(Math.random() * businessModels.length)]);
          
        } catch (err) {
          console.error('Error fetching iQube data:', err);
          setError('Failed to load iQube data');
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchData();
  }, [isOpen, iQubeId, isTemplate]);
  // Function to handle API connection
  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await connectToApi(iQubeId as string);
      // Refresh data after connection
      const meta = await fetchTemplateData(iQubeId);
      setMetaQubeData(meta);
      
      // Update formatted meta data as well
      const formattedMeta = meta.map((item, index) => {
        const scoreTypes = ['sensitivity', 'verifiability', 'accuracy', 'risk', 'general'] as const;
        const scoreType = scoreTypes[index % scoreTypes.length];
        let score = Math.floor(Math.random() * 10) + 1;
        
        return {
          key: item.key,
          value: item.value,
          source: item.source || 'api', // Now it's from API
          score,
          scoreType,
          description: item.description || `${item.key} data field`
        };
      });
      
      setFormattedMetaQubeData(formattedMeta);
    } catch (err) {
      console.error('Error connecting to API:', err);
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle decryption
  const handleDecrypt = async () => {
    setDecryptLoading(true);
    setError(null);
    try {
      // First check if user owns the required token for decryption
      const hasDecryptToken = await checkTokenOwnership(iQubeId, 'decrypt');
      
      if (!hasDecryptToken) {
        setError('You do not own the required token to decrypt this iQube. Please acquire the token first.');
        return;
      }
      
      // Create a BlakQubeData object with the iQubeId
      const encryptedData: BlakQubeData = { id: iQubeId };
      const decrypted = await decryptData(encryptedData);
      setDecryptedData(decrypted as Record<string, string>);
      setIsDecrypted(true);
      
      // Update the BlakQube profile data with decrypted values
      if (decrypted) {
        const updatedProfileData = [...blakQubeProfileData];
        Object.entries(decrypted).forEach(([key, value]) => {
          const fieldIndex = updatedProfileData.findIndex(field => field.key === key);
          if (fieldIndex !== -1) {
            updatedProfileData[fieldIndex] = {
              ...updatedProfileData[fieldIndex],
              instanceValue: value
            };
          }
        });
        setBlakQubeProfileData(updatedProfileData);
      }
    } catch (err) {
      console.error('Error decrypting data:', err);
      setError('Failed to decrypt data');
    } finally {
      setDecryptLoading(false);
    }
  };
  
  // Function to check if user owns the required token
  const checkTokenOwnership = async (iQubeId: string, accessType: 'decrypt' | 'view' | 'transfer' | 'use'): Promise<boolean> => {
    // In a real implementation, this would check against a blockchain or token registry
    // For demo purposes, we'll simulate a check based on the tokenQubeData
    
    try {
      // Find a token with the required access type that is active
      const token = tokenQubeData.find(token => 
        token.accessType === accessType && 
        token.keyStatus === 'active'
      );
      
      if (!token) {
        return false;
      }
      
      // Check if token has usage limits and if they've been exceeded
      if (token.maxUsage !== undefined && token.usageCount !== undefined && token.usageCount >= token.maxUsage) {
        return false;
      }
      
      // Check if token has expired
      if (token.expiresAt) {
        const expiryDate = new Date(token.expiresAt);
        if (expiryDate < new Date()) {
          return false;
        }
      }
      
      // If we get here, the token is valid
      return true;
    } catch (error) {
      console.error('Error checking token ownership:', error);
      return false;
    }
  };
  
  // Function to handle minting of completed iQube instances
  const handleMint = async () => {
    setLoading(true);
    setError(null);
    
    // Validate the form data before minting
    const validation = validateMintData();
    if (!validation.isValid) {
      setError(`Please fix the following errors: ${validation.errors.join(', ')}`);
      setLoading(false);
      return;
    }
    
    try {
      // Generate a new instance number for this mint
      const newInstanceNumber = generateNextInstanceNumber();
      setInstanceNumber(newInstanceNumber);
      
      // Prepare data for minting - gather all the populated fields
      const metaQubePayload = formattedMetaQubeData
        .filter(item => item.value) // Only include items with values
        .map(item => ({
          key: item.key,
          value: item.value,
          source: item.source || 'manual'
        }));
      
      // Add instance identifier to payload
      metaQubePayload.push({
        key: 'instance',
        value: newInstanceNumber,
        source: 'system'
      });
      
      // Add instance label
      metaQubePayload.push({
        key: 'instanceLabel',
        value: getInstanceLabel(),
        source: 'system'
      });
      
      // Add provenance tracking
      metaQubePayload.push({
        key: 'provenance',
        value: '0', // Root template has provenance 0
        source: 'system'
      });
      
      // Gather BlakQube data
      const blakQubePayload = formattedBlakQubeData
        .filter(item => item.instanceValue) // Only include items with values
        .reduce((acc, item) => {
          acc[item.key] = item.instanceValue || '';
          return acc;
        }, {} as Record<string, string>);
      
      // Call the API to mint the iQube
      await mintIQube(iQubeId, metaQubePayload, blakQubePayload);
      
      // Show success message
      alert(`Successfully minted ${iQubeId} instance ${newInstanceNumber} (${getInstanceLabel()})`);
      
      // Close drawer or reset state
      onClose();
      // Show success message or redirect
      onClose(); // Close drawer after successful mint
    } catch (err) {
      console.error('Error minting iQube:', err);
      setError('Failed to mint iQube');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle activation
  const handleActivate = async (type: IQubeType) => {
    setLoading(true);
    setError(null);
    try {
      await activateIQube(iQubeId, type);
      setIQubeType(type);
      // Close after successful activation
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error(`Error activating iQube as ${type}:`, err);
      setError(`Failed to activate as ${type}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle saving template changes
  const handleSaveTemplate = async () => {
    setLoading(true);
    setError(null);
    
    // Validate template data before saving
    const validation = validateTemplateData();
    if (!validation.isValid) {
      setError(`Please fix the following errors: ${validation.errors.join(', ')}`);
      setLoading(false);
      return;
    }
    
    try {
      // Store original data for comparison to determine version changes
      const originalData = {
        metaQube: [...metaQubeData],
        blakQube: {...blakQubeData}
      };
      
      // Create updated template payload
      const templateData = {
        id: iQubeId,
        type: iQubeType,
        businessModel,
        ownerType,
        identifiability: identifiabilityLevel,
        // Add additional MetaQube fields
        metaQubeFields: formattedMetaQubeData.map(item => ({
          key: item.key,
          value: item.value,
          description: item.description,
          source: item.source || 'manual'
        })),
        // Add BlakQube template fields
        blakQubeFields: formattedBlakQubeData.map(item => ({
          key: item.key,
          templateValue: item.templateValue,
          description: item.description,
          source: item.source || 'manual'
        }))
      };
      
      // Calculate new version based on changes
      const currentVersion = '1.0'; // This would come from the actual template metadata
      const [major, minor] = currentVersion.split('.').map(Number);
      
      // Calculate version change using our helper function
      const versionChange = calculateVersionIncrement(originalData, templateData);
      const newVersion = `${major + versionChange.major}.${minor + versionChange.minor}`;
      
      // Add the version information to the template data
      const templateWithVersion = {
        ...templateData,
        version: newVersion,
        lastUpdated: new Date().toISOString(),
        updateDescription: versionChange.major > 0 ?
          `Major update with significant schema changes` :
          `Minor update with value changes and refinements`
      };
      
      // In a real implementation, this would call an API
      console.log(`Saving template ${iQubeId} with new version ${newVersion}`, templateWithVersion);
      
      // Show success message
      alert(`Template ${iQubeId} saved with new version ${newVersion}\n\n${templateWithVersion.updateDescription}`);
      
      // Close drawer
      onClose();
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  // Function to navigate between example iQubes
  const navigateExamples = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setCurrentExampleIndex(prev => 
        prev === exampleIQubes.length - 1 ? 0 : prev + 1
      );
    } else {
      setCurrentExampleIndex(prev => 
        prev === 0 ? exampleIQubes.length - 1 : prev - 1
      );
    }
  };
  
  // Get color scheme based on iQube type
  const getTypeColorScheme = (type: IQubeType) => {
    switch(type) {
      case 'DataQube':
        return {
          bg: 'from-blue-900/20 to-black/40',
          border: 'border-blue-500/20',
          text: 'text-blue-400',
          dot: 'bg-blue-400',
          button: 'bg-blue-600/30 hover:bg-blue-600/40 text-blue-300'
        };
      case 'ContentQube':
        return {
          bg: 'from-green-900/20 to-black/40',
          border: 'border-green-500/20',
          text: 'text-green-400',
          dot: 'bg-green-400',
          button: 'bg-green-600/30 hover:bg-green-600/40 text-green-300'
        };
      case 'ToolQube':
        return {
          bg: 'from-purple-900/20 to-black/40',
          border: 'border-purple-500/20',
          text: 'text-purple-400',
          dot: 'bg-purple-400',
          button: 'bg-purple-600/30 hover:bg-purple-600/40 text-purple-300'
        };
      case 'ModelQube':
        return {
          bg: 'from-amber-900/20 to-black/40',
          border: 'border-amber-500/20',
          text: 'text-amber-400',
          dot: 'bg-amber-400',
          button: 'bg-amber-600/30 hover:bg-amber-600/40 text-amber-300'
        };
      case 'AgentQube':
        return {
          bg: 'from-red-900/20 to-black/40',
          border: 'border-red-500/20',
          text: 'text-red-400',
          dot: 'bg-red-400',
          button: 'bg-red-600/30 hover:bg-red-600/40 text-red-300'
        };
      default:
        return {
          bg: 'from-gray-900/20 to-black/40',
          border: 'border-gray-500/20',
          text: 'text-gray-400',
          dot: 'bg-gray-400',
          button: 'bg-gray-600/30 hover:bg-gray-600/40 text-gray-300'
        };
    }
  };
  
  // Render appropriate tab content
  const renderContent = () => {
    const colors = getTypeColorScheme(iQubeType);
    
    switch (activeTab) {
      case "use":
        return (
          <div id="use-panel" role="tabpanel" aria-labelledby="use-tab">
            <div className="space-y-6">
              <div className="uppercase text-[11px] tracking-wider text-slate-400 mb-3">Use Template: {iQubeId}</div>
              
              {/* MetaQube Card - Use Mode */}
              <div className="bg-gradient-to-br from-blue-900/20 to-black/40 border border-blue-500/20 rounded-xl p-6 shadow-xl">
                <div className="uppercase text-[11px] tracking-wider text-blue-400 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                  MetaQube Instance
                </div>

                {/* iQube Section - Modified for Use Mode */}
                <div className="space-y-5">
                  <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center group relative">
                      <div className="flex items-center gap-1 group relative">
                        <span className="text-[13px] text-slate-400 cursor-help">iQube ID:</span>
                      </div>
                      <span className="text-gray-300 text-[12px]">
                        {iQubeId ? iQubeId.replace('Template', '') : ''} {instanceNumber}
                      </span>
                    </div>

                    <div className="flex justify-between items-center group relative">
                      <div className="flex items-center gap-1 group relative">
                        <span className="text-[13px] text-slate-400 cursor-help">Type:</span>
                      </div>
                      <span className="text-gray-300 text-[12px]">{iQubeType}</span>
                    </div>

                    <div className="flex justify-between items-center group relative">
                      <div className="flex items-center gap-1 group relative">
                        <span className="text-[13px] text-slate-400 cursor-help">$$$ Model:</span>
                      </div>
                      <span className="text-gray-300 text-[12px]">{businessModel}</span>
                    </div>

                    <div className="flex justify-between items-center group relative">
                      <div className="flex items-center gap-1 group relative">
                        <span className="text-[13px] text-slate-400 cursor-help">Price:</span>
                      </div>
                      <span className="text-gray-300 text-[12px]">{formatPrice(price)}</span>
                    </div>

                    <div className="flex justify-between items-center group relative">
                      <div className="flex items-center gap-1 group relative">
                        <span className="text-[13px] text-slate-400 cursor-help">Instance:</span>
                      </div>
                      <span className="text-gray-300 text-[12px]">{`1 of 100`}</span>
                    </div>
                  </div>

                  {/* Subject Section - Subject Type editable, Identifiability fixed */}
                  <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center group relative">
                      <div className="flex items-center gap-1 group relative">
                        <span className="text-[13px] text-slate-400 cursor-help">Type:</span>
                        <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                          The category of subject that this iQube relates to
                        </div>
                      </div>
                      <select 
                        id="owner-type-select-use"
                        value={ownerType} 
                        onChange={(e) => setOwnerType(e.target.value as OwnerType)}
                        className="bg-black/50 border border-blue-500/30 rounded px-2 py-1 text-[12px] text-blue-400 focus:outline-none focus:border-blue-400"
                        aria-label="Subject Type"
                        title="Select the subject type"
                      >
                        <option value="Individual">Person</option>
                        <option value="Organisation">Organization</option>
                        <option value="Agent">Agent</option>
                      </select>
                    </div>
                    <div className="flex justify-between items-center group relative">
                      <div className="flex items-center gap-1 group relative">
                        <span className="text-[13px] text-slate-400 cursor-help">Identifiability:</span>
                        <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                          The level to which the subject can be personally identified from the iQube data
                        </div>
                      </div>
                      <span className="text-gray-300 text-[12px]">{identifiabilityLevel}</span>
                    </div>
                  </div>
                  
                  {/* Additional Records Section - Can populate values but not add new records */}
                  <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] text-slate-400">Additional Records</span>
                      </div>
                    </div>
                    
                    {/* Additional Records List */}
                    <div className="space-y-3 mt-3 max-h-[300px] overflow-y-auto pr-2">
                      {formattedMetaQubeData.filter(item => 
                        !['identifier', 'creator', 'type', 'ownerType', 'identifiability', 'created', 'businessModel', 'instance', 'version'].includes(item.key)
                      ).map((item, index) => (
                        <div key={`${item.key}-${index}`} className="bg-black/30 p-3 rounded border border-blue-500/10 hover:border-blue-500/30 transition-all duration-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-blue-400 text-[13px] font-medium">{item.key}</div>
                              <div className="text-[12px] text-slate-400 mt-0.5">
                                {item.description || 'No description provided'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <input 
                                type="text" 
                                value={item.value || ''}
                                onChange={(e) => {
                                  // Update the value for this record
                                  const updatedData = formattedMetaQubeData.map(record => 
                                    record.key === item.key ? { ...record, value: e.target.value } : record
                                  );
                                  setFormattedMetaQubeData(updatedData);
                                }}
                                className="bg-black/50 border border-blue-500/30 rounded px-2 py-1 text-[12px] text-blue-300 w-[150px] focus:outline-none focus:border-blue-400"
                                placeholder="Value"
                              />
                            </div>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                            <span>Source:</span>
                            <span className="text-gray-400">{item.source}</span>
                          </div>
                        </div>
                      ))}
                      
                      {/* Provenance Field (new) */}
                      <div className="bg-black/30 p-3 rounded border border-blue-500/10">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-blue-400 text-[13px] font-medium">Provenance</div>
                            <div className="text-[12px] text-slate-400 mt-0.5">
                              The origin path of this template
                            </div>
                          </div>
                          <div className="text-gray-300 text-[12px]">0</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Scores Section at the bottom */}
                  <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] text-slate-400">Scores</span>
                      </div>
                    </div>
                    
                    {/* Score Indicators */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] text-slate-500 mb-1">Sensitivity</div>
                        <EnhancedScoreIndicator 
                          value={compositeScores.sensitivityScore} 
                          maxValue={5} 
                          type="sensitivity"
                          size="small"
                        />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 mb-1">Verifiability</div>
                        <EnhancedScoreIndicator 
                          value={compositeScores.verifiabilityScore} 
                          maxValue={5} 
                          type="verifiability"
                          size="small"
                        />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 mb-1">Accuracy</div>
                        <EnhancedScoreIndicator 
                          value={compositeScores.accuracyScore} 
                          maxValue={5} 
                          type="accuracy"
                          size="small"
                        />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 mb-1">Risk</div>
                        <EnhancedScoreIndicator 
                          value={compositeScores.riskScore} 
                          maxValue={5} 
                          type="risk"
                          size="small"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BlakQube Card - Use Mode */}
              <div className="bg-gradient-to-br from-purple-900/20 to-black/40 border border-purple-500/20 rounded-xl p-6 shadow-xl mt-6">
                <div className="uppercase text-[11px] tracking-wider text-purple-400 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                  BlakQube Instance {instanceNumber && <span className="ml-1">({getInstanceLabel()})</span>}
                </div>
                
                <div className="space-y-4">
                  {/* BlakQube data list */}
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {formattedBlakQubeData.map((item, index) => (
                      <div key={`blak-${index}`} className="bg-black/30 p-3 rounded border border-purple-500/10 hover:border-purple-500/30 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-purple-400 text-[13px] font-medium">{item.key}</div>
                            <div className="text-[12px] text-slate-400 mt-0.5">
                              {item.description || 'No description'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              value={item.instanceValue || ''} 
                              onChange={(e) => {
                                // Update instance value for this BlakQube record
                                const updatedData = formattedBlakQubeData.map(record => 
                                  record.key === item.key ? { ...record, instanceValue: e.target.value } : record
                                );
                                setFormattedBlakQubeData(updatedData);
                              }}
                              placeholder="Value"
                              className="bg-black/50 border border-purple-500/30 rounded px-2 py-1 text-[12px] text-purple-300 w-[150px] focus:outline-none focus:border-purple-400"
                            />
                            {/* Source icon button for auto-populating */}
                            <button 
                              onClick={() => {
                                // Logic to auto-populate from source would go here
                                console.log(`Auto-populate ${item.key} from ${item.source}`);
                              }}
                              className="hover:bg-purple-500/10 p-1 rounded transition-all duration-200"
                              aria-label={`Auto-populate from ${item.source}`}
                              title={`Auto-populate from ${item.source}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                          <span>Source:</span>
                          <span className="text-gray-400">{item.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Mint Button - Only available when in Use mode and fields are populated */}
              <div className="mt-6">
                <button 
                  onClick={handleMint}
                  className="w-full bg-green-600/30 hover:bg-green-600/40 text-green-300 px-6 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 font-medium shadow-lg hover:shadow-green-500/20 hover:scale-105"
                  aria-label="Mint iQube Instance"
                  title="Create a permanent record of this iQube instance"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22V8"/>
                    <path d="m19 12-7-4-7 4"/>
                    <path d="m5 8 7-4 7 4"/>
                  </svg>
                  Mint iQube Instance
                </button>
              </div>
            </div>
          </div>
        );

      case "edit":
        return (
          <div id="edit-panel" role="tabpanel" aria-labelledby="edit-tab">
            <div className="space-y-6">
              <div className="uppercase text-[11px] tracking-wider text-slate-400 mb-3">
                {isTemplate ? `Edit Template: ${iQubeId}` : `Edit Instance: ${getInstanceName()}`}
              </div>
              
              {/* Warning for non-decrypted instance */}
              {!isTemplate && !isDecrypted && (
                <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4 text-amber-200 mb-4">
                  <p className="mb-2 font-medium">Decryption Required</p>
                  <p className="text-sm">You need to decrypt this iQube instance before you can edit it. Please go to the Decrypt tab first.</p>
                </div>
              )}
              
              {/* MetaQube Card - Same as View Tab */}
              <div className="bg-gradient-to-br from-blue-900/20 to-black/40 border border-blue-500/20 rounded-xl p-6 shadow-xl">
                <div className="uppercase text-[11px] tracking-wider text-blue-400 mb-6 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                  MetaQube Data
                </div>
                
                <div className="space-y-6">
                  {/* iQube Section */}
                  <div>
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8"></path>
                          <path d="m19 12-7-4-7 4"></path>
                          <path d="m5 8 7-4 7 4"></path>
                        </svg>
                      </div>
                      iQube
                    </div>
                    <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Identifier:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            A unique identifier for the iQube that allows for tracking and referencing in the iQube Protocol
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{isTemplate ? iQubeId : getInstanceName()}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Creator:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The entity that created this iQube
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">Creator ID</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Type:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The category of iQube defining its primary purpose and data structure
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{iQubeType}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">$$$ Model:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The economic model governing how this iQube can be monetized or accessed
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{businessModel}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Price:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The price for accessing or using this iQube in Satoshis with USD equivalent
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{formatPrice(price)}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Instance:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            Whether this is a template or an instance, and instance count if applicable
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{isTemplate ? "Template" : getInstanceLabel()}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Created:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The date when this iQube was created
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{new Date().toISOString().split('T')[0]}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Version:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The version number of this iQube
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">1.0</span>
                      </div>
                    </div>
                  </div>

                  {/* Subject Section */}
                  <div>
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                      Subject
                    </div>
                    <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Type:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The category of subject that this iQube relates to
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">
                          {ownerType === "Individual" ? "Person" : 
                           ownerType === "Organisation" ? "Organization" : "Agent"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Identifiability:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The level to which the subject can be personally identified from the iQube data
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{identifiabilityLevel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Scores Section */}
                  <div>
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 6v6l4 2"></path>
                        </svg>
                      </div>
                      Scores
                    </div>
                    <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4">
                      <div className="flex justify-between items-center gap-2">
                        {/* Sensitivity */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Sensitivity</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.sensitivityScore}
                            type="sensitivity"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Data sensitivity level
                          </div>
                        </div>
                        
                        {/* Risk */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Risk</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.riskScore}
                            type="risk"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Risk assessment level
                          </div>
                        </div>
                        
                        {/* Accuracy */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Accuracy</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.accuracyScore}
                            type="accuracy"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Data accuracy level
                          </div>
                        </div>
                        
                        {/* Verifiability */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Verifiability</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.verifiabilityScore}
                            type="verifiability"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Data verifiability level
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              
              {/* BlakQube Data Panel - Qrypto Profile */}
              <div className="bg-gradient-to-br from-purple-900/20 to-black/40 border border-purple-500/20 rounded-xl p-6 shadow-xl mt-6">
                <div className="uppercase text-[11px] tracking-wider text-purple-400 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                    BLAKQUBE
                    <span className="text-[10px] ml-2 bg-purple-500/20 px-2 py-0.5 rounded">
                      {isTemplate ? 'Template' : getInstanceLabel()}
                    </span>
                  </div>
                  {!isTemplate && !isDecrypted && (
                    <div className="flex items-center gap-1 text-[10px] bg-purple-500/20 px-2 py-0.5 rounded">
                      <Lock size={10} />
                      <span>ENCRYPTED</span>
                    </div>
                  )}
                  {!isTemplate && isDecrypted && (
                    <div className="flex items-center gap-1 text-[10px] bg-green-500/20 px-2 py-0.5 rounded text-green-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span>EDITABLE DATA</span>
                    </div>
                  )}
                </div>
                
                {/* Warning for non-decrypted instance */}
                {!isTemplate && !isDecrypted && (
                  <div className="mb-4">
                    {error && (
                      <div className="bg-red-900/20 border border-red-500/30 text-red-300 px-3 py-2 rounded-lg mb-3 text-[12px]">
                        <div className="flex items-center gap-2 mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          <span className="font-medium">Decryption Error</span>
                        </div>
                        {error}
                      </div>
                    )}
                    <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4 text-amber-200 mb-4">
                      <p className="mb-2 font-medium">Decryption Required</p>
                      <p className="text-sm">You need to decrypt this iQube instance before you can edit the BlakQube data. Please go to the Decrypt tab first.</p>
                    </div>
                  </div>
                )}
                
                {/* BlakQube Profile Fields */}
                <div className="flex flex-col gap-3">
                  {blakQubeProfileData.map((field, index) => (
                    <div 
                      key={`blakqube-field-${index}`} 
                      className="bg-black/30 border border-purple-500/10 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-white cursor-help">{field.key}</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            {field.description}
                          </div>
                        </div>
                        <SourceIcon source={field.source} />
                      </div>
                      <div className="text-gray-300 text-[12px] break-all bg-black/20 p-2 rounded border border-purple-500/10">
                        {isTemplate ? (
                          <input 
                            type="text" 
                            value={field.templateValue || ''} 
                            onChange={(e) => {
                              const updatedData = blakQubeProfileData.map((item, idx) => 
                                idx === index ? { ...item, templateValue: e.target.value } : item
                              );
                              setBlakQubeProfileData(updatedData);
                            }}
                            placeholder="Enter template value..."
                            className="w-full bg-transparent border-none text-purple-300 focus:outline-none"
                          />
                        ) : (
                          !isDecrypted ? 
                            <span className="text-purple-300 flex items-center gap-1">
                              <Lock size={12} /> 
                              <span className="opacity-60">••••••••••••••••</span>
                            </span> : 
                            <input 
                              type="text" 
                              value={field.instanceValue || ''} 
                              onChange={(e) => {
                                const updatedData = blakQubeProfileData.map((item, idx) => 
                                  idx === index ? { ...item, instanceValue: e.target.value } : item
                                );
                                setBlakQubeProfileData(updatedData);
                              }}
                              placeholder="Enter value..."
                              className="w-full bg-transparent border-none text-gray-300 focus:outline-none"
                            />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Add BlakQube Profile Fields Option for Templates */}
                {isTemplate && (
                  <div className="mt-6 pt-3">
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-purple-400">
                        <PlusCircle size={14} />
                      </div>
                      Add New Record
                    </div>
                    {!isBlakEditMode ? (
                      <div className="bg-black/30 border border-purple-500/10 rounded-lg p-4">
                        <button 
                          onClick={() => setIsBlakEditMode(true)}
                          className="w-full bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-[13px] font-medium"
                        >
                          <PlusCircle size={15} />
                          Add New Record
                        </button>
                      </div>
                    ) : (
                      <div className="bg-black/30 border border-purple-500/10 rounded-lg p-4 space-y-4">
                        <div className="text-white text-[14px] font-medium mb-2 flex justify-between items-center">
                          <span>Add New Record</span>
                          <button onClick={() => setIsBlakEditMode(false)} className="text-slate-400 hover:text-white">
                            <X size={16} />
                          </button>
                        </div>
                        
                        <div>
                          <label className="block text-[13px] text-slate-400 mb-1">Record Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g. email, profession, address"
                            className="w-full bg-black/40 border border-purple-500/30 rounded px-3 py-2 text-[13px] text-white focus:outline-none focus:border-purple-400"
                            value={newBlakRecord.key}
                            onChange={(e) => setNewBlakRecord({...newBlakRecord, key: e.target.value})}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[13px] text-slate-400 mb-1">Record Description</label>
                          <textarea
                            placeholder="This description describes the value of the record"
                            className="w-full bg-black/40 border border-purple-500/30 rounded px-3 py-2 text-[13px] text-white focus:outline-none focus:border-purple-400 h-20 resize-none"
                            value={newBlakRecord.description}
                            onChange={(e) => setNewBlakRecord({...newBlakRecord, description: e.target.value})}
                          ></textarea>
                        </div>
                        
                        <div>
                          <label htmlFor="blak-record-source-edit" className="block text-[13px] text-slate-400 mb-1">Source</label>
                          <select 
                            id="blak-record-source-edit"
                            className="w-full bg-black/40 border border-purple-500/30 rounded px-3 py-2 text-[13px] text-white focus:outline-none focus:border-purple-400"
                            value={newBlakRecord.source}
                            onChange={(e) => setNewBlakRecord({...newBlakRecord, source: e.target.value as any})}
                            aria-label="Record source type"
                            title="Select the source type for this record"
                          >
                            <option value="self">Self-Reported</option>
                            <option value="verified">Verified</option>
                            <option value="third-party">Third-Party</option>
                            <option value="manual">Manual Entry</option>
                          </select>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <button 
                            className="flex-1 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/30 text-purple-400 px-4 py-2 rounded transition-all duration-200 text-[13px] font-medium"
                            onClick={() => {
                              // Add the new record to the BlakQube profile data
                              if (newBlakRecord.key && newBlakRecord.description) {
                                setBlakQubeProfileData([
                                  ...blakQubeProfileData,
                                  {
                                    key: newBlakRecord.key,
                                    templateValue: '',
                                    instanceValue: newBlakRecord.description, // Use description as instanceValue
                                    source: newBlakRecord.source as any,
                                    description: newBlakRecord.description
                                  }
                                ]);
                                // Reset the form
                                setNewBlakRecord({
                                  key: '',
                                  templateValue: '',
                                  instanceValue: '',
                                  source: 'manual',
                                  description: ''
                                });
                                // Collapse the form
                                setIsBlakEditMode(false);
                              }
                            }}
                          >
                            Save Record
                          </button>
                          <button 
                            onClick={() => setIsBlakEditMode(false)}
                            className="bg-black/40 hover:bg-black/50 border border-gray-700 text-gray-400 px-4 py-2 rounded transition-all duration-200 text-[13px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Save/Mint Button - Conditional based on mode */}
              <div className="mt-6">
                {isTemplate ? (
                  /* Save Template Button */
                  <button 
                    onClick={handleSaveTemplate}
                    className="w-full bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 px-6 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 font-medium shadow-lg hover:shadow-purple-500/20 hover:scale-105"
                    aria-label="Save Template Changes"
                    title="Save changes to this template"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Save Template
                  </button>
                ) : isDecrypted ? (
                  /* Mint New Instance Button - Only for decrypted instances */
                  <div className="space-y-4">
                    <div className="bg-black/30 border border-green-500/10 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-[13px] text-slate-400">New Instance ID:</div>
                        <div className="text-green-300 text-[13px] font-medium">
                          {getInstanceName().replace(instanceNumber.toString(), generateNextInstanceNumber().toString())}
                        </div>
                      </div>
                      <p className="text-[12px] text-gray-400">
                        This will create a new iQube instance with your edited data, using the next available ID in the sequence.
                      </p>
                    </div>
                    
                    <button
                      onClick={() => {
                        // Generate next instance number
                        const newInstanceNumber = generateNextInstanceNumber();
                        setInstanceNumber(newInstanceNumber);
                        
                        // Call mint function with updated data
                        handleMint();
                      }}
                      className="w-full bg-green-600/30 hover:bg-green-600/40 border border-green-500/30 text-green-300 px-6 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 font-medium shadow-lg hover:shadow-green-500/20 hover:scale-105"
                      aria-label="Mint New Instance"
                      title="Create a new instance with your edited data"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                      Mint New Instance
                    </button>
                  </div>
                ) : (
                  /* Decrypt Reminder - For non-decrypted instances */
                  <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4 text-amber-200">
                    <p className="mb-2 font-medium">Decryption Required</p>
                    <p className="text-sm">You need to decrypt this iQube instance before you can mint a new instance from it.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "view":
        return (
          <div id="view-panel" role="tabpanel" aria-labelledby="view-tab">
            <div className="space-y-6">
              {/* Example iQube Navigation */}
              {isTemplate && (
                <div className="bg-gradient-to-br from-gray-900/40 to-black/40 border border-gray-500/20 rounded-xl p-4 shadow-xl">
                  <div className="uppercase text-[11px] tracking-wider text-gray-400 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                      Example iQubes
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => navigateExamples('prev')} 
                        className="p-1 rounded-full hover:bg-gray-800 transition-colors"
                        aria-label="Previous example"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs">{currentExampleIndex + 1}/{exampleIQubes.length}</span>
                      <button 
                        onClick={() => navigateExamples('next')} 
                        className="p-1 rounded-full hover:bg-gray-800 transition-colors"
                        aria-label="Next example"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="bg-black/30 border border-gray-500/10 rounded-lg p-3">
                    <div className="text-white text-[13px] font-medium mb-1">{exampleIQubes[currentExampleIndex].name}</div>
                    <div className="text-gray-400 text-[12px] mb-2">{exampleIQubes[currentExampleIndex].description}</div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      <div className="text-center bg-black/40 rounded p-1 text-[11px]">
                        <span className="text-gray-500">Type:</span>
                        <div className="text-blue-400">{exampleIQubes[currentExampleIndex].type}</div>
                      </div>
                      <div className="text-center bg-black/40 rounded p-1 text-[11px]">
                        <span className="text-gray-500">$$$ Model:</span>
                        <div className="text-purple-400">{exampleIQubes[currentExampleIndex].businessModel}</div>
                      </div>
                      <div className="text-center bg-black/40 rounded p-1 text-[11px]">
                        <span className="text-gray-500">Price:</span>
                        <div className="text-green-400">{formatPrice(price)}</div>
                      </div>
                      <div className="text-center bg-black/40 rounded p-1 text-[11px]">
                        <span className="text-gray-500">Subject:</span>
                        <div className="text-amber-400">{exampleIQubes[currentExampleIndex].ownerType}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MetaQube Data Section - Same as Edit Tab */}
              <div className="bg-gradient-to-br from-blue-900/20 to-black/40 border border-blue-500/20 rounded-xl p-6 shadow-xl">
                <div className="uppercase text-[11px] tracking-wider text-blue-400 mb-6 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                  MetaQube Data
                </div>
                
                <div className="space-y-6">
                  {/* iQube Section */}
                  <div>
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8"></path>
                          <path d="m19 12-7-4-7 4"></path>
                          <path d="m5 8 7-4 7 4"></path>
                        </svg>
                      </div>
                      iQube
                    </div>
                    <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Identifier:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            A unique identifier for the iQube that allows for tracking and referencing in the iQube Protocol
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{isTemplate ? iQubeId : getInstanceName()}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Creator:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The entity that created this iQube
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">Creator ID</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Type:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The category of iQube defining its primary purpose and data structure
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{iQubeType}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">$$$ Model:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The economic model governing how this iQube can be monetized or accessed
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{businessModel}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Price:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The price for accessing or using this iQube in Satoshis with USD equivalent
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{formatPrice(price)}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Instance:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            Whether this is a template or an instance, and instance count if applicable
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{isTemplate ? "Template" : getInstanceLabel()}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Created:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The date when this iQube was created
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{new Date().toISOString().split('T')[0]}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Version:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The version number of this iQube
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">1.0</span>
                      </div>
                    </div>
                  </div>

                  {/* Subject Section */}
                  <div>
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                      Subject
                    </div>
                    <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Type:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The category of subject that this iQube relates to
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">
                          {ownerType === "Individual" ? "Person" : 
                           ownerType === "Organisation" ? "Organization" : "Agent"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Identifiability:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The level to which the subject can be personally identified from the iQube data
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{identifiabilityLevel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Scores Section */}
                  <div>
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 6v6l4 2"></path>
                        </svg>
                      </div>
                      Scores
                    </div>
                    <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4">
                      <div className="flex justify-between items-center gap-2">
                        {/* Sensitivity */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Sensitivity</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.sensitivityScore}
                            type="sensitivity"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Data sensitivity level
                          </div>
                        </div>
                        
                        {/* Risk */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Risk</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.riskScore}
                            type="risk"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Risk assessment level
                          </div>
                        </div>
                        
                        {/* Accuracy */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Accuracy</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.accuracyScore}
                            type="accuracy"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Data accuracy level
                          </div>
                        </div>
                        
                        {/* Verifiability */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Verifiability</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.verifiabilityScore}
                            type="verifiability"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Data verifiability level
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BlakQube Data Panel - Qrypto Profile */}
              <div className="bg-gradient-to-br from-purple-900/20 to-black/40 border border-purple-500/20 rounded-xl p-6 shadow-xl mt-6">
                <div className="uppercase text-[11px] tracking-wider text-purple-400 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                    BLAKQUBE
                    <span className="text-[10px] ml-2 bg-purple-500/20 px-2 py-0.5 rounded">
                      {isTemplate ? 'Template' : getInstanceLabel()}
                    </span>
                  </div>
                  {!isTemplate && !isDecrypted && (
                    <div className="flex items-center gap-1 text-[10px] bg-purple-500/20 px-2 py-0.5 rounded">
                      <Lock size={10} />
                      <span>ENCRYPTED</span>
                    </div>
                  )}
                  {!isTemplate && isDecrypted && (
                    <div className="flex items-center gap-1 text-[10px] bg-green-500/20 px-2 py-0.5 rounded text-green-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span>DECRYPTED</span>
                    </div>
                  )}
                </div>
                
                {/* Decrypt Button for Instance Mode */}
                {!isTemplate && !isDecrypted && (
                  <div className="mb-4">
                    {error && (
                      <div className="bg-red-900/20 border border-red-500/30 text-red-300 px-3 py-2 rounded-lg mb-3 text-[12px]">
                        <div className="flex items-center gap-2 mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          <span className="font-medium">Decryption Error</span>
                        </div>
                        {error}
                      </div>
                    )}
                    <button
                      onClick={handleDecrypt}
                      disabled={decryptLoading}
                      className="w-full bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 px-4 py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {decryptLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Decrypting...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          Decrypt with Token
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {/* BlakQube Profile Fields */}
                <div className="flex flex-col gap-3">
                  {blakQubeProfileData.map((field, index) => (
                    <div 
                      key={`blakqube-field-${index}`} 
                      className="bg-black/30 border border-purple-500/10 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-white cursor-help">{field.key}</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            {field.description}
                          </div>
                        </div>
                        <SourceIcon source={field.source} />
                      </div>
                      <div className="text-gray-300 text-[12px] break-all bg-black/20 p-2 rounded border border-purple-500/10">
                        {isTemplate ? 
                          (field.templateValue || '—') : 
                          (!isDecrypted ? 
                            <span className="text-purple-300 flex items-center gap-1">
                              <Lock size={12} /> 
                              <span className="opacity-60">••••••••••••••••</span>
                            </span> : 
                            field.instanceValue)
                        }
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Add BlakQube Profile Fields Option for Templates */}
                {isTemplate && (
                  <div className="mt-6 pt-3">
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-purple-400">
                        <PlusCircle size={14} />
                      </div>
                      Add New Record
                    </div>
                    {!isBlakEditMode ? (
                      <div className="bg-black/30 border border-purple-500/10 rounded-lg p-4">
                        <button 
                          onClick={() => setIsBlakEditMode(true)}
                          className="w-full bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-[13px] font-medium"
                        >
                          <PlusCircle size={15} />
                          Add New Record
                        </button>
                      </div>
                    ) : (
                      <div className="bg-black/30 border border-purple-500/10 rounded-lg p-4 space-y-4">
                        <div className="text-white text-[14px] font-medium mb-2 flex justify-between items-center">
                          <span>Add New Record</span>
                          <button onClick={() => setIsBlakEditMode(false)} className="text-slate-400 hover:text-white">
                            <X size={16} />
                          </button>
                        </div>
                        
                        <div>
                          <label className="block text-[13px] text-slate-400 mb-1">Record Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g. email, profession, address"
                            className="w-full bg-black/40 border border-purple-500/30 rounded px-3 py-2 text-[13px] text-white focus:outline-none focus:border-purple-400"
                            value={newBlakRecord.key}
                            onChange={(e) => setNewBlakRecord({...newBlakRecord, key: e.target.value})}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[13px] text-slate-400 mb-1">Record Description</label>
                          <textarea
                            placeholder="This description describes the value of the record"
                            className="w-full bg-black/40 border border-purple-500/30 rounded px-3 py-2 text-[13px] text-white focus:outline-none focus:border-purple-400 h-20 resize-none"
                            value={newBlakRecord.description}
                            onChange={(e) => setNewBlakRecord({...newBlakRecord, description: e.target.value})}
                          ></textarea>
                        </div>
                        
                        <div>
                          <label htmlFor="blak-record-source" className="block text-[13px] text-slate-400 mb-1">Source</label>
                          <select 
                            id="blak-record-source"
                            className="w-full bg-black/40 border border-purple-500/30 rounded px-3 py-2 text-[13px] text-white focus:outline-none focus:border-purple-400"
                            value={newBlakRecord.source}
                            onChange={(e) => setNewBlakRecord({...newBlakRecord, source: e.target.value as any})}
                            aria-label="Record source type"
                            title="Select the source type for this record"
                          >
                            <option value="self">Self-Reported</option>
                            <option value="verified">Verified</option>
                            <option value="third-party">Third-Party</option>
                            <option value="manual">Manual Entry</option>
                          </select>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <button 
                            className="flex-1 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/30 text-purple-400 px-4 py-2 rounded transition-all duration-200 text-[13px] font-medium"
                            onClick={() => {
                              // Add the new record to the BlakQube profile data
                              if (newBlakRecord.key && newBlakRecord.description) {
                                setBlakQubeProfileData([
                                  ...blakQubeProfileData,
                                  {
                                    key: newBlakRecord.key,
                                    templateValue: '',
                                    instanceValue: newBlakRecord.description, // Use description as instanceValue
                                    source: newBlakRecord.source as any,
                                    description: newBlakRecord.description
                                  }
                                ]);
                                // Reset the form
                                setNewBlakRecord({
                                  key: '',
                                  templateValue: '',
                                  instanceValue: '',
                                  source: 'manual',
                                  description: ''
                                });
                                // Collapse the form
                                setIsBlakEditMode(false);
                              }
                            }}
                          >
                            Save Record
                          </button>
                          <button 
                            onClick={() => setIsBlakEditMode(false)}
                            className="bg-black/40 hover:bg-black/50 border border-gray-700 text-gray-400 px-4 py-2 rounded transition-all duration-200 text-[13px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "decrypt":
        return (
          <div id="decrypt-panel" role="tabpanel" aria-labelledby="decrypt-tab">
            <div className="space-y-6">
              <div className="uppercase text-[11px] tracking-wider text-slate-400 mb-3">Decrypt: {isTemplate ? iQubeId : getInstanceName()}</div>
              
              {/* Decrypt Action Panel */}
              {!isDecrypted && (
                <div className="bg-gradient-to-br from-amber-900/20 to-black/40 border border-amber-500/20 rounded-xl p-6 shadow-xl mb-6">
                  <div className="uppercase text-[11px] tracking-wider text-amber-400 mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                    Decrypt BlakQube Data
                  </div>
                  <div className="space-y-4">
                    {error && (
                      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-red-200 mb-4">
                        {error}
                      </div>
                    )}
                    
                    <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4 text-amber-200 mb-4">
                      <p className="mb-2 font-medium">Token Required</p>
                      <p className="text-sm">You need to own the decryption token for this iQube instance to view the encrypted data.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleDecrypt}
                    disabled={decryptLoading}
                    className={`w-full bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 px-6 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 font-medium shadow-lg hover:shadow-amber-500/20 ${decryptLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}`}
                    aria-label="Decrypt data"
                    title="Decrypt BlakQube data"
                  >
                    {decryptLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Decrypting...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Decrypt with Token
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* Success Message when decrypted */}
              {isDecrypted && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-green-200 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span className="font-medium">Data Decrypted Successfully</span>
                  </div>
                  <p className="text-sm">You now have access to view the decrypted BlakQube data.</p>
                </div>
              )}
              
              {/* MetaQube Data Section - Same as View Tab */}
              <div className="bg-gradient-to-br from-blue-900/20 to-black/40 border border-blue-500/20 rounded-xl p-6 shadow-xl">
                <div className="uppercase text-[11px] tracking-wider text-blue-400 mb-6 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                  MetaQube Data
                </div>
                
                <div className="space-y-6">
                  {/* iQube Section */}
                  <div>
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8"></path>
                          <path d="m19 12-7-4-7 4"></path>
                          <path d="m5 8 7-4 7 4"></path>
                        </svg>
                      </div>
                      iQube
                    </div>
                    <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Identifier:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            A unique identifier for the iQube that allows for tracking and referencing in the iQube Protocol
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{isTemplate ? iQubeId : getInstanceName()}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Creator:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The entity that created this iQube
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">Creator ID</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Type:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The category of iQube defining its primary purpose and data structure
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{iQubeType}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">$$$ Model:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The economic model governing how this iQube can be monetized or accessed
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{businessModel}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Price:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The price for accessing or using this iQube in Satoshis with USD equivalent
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{formatPrice(price)}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Instance:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            Whether this is a template or an instance, and instance count if applicable
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{isTemplate ? "Template" : getInstanceLabel()}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Created:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The date when this iQube was created
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{new Date().toISOString().split('T')[0]}</span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Version:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The version number of this iQube
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">1.0</span>
                      </div>
                    </div>
                  </div>

                  {/* Subject Section */}
                  <div>
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                      Subject
                    </div>
                    <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Type:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The category of subject that this iQube relates to
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">
                          {ownerType === "Individual" ? "Person" : 
                           ownerType === "Organisation" ? "Organization" : "Agent"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center group relative">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-slate-400 cursor-help">Identifiability:</span>
                          <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-normal text-xs max-w-[200px]">
                            The level to which the subject can be personally identified from the iQube data
                          </div>
                        </div>
                        <span className="text-gray-300 text-[12px]">{identifiabilityLevel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Scores Section */}
                  <div>
                    <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
                      <div className="text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 6v6l4 2"></path>
                        </svg>
                      </div>
                      Scores
                    </div>
                    <div className="bg-black/30 border border-blue-500/10 rounded-lg p-4">
                      <div className="flex justify-between items-center gap-2">
                        {/* Sensitivity */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Sensitivity</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.sensitivityScore}
                            type="sensitivity"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Data sensitivity level
                          </div>
                        </div>
                        
                        {/* Risk */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Risk</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.riskScore}
                            type="risk"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Risk assessment level
                          </div>
                        </div>
                        
                        {/* Accuracy */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Accuracy</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.accuracyScore}
                            type="accuracy"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Data accuracy level
                          </div>
                        </div>
                        
                        {/* Verifiability */}
                        <div className="flex flex-col items-center gap-1 group relative">
                          <div className="text-[10px] text-slate-400 mb-1">Verifiability</div>
                          <EnhancedScoreIndicator 
                            value={compositeScores.verifiabilityScore}
                            type="verifiability"
                            size="small"
                          />
                          <div className="absolute z-50 hidden group-hover:block top-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap text-xs">
                            Data verifiability level
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* BlakQube Data Panel - With Decrypted Data */}
              <div className="bg-gradient-to-br from-purple-900/20 to-black/40 border border-purple-500/20 rounded-xl p-6 shadow-xl mt-6">
                <div className="uppercase text-[11px] tracking-wider text-purple-400 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                    BLAKQUBE
                    <span className="text-[10px] ml-2 bg-purple-500/20 px-2 py-0.5 rounded">
                      {isTemplate ? 'Template' : getInstanceLabel()}
                    </span>
                  </div>
                  {!isTemplate && isDecrypted && (
                    <div className="flex items-center gap-1 text-[10px] bg-green-500/20 px-2 py-0.5 rounded text-green-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span>DECRYPTED</span>
                    </div>
                  )}
                </div>
                
                {/* BlakQube Profile Fields - Decrypted in this tab */}
                <div className="flex flex-col gap-3">
                  {blakQubeProfileData.map((field, index) => (
                    <div 
                      key={`blakqube-field-${index}`} 
                      className="bg-black/30 border border-purple-500/10 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1 group relative">
                          <span className="text-[13px] text-white cursor-help">{field.key}</span>
                        </div>
                        <SourceIcon source={field.source} />
                      </div>
                      <div className="text-gray-300 text-[12px] break-all bg-black/20 p-2 rounded border border-purple-500/10">
                        {isTemplate ? 
                          (field.templateValue || '—') : 
                          (isDecrypted ? field.instanceValue : 
                            <span className="text-purple-300 flex items-center gap-1">
                              <Lock size={12} /> 
                              <span className="opacity-60">••••••••••••••••</span>
                            </span>
                          )
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case "mint":
        return (
          <div id="mint-panel" role="tabpanel" aria-labelledby="mint-tab">
            <div className="space-y-6">
              <div className="uppercase text-[11px] tracking-wider text-slate-400 mb-3">Mint: {iQubeId}</div>
              <div className="bg-gradient-to-br from-amber-900/20 to-black/40 border border-amber-500/20 rounded-xl p-6 shadow-xl">
                <div className="uppercase text-[11px] tracking-wider text-amber-400 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                  Mint New iQube
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] text-slate-400 mb-1">New iQube ID</label>
                    <input
                      type="text"
                      className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-[13px] text-white"
                      value={`${iQubeId.replace('template', '')}-${Math.floor(Math.random() * 1000)}`}
                      readOnly
                      id="new-iqube-id"
                      aria-label="New iQube ID"
                      title="Generated ID for the new iQube"
                    />
                </div>
                  <div>
                    <label className="block text-[13px] text-slate-400 mb-1">Template Source</label>
                    <input
                      type="text"
                      className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-[13px] text-white"
                      value={iQubeId}
                      readOnly
                      id="template-source"
                      aria-label="Template source"
                      title="Source template for the new iQube"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-slate-400 mb-1">iQube Type</label>
                    <select
                      className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-[13px] text-white"
                      value={iQubeType}
                      onChange={(e) => setIQubeType(e.target.value as IQubeType)}
                      id="iqube-type"
                      aria-label="iQube type"
                    >
                      <option value="MetaQube">MetaQube</option>
                      <option value="BlakQube">BlakQube</option>
                      <option value="TokenQube">TokenQube</option>
                      <option value="AgentQube">AgentQube</option>
                      <option value="ContentQube">ContentQube</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] text-slate-400 mb-1">$$$ Model</label>
                    <select
                      className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-[13px] text-white"
                      value={businessModel}
                      onChange={(e) => setBusinessModel(e.target.value as BusinessModelType)}
                      id="business-model"
                      aria-label="Business model"
                    >
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                      <option value="Rent">Rent</option>
                      <option value="Lease">Lease</option>
                      <option value="Subscribe">Subscribe</option>
                      <option value="Stake">Stake</option>
                      <option value="License">License</option>
                      <option value="Donate">Donate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] text-slate-400 mb-1">Price (Sats)</label>
                    <input
                      type="number"
                      className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-[13px] text-white"
                      value={price}
                      onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                      placeholder="Enter price in Satoshis"
                      min="0"
                      id="price"
                      aria-label="Price in Satoshis"
                    />
                    <div className="text-[11px] text-gray-400 mt-1">
                      USD: ${satsToUSD(price)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] text-slate-400 mb-1">$$$ Model</label>
                    <select
                      className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-[13px] text-white"
                      value={businessModel}
                      onChange={(e) => setBusinessModel(e.target.value as BusinessModelType)}
                      id="business-model"
                      aria-label="Business model"
                    >
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                      <option value="Rent">Rent</option>
                      <option value="Lease">Lease</option>
                      <option value="Subscribe">Subscribe</option>
                      <option value="Stake">Stake</option>
                      <option value="License">License</option>
                      <option value="Donate">Donate</option>
                    </select>
                  </div>
                  <button 
                    onClick={handleMint}
                    disabled={loading}
                    className={`w-full bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 px-6 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 font-medium shadow-lg hover:shadow-amber-500/20 ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}`}
                    aria-label="Mint new iQube"
                    title="Mint new iQube from template"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Minting...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                          <circle cx="12" cy="12" r="2"></circle>
                          <path d="M6 12h.01M18 12h.01"></path>
                        </svg>
                        Mint iQube
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case "activate":
        return (
          <div id="activate-panel" role="tabpanel" aria-labelledby="activate-tab">
            <div className="space-y-6">
              <div className="uppercase text-[11px] tracking-wider text-slate-400 mb-3">Activate: {iQubeId}</div>
              <div className="bg-gradient-to-br from-green-900/20 to-black/40 border border-green-500/20 rounded-xl p-6 shadow-xl">
                <div className="uppercase text-[11px] tracking-wider text-green-400 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                  Activate as iQube Type
                </div>
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    <span className="ml-2 text-gray-400">Processing activation...</span>
                  </div>
                ) : error ? (
                  <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-red-200 mb-4">
                    {error}
                  </div>
                ) : null}
              
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => handleActivate('DataQube')} 
                    disabled={loading}
                    className={`bg-green-600/30 hover:bg-green-600/40 text-green-300 px-5 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 font-medium shadow-lg hover:shadow-green-500/20 ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}`}
                    aria-label="Activate as DataQube"
                    title="Activate this iQube as a DataQube"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <ellipse cx="12" cy="5" rx="9" ry="3" />
                      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    </svg>
                    Activate as DataQube
                  </button>
                  <button 
                    onClick={() => handleActivate('ContentQube')} 
                    disabled={loading}
                    className={`bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-4 py-2 rounded transition-colors flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    aria-label="Activate as ContentQube"
                    title="Activate this iQube as a ContentQube"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                    Activate as ContentQube
                  </button>
                  <button 
                    onClick={() => handleActivate('ToolQube')} 
                    disabled={loading}
                    className={`bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 px-4 py-2 rounded transition-colors flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    aria-label="Activate as ToolQube"
                    title="Activate this iQube as a ToolQube"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    Activate as ToolQube
                  </button>
                  <button 
                    onClick={() => handleActivate('ModelQube')} 
                    disabled={loading}
                    className={`bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 px-4 py-2 rounded transition-colors flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    aria-label="Activate as ModelQube"
                    title="Activate this iQube as a ModelQube"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.29 7 12 12 20.71 7" />
                      <line x1="12" y1="22" x2="12" y2="12" />
                    </svg>
                    Activate as ModelQube
                  </button>
                  <button 
                    onClick={() => handleActivate('AgentQube')} 
                    disabled={loading}
                    className={`bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded transition-colors flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    aria-label="Activate as AigentQube"
                    title="Activate this iQube as an AigentQube"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Activate as AigentQube
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <div role="tabpanel">Select an option</div>;
    }
  };
  
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 drawer-backdrop" onClick={onClose}></div>
      <div className="relative bg-black/30 ring-1 ring-white/10 backdrop-blur-xl w-96 h-full overflow-y-auto shadow-xl ml-72 animate-slide-in-right drawer-content">
        <div className="p-4 md:p-6 space-y-6">
          <div className="uppercase text-[11px] tracking-wider text-slate-400 mb-4 flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className={`${getTypeColorScheme(iQubeType).text} bg-black/40 p-2 rounded-lg`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="5" height="5" rx="1" />
                  <rect x="16" y="3" width="5" height="5" rx="1" />
                  <rect x="3" y="16" width="5" height="5" rx="1" />
                  <rect x="16" y="16" width="5" height="5" rx="1" />
                  <path d="M8 6h8" />
                  <path d="M6 8v8" />
                  <path d="M18 8v8" />
                  <path d="M8 18h8" />
                </svg>
              </span>
              <span className="font-semibold text-white">iQube Operations</span>
            </div>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close drawer"
              title="Close drawer"
            >
              <X size={14} />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center border-b border-white/10 mb-4" role="tablist" aria-label="iQube Operations">
            {/* View tab - available in both modes */}
            <button
              onClick={() => setActiveTab("view")}
              className={`px-4 py-2 text-[13px] font-medium ${activeTab === "view" ? "text-white border-b-2 border-blue-400 bg-blue-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
              role="tab"
              aria-selected={activeTab === "view" ? "true" : "false"}
              aria-controls="view-panel"
              id="view-tab"
            >
              View
            </button>
            
            {/* Template mode tabs */}
            {isTemplate && (
              <>
                <button
                  onClick={() => {
                    setActiveTab("edit");
                    setIsEditMode(true);
                    setIsUseMode(false);
                    setIsMetaEditMode(false);
                    setIsBlakEditMode(false);
                  }}
                  className={`px-4 py-2 text-[13px] font-medium ${activeTab === "edit" ? "text-white border-b-2 border-purple-400 bg-purple-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
                  role="tab"
                  aria-selected={activeTab === "edit" ? "true" : "false"}
                  aria-controls="edit-panel"
                  id="edit-tab"
                >
                  Edit
                </button>
                <button
                  onClick={() => setActiveTab("activate")}
                  className={`px-4 py-2 text-[13px] font-medium ${activeTab === "activate" ? "text-white border-b-2 border-purple-500 bg-purple-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
                  role="tab"
                  aria-selected={activeTab === "activate" ? "true" : "false"}
                  aria-controls="activate-panel"
                  id="activate-tab"
                >
                  Activate
                </button>
              </>
            )}
            
            {/* Instance mode tabs */}
            {!isTemplate && (
              <>
                <button
                  onClick={() => setActiveTab("decrypt")}
                  className={`px-4 py-2 text-[13px] font-medium ${activeTab === "decrypt" ? "text-white border-b-2 border-amber-400 bg-amber-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
                  role="tab"
                  aria-selected={activeTab === "decrypt" ? "true" : "false"}
                  aria-controls="decrypt-panel"
                  id="decrypt-tab"
                >
                  Decrypt
                </button>
                <button
                  onClick={() => {
                    setActiveTab("edit");
                    setIsEditMode(true);
                    setIsUseMode(false);
                    setIsMetaEditMode(false);
                    setIsBlakEditMode(false);
                  }}
                  className={`px-4 py-2 text-[13px] font-medium ${activeTab === "edit" ? "text-white border-b-2 border-purple-400 bg-purple-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
                  role="tab"
                  aria-selected={activeTab === "edit" ? "true" : "false"}
                  aria-controls="edit-panel"
                  id="edit-tab"
                >
                  Edit
                </button>
                <button
                  onClick={() => setActiveTab("activate")}
                  className={`px-4 py-2 text-[13px] font-medium ${activeTab === "activate" ? "text-white border-b-2 border-purple-500 bg-purple-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
                  role="tab"
                  aria-selected={activeTab === "activate" ? "true" : "false"}
                  aria-controls="activate-panel"
                  id="activate-tab"
                >
                  Activate
                </button>
              </>
            )}
          </div>
          
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SubmenuDrawer;
