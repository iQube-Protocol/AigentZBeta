"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, ReactNode } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Home, 
  Users, 
  Database, 
  FileText, 
  Settings,
  ToggleRight,
  ToggleLeft,
  Box,
  Key,
  Eye,
  Lock,
  CreditCard,
  BarChart,
  PlusCircle,
  UserCircle,
  Brain,
  Package,
  Bot
} from "lucide-react";

interface SidebarItem {
  href: string;
  label: string;
  icon: ReactNode;
  toggleable?: boolean;
  active?: boolean;
}

interface SidebarSection {
  label: string;
  icon: ReactNode;
  items: SidebarItem[];
}

type SectionData = typeof sections;

const sections = [
  {
    label: "Dashboard",
    icon: <Home size={16} />,
    items: [{ href: "/dashboard", label: "Dashboard", icon: <Home size={14} /> }],
  },
  {
    label: "Persona",
    icon: <Users size={16} />,
    items: [
      { href: "/aigents/generic-ai?iqube=qrypto", label: "Qrypto Persona", icon: <Users size={14} className="text-cyan-400" />, toggleable: true, active: false },
      { href: "/aigents/generic-ai?iqube=knyt", label: "KNYT Persona", icon: <Users size={14} className="text-amber-400" />, toggleable: true, active: false },
    ],
  },
  {
    label: "Orchestrator Aigent",
    icon: <Bot size={16} />,
    items: [
      { href: "/aigents/generic-ai", label: "Generic AI (Default)", icon: <Bot size={14} className="text-blue-400" /> },
      { href: "/aigents/bitcoin-advisor", label: "Bitcoin Advisor", icon: <Bot size={14} className="text-orange-400" /> },
      { href: "/aigents/guardian-agent", label: "Guardian Agent", icon: <Bot size={14} className="text-green-400" /> },
      { href: "/aigents/crypto-analyst", label: "Crypto Analyst", icon: <Bot size={14} className="text-purple-400" /> },
      { href: "/aigents/agentic-coach", label: "Agentic Coach", icon: <Bot size={14} className="text-red-400" /> },
    ],
  },
  {
    label: "iQubes",
    icon: <Box size={16} />,
    items: [
      { href: "/aigents/generic-ai?iqube=openai", label: "OpenAI", icon: <Brain size={14} className="text-emerald-400" />, toggleable: true, active: false },
      { href: "/aigents/generic-ai?iqube=venice", label: "Venice", icon: <Brain size={14} className="text-indigo-400" />, toggleable: true, active: false },
    ],
  },
  {
    label: "iQube Operations",
    // Custom SVG for integrations-style icon
    icon: (
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
        {/* Integrations-style icon with connected nodes */}
        <rect x="3" y="3" width="5" height="5" rx="1" />
        <rect x="16" y="3" width="5" height="5" rx="1" />
        <rect x="3" y="16" width="5" height="5" rx="1" />
        <rect x="16" y="16" width="5" height="5" rx="1" />
        <path d="M8 6h8" />
        <path d="M6 8v8" />
        <path d="M18 8v8" />
        <path d="M8 18h8" />
      </svg>
    ),
    items: [
      { href: "/iqube/enter-id", label: "Enter iQube ID", icon: <Key size={14} /> },
      { href: "/iqube/activate", label: "Activate", icon: <ToggleRight size={14} /> },
      { href: "/iqube/view", label: "View", icon: <Eye size={14} /> },
      { href: "/iqube/decrypt", label: "Decrypt", icon: <Lock size={14} /> },
      { href: "/iqube/mint", label: "Mint", icon: <CreditCard size={14} /> },
    ],
  },
  {
    label: "Registry",
    icon: <FileText size={16} />,
    items: [
      { href: "/registry", label: "Registry", icon: <FileText size={14} /> },
      { href: "/registry/add", label: "Add iQube", icon: <PlusCircle size={14} /> },
      { href: "/registry/analytics", label: "Analytics", icon: <BarChart size={14} /> },
    ],
  },
  {
    label: "Settings",
    icon: <Settings size={16} />,
    items: [
      { href: "/settings/profile", label: "Profile", icon: <UserCircle size={14} /> },
    ],
  },
];

// Safe local storage helper functions
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      console.error(`Error accessing localStorage.getItem for key: ${key}`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
        return true;
      }
      return false;
    } catch (e) {
      console.error(`Error accessing localStorage.setItem for key: ${key}`, e);
      return false;
    }
  }
};

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Track the current path to detect navigation changes
  const [previousPath, setPreviousPath] = useState("");
  
  // Ensure client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load sidebar collapsed state
  useEffect(() => {
    if (!isClient) return;
    
    // Check if storage is available
    try {
      // Try a test operation
      const testKey = '__test_storage__';
      safeLocalStorage.setItem(testKey, 'test');
      safeLocalStorage.getItem(testKey);
      setStorageAvailable(true);
    } catch (e) {
      console.error('localStorage is not available:', e);
      setStorageAvailable(false);
    }
  }, [isClient]);
  
  // Load sidebar state after storage availability is checked
  useEffect(() => {
    // Only proceed if we've determined if storage is available or not
    if (storageAvailable === null) return;
    
    try {
      console.log('=== LOADING SIDEBAR STATE ===');
      // Initialize default values first
      const initialShowOnlyActive: Record<string, boolean> = {};
      sections.forEach(section => {
        initialShowOnlyActive[section.label] = true; // Default to showing only active items
      });
      
      // Load collapsed state
      let sidebarCollapsed = false;
      const savedCollapsed = safeLocalStorage.getItem('sidebarCollapsed');
      if (savedCollapsed) {
        try {
          sidebarCollapsed = JSON.parse(savedCollapsed);
        } catch (e) {
          console.error('Error parsing sidebarCollapsed:', e);
        }
      }
      
      // Only include sections with active items or from localStorage
      let initialOpenSections: string[] = [];
      const savedOpenSections = safeLocalStorage.getItem('openSections');
      if (savedOpenSections) {
        try {
          initialOpenSections = JSON.parse(savedOpenSections);
        } catch (e) {
          console.error('Error parsing openSections:', e);
        }
      }

      // Initialize toggle states
      const initialToggles: Record<string, boolean> = {};
      sections.forEach(section => {
        section.items.forEach(item => {
          if ('toggleable' in item && item.toggleable) {
            const isActive = 'active' in item ? !!item.active : false;
            initialToggles[item.href] = isActive;
          }
        });
      });
      
      const savedToggleStates = safeLocalStorage.getItem('toggleStates');
      console.log('Saved toggle states from localStorage:', savedToggleStates);
      
      // CRITICAL FIX: Load agent states separately to ensure they're not lost during navigation
      const savedAgentStates = safeLocalStorage.getItem('agentStates');
      console.log('Saved agent states from localStorage:', savedAgentStates);
      
      if (savedToggleStates) {
        try {
          const parsedToggleStates = JSON.parse(savedToggleStates);
          console.log('Parsed toggle states:', parsedToggleStates);
          
          // Log persona toggle states specifically
          const personaHrefs = sections
            .find(section => section.label === "Persona")
            ?.items.map(item => item.href) || [];
          
          console.log('Persona hrefs:', personaHrefs);
          personaHrefs.forEach(href => {
            console.log(`Persona ${href} state from localStorage:`, parsedToggleStates[href]);
          });
          
          // Apply toggle states from localStorage
          Object.assign(initialToggles, parsedToggleStates);
        } catch (e) {
          console.error('Error parsing toggleStates:', e);
        }
      }
      
      // CRITICAL FIX: Apply agent states from separate storage to ensure they're preserved
      if (savedAgentStates) {
        try {
          console.log('CRITICAL FIX: Loading agent states during navigation');
          const parsedAgentStates: Record<string, boolean> = JSON.parse(savedAgentStates);
          
          // Get all agent hrefs
          const agentHrefs: string[] = sections
            .find(section => section.label === "Orchestrator Aigent")
            ?.items.map(item => item.href) || [];
          
          console.log('Agent hrefs:', agentHrefs);
          
          // Apply agent states from separate storage
          agentHrefs.forEach(href => {
            // Access agent state with proper typing
            if (href in parsedAgentStates) {
              const agentState = parsedAgentStates[href];
              console.log(`CRITICAL FIX: Restoring agent ${href} state:`, agentState);
              initialToggles[href] = agentState;
            }
          });
        } catch (e) {
          console.error('Error parsing agentStates:', e);
        }
      }
      
      // Initialize showOnlyActive state from localStorage or defaults
      const savedShowOnlyActive = safeLocalStorage.getItem('showOnlyActive');
      if (savedShowOnlyActive) {
        try {
          const parsedShowOnlyActive = JSON.parse(savedShowOnlyActive);
          // Ensure all sections are initialized with a default value
          sections.forEach(section => {
            // If section doesn't exist in saved state, default to true (show only active)
            if (parsedShowOnlyActive[section.label] === undefined) {
              parsedShowOnlyActive[section.label] = true;
            }
          });
          Object.assign(initialShowOnlyActive, parsedShowOnlyActive);
        } catch (e) {
          console.error('Error parsing showOnlyActive:', e);
        }
      }
      
      // Set all states at once to avoid multiple renders
      setCollapsed(sidebarCollapsed);
      setOpenSections(initialOpenSections);
      setToggleStates(initialToggles);
      setShowOnlyActive(initialShowOnlyActive);
      
      // Mark initialization as complete
      setInitialized(true);
    } catch (error) {
      console.error('Error loading sidebar state:', error);
      // Set up defaults if anything goes wrong
      setOpenSections(sections.map(s => s.label));
      initDefaultToggleStates();
      initDefaultShowOnlyActive();
      setInitialized(true);
    }
  }, [storageAvailable]);
  
  // Helper function to initialize default toggle states
  const initDefaultToggleStates = () => {
    const initialToggles: Record<string, boolean> = {};
    sections.forEach(section => {
      section.items.forEach(item => {
        if ('toggleable' in item && item.toggleable) {
          const isActive = 'active' in item ? !!item.active : false;
          initialToggles[item.href] = isActive;
        }
      });
    });
    setToggleStates(initialToggles);
  };
  
  // Helper function to initialize default showOnlyActive states
  const initDefaultShowOnlyActive = () => {
    const initialShowOnlyActive: Record<string, boolean> = {};
    sections.forEach(section => {
      initialShowOnlyActive[section.label] = true; // Default to showing only active items
    });
    setShowOnlyActive(initialShowOnlyActive);
    
    // Also save to localStorage to ensure consistency on page refresh
    if (storageAvailable) {
      safeLocalStorage.setItem('showOnlyActive', JSON.stringify(initialShowOnlyActive));
    }
  };
  
  // Save open sections state when it changes
  useEffect(() => {
    if (storageAvailable) {
      safeLocalStorage.setItem('openSections', JSON.stringify(openSections));
    }
  }, [openSections, storageAvailable]);

  // Save toggle states when they change
  useEffect(() => {
    if (storageAvailable) {
      console.log('=== SAVING TOGGLE STATES ===');
      console.log('Current toggle states being saved:', toggleStates);
      
      // Log persona toggle states specifically
      const personaHrefs = sections
        .find(section => section.label === "Persona")
        ?.items.map(item => item.href) || [];
      
      // Get all agent hrefs
      const agentHrefs: string[] = sections
        .find(section => section.label === "Orchestrator Aigent")
        ?.items.map(item => item.href) || [];
      
      console.log('Persona hrefs:', personaHrefs);
      personaHrefs.forEach(href => {
        // Safely log toggleStates with proper typing
        console.log(`Saving persona ${href} state:`, href in toggleStates ? toggleStates[href] : false);
      });
      
      // Log agent states being saved
      console.log('Agent hrefs:', agentHrefs);
      agentHrefs.forEach(href => {
        // Safely log toggleStates with proper typing
        console.log(`Saving agent ${href} state:`, href in toggleStates ? toggleStates[href] : false);
      });
      
      // CRITICAL FIX: Save agent states separately to prevent navigation issues
      const agentStates: Record<string, boolean> = {};
      agentHrefs.forEach(href => {
        // Safely access toggleStates with proper typing
        agentStates[href] = href in toggleStates ? toggleStates[href] : false;
      });
      safeLocalStorage.setItem('agentStates', JSON.stringify(agentStates));
      
      safeLocalStorage.setItem('toggleStates', JSON.stringify(toggleStates));
    }
  }, [toggleStates, storageAvailable]);
  
  // Save showOnlyActive state when it changes
  useEffect(() => {
    if (storageAvailable) {
      safeLocalStorage.setItem('showOnlyActive', JSON.stringify(showOnlyActive));
    }
  }, [showOnlyActive, storageAvailable]);
  
  // Effect to handle path changes and maintain state consistency
  useEffect(() => {
    // Only run this effect when the path actually changes
    if (previousPath !== pathname) {
      console.log('=== PATH CHANGE DETECTED ===');
      console.log('Previous path:', previousPath);
      console.log('New path:', pathname);
      
      setPreviousPath(pathname);
      
      // Find which section the current path belongs to
      let currentSection = '';
      for (const section of sections) {
        for (const item of section.items) {
          if (pathname.startsWith(item.href)) {
            currentSection = section.label;
            break;
          }
        }
        if (currentSection) break;
      }
      
      // If we found a section for this path, ensure it's open
      if (currentSection && !openSections.includes(currentSection)) {
        setOpenSections(prev => [...prev, currentSection]);
      }
      
      // CRITICAL FIX: Ensure agent states are preserved during navigation
      const savedAgentStates = safeLocalStorage.getItem('agentStates');
      if (savedAgentStates) {
        try {
          console.log('CRITICAL FIX: Loading agent states during navigation');
          const parsedAgentStates: Record<string, boolean> = JSON.parse(savedAgentStates);
          
          // Get all agent hrefs
          const agentHrefs: string[] = sections
            .find(section => section.label === "Orchestrator Aigent")
            ?.items.map(item => item.href) || [];
          
          // Check if we need to update toggle states with preserved agent states
          let needsUpdate = false;
          const agentUpdates: Record<string, boolean> = {};
          
          agentHrefs.forEach(href => {
            // Access agent state with proper typing
            if (href in parsedAgentStates && 
                toggleStates[href] !== parsedAgentStates[href]) {
              needsUpdate = true;
              agentUpdates[href] = parsedAgentStates[href];
              console.log(`CRITICAL FIX: Restoring agent ${href} state during navigation:`, parsedAgentStates[href]);
            }
          });
          
          // Only update if there are differences
          if (needsUpdate) {
            console.log('CRITICAL FIX: Updating toggle states with preserved agent states');
            setToggleStates(prev => ({
              ...prev,
              ...agentUpdates
            }));
          }
        } catch (e) {
          console.error('Error parsing agentStates during navigation:', e);
        }
      }
      
      // Maintain the showOnlyActive state when navigating
      // This ensures the collapsed menu item display logic persists
      const savedShowOnlyActive = safeLocalStorage.getItem('showOnlyActive');
      if (savedShowOnlyActive) {
        try {
          const parsedState = JSON.parse(savedShowOnlyActive);
          setShowOnlyActive(parsedState);
        } catch (e) {
          console.error('Error parsing showOnlyActive:', e);
        }
      }
    }
  }, [pathname, previousPath, openSections, toggleStates]);
  
  // Effect to ensure ONLY sections with active toggle items are kept open
  useEffect(() => {
    // Don't modify sections if we're still in initialization
    if (!initialized || !isClient) return;
    
    // Check all sections for active toggle items
    const sectionsWithActiveItems: string[] = [];
    let currentPathSection = "";
    
    // First determine which section contains the current path
    for (const section of sections) {
      for (const item of section.items) {
        if (pathname.startsWith(item.href)) {
          currentPathSection = section.label;
          break;
        }
      }
      if (currentPathSection) break;
    }
    
    // Find sections with active toggle items
    for (const section of sections) {
      // Skip Dashboard section
      if (section.label === "Dashboard") continue;
      
      // Check if any item in this section is active
      const hasActiveItem = section.items.some(item => {
        const isToggleable = 'toggleable' in item && item.toggleable;
        return isToggleable && toggleStates[item.href];
      });
      
      if (hasActiveItem) {
        sectionsWithActiveItems.push(section.label);
      }
    }
    
    // If we're in expanded view, only keep active sections open
    if (!collapsed) {
      // Include the section for current path if it exists
      if (currentPathSection && !sectionsWithActiveItems.includes(currentPathSection)) {
        sectionsWithActiveItems.push(currentPathSection);
      }
      
      // Update open sections to ONLY include those with active items or current path
      setOpenSections(sectionsWithActiveItems);
      
      // Save to localStorage
      if (storageAvailable) {
        safeLocalStorage.setItem('openSections', JSON.stringify(sectionsWithActiveItems));
      }
    }
  }, [toggleStates, pathname, initialized, collapsed, sections, storageAvailable, isClient]);
  
  const toggleSection = (label: string) => {
    if (collapsed) {
      // In collapsed mode, toggle between showing all icons or only active ones
      setShowOnlyActive(prev => ({
        ...prev,
        [label]: !prev[label]
      }));
      return;
    }
    
    if (openSections.includes(label)) {
      // Close the section
      setOpenSections(openSections.filter(s => s !== label));
    } else {
      // Open the section
      setOpenSections([...openSections, label]);
    }
  };

  const toggleItemState = (href: string) => {
    setToggleStates(prev => ({
      ...prev,
      [href]: !prev[href]
    }));
  };

  const handlePersonaClick = (href: string) => {
    console.log('=== PERSONA CLICK DEBUG ===');
    console.log('Clicked persona href:', href);
    
    // CRITICAL FIX: Force-save agent states before toggling persona
    if (storageAvailable) {
      // Get all agent hrefs
      const agentHrefs: string[] = sections
        .find(section => section.label === "Orchestrator Aigent")
        ?.items.map(item => item.href) || [];
      
      const agentStates: Record<string, boolean> = {};
      agentHrefs.forEach(href => {
        agentStates[href] = toggleStates[href] || false;
      });
      
      console.log('CRITICAL FIX: Force-saving agent states before persona change:', agentStates);
      safeLocalStorage.setItem('agentStates', JSON.stringify(agentStates));
    }
    
    // Get all persona hrefs
    const personaHrefs: string[] = sections
      .find(section => section.label === "Persona")
      ?.items.map(item => item.href) || [];
    
    // Get all agent hrefs
    const agentHrefs: string[] = sections
      .find(section => section.label === "Orchestrator Aigent")
      ?.items.map(item => item.href) || [];
    
    console.log('All persona hrefs:', personaHrefs);
    console.log('All agent hrefs:', agentHrefs);
    
    // Find the Generic AI href
    const genericAiHref = agentHrefs.find(agentHref => 
      agentHref.includes('/aigents/generic-ai'));
    
    console.log('Generic AI href:', genericAiHref);
    
    // Check if the current persona is already active
    const isCurrentPersonaActive = toggleStates[href];
    console.log('Is current persona active?', isCurrentPersonaActive);
    
    // Check if any agent is currently active (excluding Generic AI)
    const hasActiveNonGenericAgent = agentHrefs.some(agentHref => 
      toggleStates[agentHref] && !agentHref.includes('/aigents/generic-ai'));
    
    // Find which specific agent is active (if any)
    const activeAgents = agentHrefs.filter(agentHref => toggleStates[agentHref]);
    console.log('Currently active agents:', activeAgents);
    
    // CRITICAL FIX: Check if the clicked persona is actually an agent
    const isPersonaActuallyAgent = agentHrefs.includes(href);
    
    console.log('Has active non-generic agent?', hasActiveNonGenericAgent);
    
    // Create an object with all persona items set to false
    const resetPersonas = personaHrefs.reduce((acc, personaHref) => {
      acc[personaHref] = false;
      return acc;
    }, {} as Record<string, boolean>);
    
    console.log('Reset personas object:', resetPersonas);
    
    // Store active agent state before making changes for comparison later
    const activeAgentsBefore = agentHrefs.filter(agentHref => toggleStates[agentHref]);
    console.log('Active agents BEFORE persona click:', activeAgentsBefore);
    
    // Find active non-Generic AI agent (if any)
    const activeNonGenericAgent = agentHrefs.find(agentHref => 
      toggleStates[agentHref] && !agentHref.includes('/aigents/generic-ai'));
    console.log('Active non-Generic AI agent:', activeNonGenericAgent);
    
    // CRITICAL DEBUG: Create a snapshot of all agent states before any changes
    const agentStateSnapshot: Record<string, boolean> = {};
    agentHrefs.forEach(agentHref => {
      agentStateSnapshot[agentHref] = agentHref in toggleStates ? toggleStates[agentHref] : false;
    });
    console.log('CRITICAL DEBUG: Agent state snapshot before changes:', agentStateSnapshot);
    
    // If we're clicking an already active persona, deactivate it
    // Otherwise, activate the clicked persona and Generic AI only if no other agent is active
    setToggleStates(prev => {
      console.log('Previous state in setToggleStates:', prev);
      console.log('Is persona actually agent?', isPersonaActuallyAgent);
      
      if (isCurrentPersonaActive) {
        // Deactivate the clicked persona
        const newState = {
          ...prev,
          [href]: false
        };
        console.log('Deactivating persona, new state:', newState);
        return newState;
      } else {
        // CRITICAL FIX: Create a completely new state object to avoid reference issues
        // Start with a clean slate
        const newState: Record<string, boolean> = {};
        
        // First, copy ALL existing toggle states from previous state
        Object.keys(prev).forEach(key => {
          newState[key] = prev[key];
        });
        
        console.log('CRITICAL DEBUG: Complete state copy created:', {...newState});
        
        // Now apply our persona reset (set all personas to false)
        personaHrefs.forEach(personaHref => {
          newState[personaHref] = false;
        });
        
        // Set the clicked persona to active
        newState[href] = true;
        
        console.log('CRITICAL DEBUG: After persona reset and activation:', {...newState});
        
        // CRITICAL FIX: Explicitly restore agent states from our snapshot
        // This ensures agent states are preserved exactly as they were
        Object.keys(agentStateSnapshot).forEach(agentHref => {
          // Only restore agent states - Generic AI is never auto-activated
          if (!agentHref.includes('/aigents/generic-ai')) {
            // For non-Generic AI agents, always preserve their state
            newState[agentHref] = agentStateSnapshot[agentHref];
            console.log(`CRITICAL DEBUG: Preserving ${agentHref} state as ${agentStateSnapshot[agentHref]}`);
          } else if (genericAiHref) {
            // MODIFIED: Never auto-activate Generic AI, always preserve its current state
            newState[agentHref] = agentStateSnapshot[agentHref];
            console.log(`CRITICAL DEBUG: Keeping Generic AI state as ${agentStateSnapshot[agentHref]}`);
          }
        });
        
        // Final verification of agent states
        const finalAgentStates: Record<string, boolean> = {};
        agentHrefs.forEach(agentHref => {
          finalAgentStates[agentHref] = newState[agentHref];
        });
        console.log('CRITICAL DEBUG: Final agent states:', finalAgentStates);
        console.log('CRITICAL DEBUG: Original agent states:', agentStateSnapshot);
        
        // Log which agent states are being preserved
        if (hasActiveNonGenericAgent && activeNonGenericAgent) {
          console.log(`Preserving active agent state for: ${activeNonGenericAgent}`);
          console.log(`Agent will remain active: ${newState[activeNonGenericAgent]}`);
        }
        
        console.log('Activating persona, new state:', newState);
        console.log('Should activate Generic AI?', !hasActiveNonGenericAgent);
        return newState;
      }
    });
    
    // After state updates, navigate to the appropriate page with persona as query parameter
    navigateToAgentWithPersona(href);
    
    console.log('=== END PERSONA CLICK DEBUG ===');
  };
  
  // Function to handle navigation to agent page with persona as query parameter
  const navigateToAgentWithPersona = (personaHref: string) => {
    // Extract persona name from href (e.g., "/aigents/generic-ai?iqube=qrypto" -> "qrypto")
    const personaName = personaHref.split('=')[1];
    
    // Get all agent hrefs
    const agentHrefs: string[] = sections
      .find(section => section.label === "Orchestrator Aigent")
      ?.items.map(item => item.href) || [];
      
    // Find the Generic AI href
    const genericAiHref = agentHrefs.find(agentHref => 
      agentHref.includes('/aigents/generic-ai'));
    
    // Find active non-Generic AI agent (if any)
    const activeNonGenericAgent = agentHrefs.find(agentHref => 
      toggleStates[agentHref] && !agentHref.includes('/aigents/generic-ai'));
    
    // Find the active agent or use Generic AI as fallback
    let activeAgentHref = activeNonGenericAgent || genericAiHref;
    
    // If no agent is active, use Generic AI
    if (!activeAgentHref && genericAiHref) {
      activeAgentHref = genericAiHref;
    }
    
    // If we have an active agent and a persona name, navigate to that agent with the persona as query param
    if (activeAgentHref && personaName) {
      console.log(`Navigating to ${activeAgentHref} with persona=${personaName}`);
      router.push(`${activeAgentHref}?persona=${personaName}`);
    }
  };

  
  const handleModelQubeClick = (href: string) => {
    // Get all iQube hrefs
    const iQubeHrefs = sections
      .find(section => section.label === "iQubes")
      ?.items.map(item => item.href) || [];
    
    // Check if the current iQube is already active
    const isCurrentQubeActive = toggleStates[href];
    
    // Create an object with all iQube items set to false
    const resetIQubes = iQubeHrefs.reduce((acc, iQubeHref) => {
      acc[iQubeHref] = false;
      return acc;
    }, {} as Record<string, boolean>);
    
    // If we're clicking an already active iQube, deactivate it
    // Otherwise, activate the clicked iQube
    setToggleStates(prev => {
      if (isCurrentQubeActive) {
        // Deactivate the clicked iQube
        return {
          ...prev,
          [href]: false
        };
      } else {
        // Activate the clicked iQube
        return {
          ...prev,
          ...resetIQubes,
          [href]: true
        };
      }
    });
  };
  
  const toggleSidebar = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    
    // When collapsing the sidebar, ensure all sections show only active items
    if (newState) { // newState is true when collapsing
      const updatedShowOnlyActive: Record<string, boolean> = {};
      sections.forEach(section => {
        updatedShowOnlyActive[section.label] = true;
      });
      setShowOnlyActive(updatedShowOnlyActive);
      
      if (storageAvailable) {
        safeLocalStorage.setItem('showOnlyActive', JSON.stringify(updatedShowOnlyActive));
      }
    }
    
    if (storageAvailable) {
      safeLocalStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
    }
  };

  useEffect(() => {
    // keyboard shortcuts: g d / g r / g s / g a
    let gPressed = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "g") { gPressed = true; return; }
      if (gPressed) {
        if (e.key.toLowerCase() === "d") location.href = "/dashboard";
        if (e.key.toLowerCase() === "r") location.href = "/registry";
        if (e.key.toLowerCase() === "s") location.href = "/settings/profile";
        if (e.key.toLowerCase() === "a") location.href = "/aigents";
        gPressed = false;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Show a minimal placeholder during initialization to prevent UI jumping
  if (!initialized || !isClient) {
    return <aside className="w-16 transition-all duration-200 bg-black/30 ring-1 ring-white/10 backdrop-blur-xl p-4 md:p-6 flex-shrink-0 min-h-screen"></aside>;
  }
  
  return (
    <aside className={`${collapsed ? "w-16" : "w-72"} transition-all duration-200 bg-black/30 ring-1 ring-white/10 backdrop-blur-xl p-4 md:p-6 flex-shrink-0 min-h-screen`}>
      <button className="mb-4 text-xs text-slate-300 hover:text-white" onClick={toggleSidebar}>
        {collapsed ? "»" : "« Collapse"}
      </button>
      <nav className="space-y-6">
        {sections.map((section) => {
          const isDashboard = section.label === "Dashboard";
          
          return (
            <div key={section.label}>
              {/* Dashboard section is always shown */}
              {isDashboard ? (
                <div className="uppercase text-[11px] tracking-wider text-slate-400 mb-3 flex items-center group">
                  <div className="flex items-center justify-between w-full">
                    <Link 
                      href="/dashboard"
                      className="flex items-center gap-2 text-slate-100 hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{section.icon}</span>
                        {!collapsed && <span className="font-medium">{section.label}</span>}
                      </div>
                    </Link>
                  </div>
                </div>
              ) : (
                <div 
                  className={`uppercase text-[11px] tracking-wider text-slate-400 mb-3 flex items-center cursor-pointer group`}
                  onClick={() => toggleSection(section.label)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{section.icon}</span>
                      {!collapsed && <span className="font-medium">{section.label}</span>}
                    </div>
                    {!collapsed && (openSections.includes(section.label) ? (
                      <ChevronDown size={14} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-500" />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Expanded view for non-Dashboard sections */}
              {openSections.includes(section.label) && !collapsed && !isDashboard && (
                <ul className="space-y-1 mb-4">
                  {section.items
                    .map((item: SidebarItem) => {
                      const active = pathname.startsWith(item.href);
                      const isToggleable = 'toggleable' in item && item.toggleable;
                      const isItemActive = isToggleable ? toggleStates[item.href] : false;
                      
                      return (
                        <li key={item.href} className="flex items-center justify-between">
                          <div className={`flex items-center justify-between w-full ${active || isItemActive ? 'bg-slate-700/50 text-slate-100 rounded-xl' : 'text-slate-500 hover:text-slate-300'}`}>
                            <Link
                              href={item.href}
                              className="flex items-center w-full px-3 py-2"
                              onClick={(e) => {
                                if (isToggleable) {
                                  const sectionLabel = sections.find(section => 
                                    section.items.some(i => i.href === item.href)
                                  )?.label;
                                  
                                  if (sectionLabel === "Persona") {
                                    // Prevent navigation for personas
                                    e.preventDefault();
                                    handlePersonaClick(item.href);
                                  } else if (sectionLabel === "iQubes") {
                                    handleModelQubeClick(item.href);
                                  }
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>{item.icon}</span>
                                <span className="text-[13px]">{item.label}</span>
                              </div>
                            </Link>
                            {isToggleable && (
                            <button 
                              className="p-2"
                              onClick={(e) => {
                                e.preventDefault();
                                const sectionLabel = sections.find(section => 
                                  section.items.some(i => i.href === item.href)
                                )?.label;
                                if (sectionLabel === "Persona") {
                                  handlePersonaClick(item.href);
                                } else if (sectionLabel === "iQubes") {
                                  handleModelQubeClick(item.href);
                                } else {
                                  setToggleStates(prev => ({
                                    ...prev,
                                    [item.href]: !prev[item.href]
                                  }));
                                }
                              }}
                            >
                              <div className="mr-2 text-slate-400 hover:text-white transition-colors">
                                {isItemActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                              </div>
                            </button>
                          )}
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
              
              {/* Collapsed view for non-Dashboard sections - only show filtered submenu items */}
              {collapsed && !isDashboard && (
                <div>
                  {/* Only show submenu items, filtered based on showOnlyActive state */}
                  {section.items
                    .filter(item => {
                      // If showOnlyActive is true for this section, only show active items
                      // Otherwise show all items
                      const isToggleable = 'toggleable' in item && item.toggleable;
                      const isItemActive = isToggleable ? toggleStates[item.href] : false;
                      const active = pathname.startsWith(item.href);
                      
                      return !showOnlyActive[section.label] || isItemActive || active;
                    })
                    .map((item: SidebarItem) => {
                      const active = pathname.startsWith(item.href);
                      const isToggleable = 'toggleable' in item && item.toggleable;
                      const isItemActive = isToggleable ? toggleStates[item.href] : false;
                      
                      return (
                        <div key={item.href} className="flex justify-center mb-2 relative">
                          <Link
                            href={item.href}
                            className={`flex items-center justify-center rounded-xl p-2 text-[13px] hover:bg-slate-700/50 ${active || isItemActive ? "bg-slate-700/50" : "bg-transparent"}`}
                            title={item.label}
                            onClick={(e) => {
                              if (isToggleable) {
                                const sectionLabel = sections.find(section => 
                                  section.items.some(i => i.href === item.href)
                                )?.label;
                                
                                if (sectionLabel === "Persona") {
                                  // Prevent navigation for personas
                                  e.preventDefault();
                                  handlePersonaClick(item.href);
                                } else if (sectionLabel === "iQubes") {
                                  handleModelQubeClick(item.href);
                                }
                              }
                            }}
                          >
                            {item.icon}
                          </Link>
                          {isToggleable && isItemActive && (
                            <div className="absolute top-0 right-0 h-2 w-2 rounded-full bg-green-500 mr-1 mt-1"></div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
