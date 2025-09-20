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
  Wrench,
  Bot,
  Grid3X3,
  SlidersHorizontal
} from "lucide-react";
import { SubmenuDrawer } from "./SubmenuDrawer";

interface SidebarItem {
  href: string;
  label: string;
  icon: ReactNode;
  toggleable?: boolean;
  active?: boolean;
  isTextInput?: boolean;
  drawerAction?: 'view' | 'decrypt' | 'mint' | 'activate';
}

interface SidebarSection {
  label: string;
  icon: ReactNode;
  items: SidebarItem[];
}

// Grouped iQubes items (render-only grouping will be applied below)
const IQUBES_ACTIVE_ITEMS: SidebarItem[] = [
  { href: "#openai", label: "OpenAI", icon: <Brain size={14} className="text-emerald-400" />, toggleable: true, active: false },
  { href: "#venice", label: "Venice AI", icon: <Brain size={14} className="text-indigo-400" />, toggleable: true, active: false },
  { href: "#chaingpt", label: "ChainGPT", icon: <Brain size={14} className="text-purple-400" />, toggleable: true, active: false },
  { href: "#google-workspace", label: "Google Workspace", icon: <Wrench size={14} className="text-blue-500" />, toggleable: true, active: false },
];

const IQUBE_OPS_ITEMS: SidebarItem[] = [
  { href: "#iqube-template", label: "iQube Template", icon: <Box size={14} className="text-blue-400" />, toggleable: true, active: true },
  { href: "#iqube-instance", label: "iQube Instance", icon: <Box size={14} className="text-green-400" />, toggleable: true, active: false },
  { href: "/iqube/enter-id", label: "Enter iQube ID", icon: <Key size={14} />, isTextInput: true },
];

const IQUBE_REGISTRY_ITEMS: SidebarItem[] = [
  { href: "/registry", label: "Registry", icon: <FileText size={14} /> },
  { href: "/registry/add", label: "Add iQube", icon: <PlusCircle size={14} /> },
  { href: "/registry/analytics", label: "Analytics", icon: <BarChart size={14} /> },
];

// Feature flags: default to true unless explicitly set to 'false'
const FEATURE_OPS = process.env.NEXT_PUBLIC_FEATURE_OPS !== 'false';

const sections: SidebarSection[] = [
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
      { href: "/aigents/generic-ai?iqube=metaMe", label: "metaMe Persona", icon: <Users size={14} className="text-purple-400" />, toggleable: true, active: false },
    ],
  },
  {
    label: "Orchestrator",
    icon: <Bot size={16} />,
    items: [
      { href: "/aigents/aigent-z", label: "Aigent Z (System AI)", icon: <Bot size={14} className="text-blue-400" /> },
      { href: "/aigents/aigent-nakamoto", label: "Aigent Nakamoto", icon: <Bot size={14} className="text-orange-400" /> },
      { href: "/aigents/aigent-kn0w1", label: "Aigent Kn0w1", icon: <Bot size={14} className="text-green-400" /> },
    ],
  },
  {
    label: "iQubes",
    icon: <Box size={16} />,
    items: [
      ...IQUBES_ACTIVE_ITEMS,
      ...IQUBE_OPS_ITEMS,
      ...IQUBE_REGISTRY_ITEMS,
    ],
  },
  {
    label: "Settings",
    icon: <Settings size={16} />,
    items: [
      { href: "/settings/profile", label: "Profile", icon: <UserCircle size={14} /> },
      { href: "/ops", label: "Network Ops", icon: <Wrench size={14} className="text-blue-400" /> },
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
  const [iQubeId, setIQubeId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<"view" | "decrypt" | "mint" | "activate">("view");
  // Nested groups inside iQubes section
  const [openIQubesGroups, setOpenIQubesGroups] = useState<Record<string, boolean>>({
    "Active iQubes": false,
    "iQube Operations": false,
    "iQube Registry": false,
  });
  
  // Track the current path to detect navigation changes
  const [previousPath, setPreviousPath] = useState("");
  
  // Ensure client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load sidebar collapsed state
  useEffect(() => {
    if (!isClient) return;
    
    console.log('Checking storage availability...');
    
    // Check if storage is available
    try {
      // Try a test operation
      const testKey = '__test_storage__';
      safeLocalStorage.setItem(testKey, 'test');
      safeLocalStorage.getItem(testKey);
      console.log('Storage is available');
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
    
    console.log('Loading sidebar state, storageAvailable:', storageAvailable);
    
    // Load saved iQube ID if available
    const savedIQubeId = safeLocalStorage.getItem('iQubeId');
    if (savedIQubeId) {
      setIQubeId(savedIQubeId);
    }
    
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
            .find(section => section.label === "Orchestrator")
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
      setOpenSections(initialOpenSections || []);
      setToggleStates(initialToggles);
      setShowOnlyActive(initialShowOnlyActive);
      
      // Mark initialization as complete
      setInitialized(true);
    } catch (error) {
      console.error('Error loading sidebar state:', error);
      // Set up defaults if anything goes wrong
      setOpenSections([]);
      initDefaultToggleStates();
      initDefaultShowOnlyActive();
      setInitialized(true);
    }
  }, [storageAvailable]);
  
  // Helper function to initialize default toggle states
  const initDefaultToggleStates = () => {
    // Initialize toggle states for items marked as toggleable
    const initialToggles: Record<string, boolean> = {};
    sections.forEach(section => {
      section.items.forEach(item => {
        if ('toggleable' in item && item.toggleable) {
          const isActive = 'active' in item ? !!item.active : false;
          initialToggles[item.href] = isActive;
        }
      });
    });
    
    // Ensure iQube Template/Instance have proper initial states
    initialToggles['#iqube-template'] = true;
    initialToggles['#iqube-instance'] = false;
    
    console.log('Initial toggle states:', initialToggles);
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

  // Persist nested iQubes group open state
  useEffect(() => {
    if (storageAvailable) {
      safeLocalStorage.setItem('openIQubesGroups', JSON.stringify(openIQubesGroups));
    }
  }, [openIQubesGroups, storageAvailable]);

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
        .find(section => section.label === "Orchestrator")
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
      
      if (pathname) {
        setPreviousPath(pathname);
      }
      
      // Find which section the current path belongs to
      let currentSection = '';
      if (pathname) {
        for (const section of sections) {
          for (const item of section.items) {
            if (pathname.startsWith(item.href)) {
              currentSection = section.label;
              break;
            }
          }
          if (currentSection) break;
        }
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
            .find(section => section.label === "Orchestrator")
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
  
  // Effect to handle path-based section opening (disabled to keep default collapsed)
  useEffect(() => {
    if (!initialized || !isClient || !pathname) return;
    // Intentionally do not auto-expand any sections on navigation to honor the default-collapsed requirement
  }, [pathname, initialized, isClient, sections, storageAvailable]);
  
  // Separate effect to save toggle states without affecting section expansion
  useEffect(() => {
    if (!initialized || !isClient || !storageAvailable) return;
    
    // Only save toggle states, don't modify section expansion
    safeLocalStorage.setItem('toggleStates', JSON.stringify(toggleStates));
  }, [toggleStates, initialized, isClient, storageAvailable]);
  
  const toggleSection = (label: string) => {
    if (collapsed) {
      // In collapsed mode, toggle between showing all icons or only active ones
      setShowOnlyActive(prev => ({
        ...prev,
        [label]: !prev[label]
      }));
      return;
    }
    
    // Manually toggle the section regardless of auto-expansion rules
    if (openSections.includes(label)) {
      // Close the section
      setOpenSections(prev => prev.filter(s => s !== label));
    } else {
      // Open the section
      setOpenSections(prev => [...prev, label]);
    }
  };

  const toggleItemState = (href: string) => {
    setToggleStates(prev => {
      // Special handling for iQube Template/Instance toggles
      if (href === '#iqube-template' || href === '#iqube-instance') {
        const isTemplate = href === '#iqube-template';
        const templateHref = '#iqube-template';
        const instanceHref = '#iqube-instance';
        
        // Force mutual exclusivity - if turning on one, turn off the other
        // If turning off one, don't allow both to be off (one must always be selected)
        if (!prev[href]) {
          // User is turning this toggle ON
          return {
            ...prev,
            [templateHref]: isTemplate,
            [instanceHref]: !isTemplate
          };
        } else {
          // User is trying to turn this toggle OFF
          // Don't allow - one must always be selected
          return prev;
        }
      } else {
        // Normal toggle behavior for other items
        const newState = {
          ...prev,
          [href]: !prev[href]
        };
        
        // Emit custom event for iQube toggles to update ContextPanel
        if (href.startsWith('#')) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('iQubeToggleChanged'));
          }, 100);
        }
        
        return newState;
      }
    });
  };

  const handlePersonaClick = (href: string) => {
    console.log('=== PERSONA CLICK DEBUG ===');
    console.log('Clicked persona href:', href);
    
    // CRITICAL FIX: Force-save agent states before toggling persona
    if (storageAvailable) {
      // Get all agent hrefs
      const agentHrefs: string[] = sections
        .find(section => section.label === "Orchestrator")
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
      .find(section => section.label === "Orchestrator")
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
    // Derive agent and persona context locally for this function scope
    const agentHrefs: string[] = sections
      .find(section => section.label === "Orchestrator")
      ?.items.map(item => item.href) || [];

    const genericAiHref = agentHrefs.find(h => h.includes('/aigents/generic-ai')) || '';

    // Extract persona name if present as a query (e.g., /aigents/generic-ai?iqube=metaMe)
    let personaName: string | null = null;
    try {
      const q = personaHref.split('?')[1] || '';
      const params = new URLSearchParams(q);
      personaName = params.get('iqube');
    } catch {}

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
    // Check if the current iQube is already active
    const isCurrentQubeActive = toggleStates[href];
    
    // For iQubes, we allow multiple to be active simultaneously
    // Just toggle the clicked iQube without affecting others
    setToggleStates(prev => {
      const newState = {
        ...prev,
        [href]: !prev[href]
      };
      
      // Emit custom event for iQube toggles to update ContextPanel
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('iQubeToggleChanged'));
      }, 100);
      
      return newState;
    });
  };

  const handleIQubeOperationsClick = (href: string) => {
    console.log('handleIQubeOperationsClick called with href:', href);
    
    // Handle Template/Instance mutual exclusivity
    if (href === '#iqube-template' || href === '#iqube-instance') {
      setToggleStates(prev => {
        console.log('Current toggle states before update:', prev);
        const templateHref = '#iqube-template';
        const instanceHref = '#iqube-instance';
        const isTemplate = href === '#iqube-template';
        
        // Always ensure one is active - if clicking inactive one, activate it and deactivate the other
        // If clicking active one, keep it active (don't allow both to be off)
        if (!prev[href]) {
          // Clicking inactive toggle - activate it and deactivate the other
          const newState = {
            ...prev,
            [templateHref]: isTemplate,
            [instanceHref]: !isTemplate
          };
          console.log('New toggle states after update:', newState);
          return newState;
        } else {
          // Clicking active toggle - keep current state (don't allow deactivation)
          console.log('Preventing deactivation of active toggle');
          return prev;
        }
      });
    } else {
      // For other iQube Operations items, use normal toggle behavior
      toggleItemState(href);
    }
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

  // Debug logging
  console.log('Sidebar render state:', { initialized, isClient, storageAvailable });
  
  // Show a minimal placeholder during initialization to prevent UI jumping
  if (!initialized || !isClient) {
    return <aside className="w-16 transition-all duration-200 bg-black/30 ring-1 ring-white/10 backdrop-blur-xl p-4 md:p-6 flex-shrink-0 min-h-screen"></aside>;
  }
  
  return (
    <>
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
                <div className="mb-4">
                  {section.label === "iQubes" ? (
                    <div className="space-y-3">
                      {/* Active iQubes Group */}
                      <div
                        className="text-[11px] uppercase tracking-wider text-slate-400 px-1 flex items-center justify-between cursor-pointer"
                        onClick={() => setOpenIQubesGroups(prev => ({ ...prev, ["Active iQubes"]: !prev["Active iQubes"] }))}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500"><Grid3X3 size={12} /></span>
                          <span>Active iQubes</span>
                        </div>
                        {openIQubesGroups["Active iQubes"] ? (
                          <ChevronDown size={12} className="text-gray-500" />
                        ) : (
                          <ChevronRight size={12} className="text-gray-500" />
                        )}
                      </div>
                      {openIQubesGroups["Active iQubes"] && (
                        <ul className="space-y-1">
                          {section.items.filter(i => IQUBES_ACTIVE_ITEMS.some(ai => ai.href === i.href)).map((item: SidebarItem) => {
                            const active = pathname ? pathname.startsWith(item.href) : false;
                            const isToggleable = 'toggleable' in item && item.toggleable;
                            const isItemActive = isToggleable ? toggleStates[item.href] : false;
                            return (
                              <li key={item.href} className="flex items-center justify-between">
                                <div className={`flex items-center justify-between w-full ${active || isItemActive ? 'bg-slate-700/50 text-slate-100 rounded-xl' : 'text-slate-500 hover:text-slate-300'}`}>
                                  <Link
                                    href={item.href}
                                    className="flex items-center w-full px-3 py-2"
                                    onClick={(e) => {
                                      if (isToggleable) { e.preventDefault(); handleModelQubeClick(item.href); }
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span>{item.icon}</span>
                                      <span className="text-[13px]">{item.label}</span>
                                    </div>
                                  </Link>
                                  {isToggleable && (
                                    <button className="p-2" onClick={(e) => { e.preventDefault(); handleModelQubeClick(item.href); }}>
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

                      {/* iQube Operations Group */}
                      <div
                        className="text-[11px] uppercase tracking-wider text-slate-400 px-1 mt-4 flex items-center justify-between cursor-pointer"
                        onClick={() => setOpenIQubesGroups(prev => ({ ...prev, ["iQube Operations"]: !prev["iQube Operations"] }))}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500"><SlidersHorizontal size={12} /></span>
                          <span>iQube Operations</span>
                        </div>
                        {openIQubesGroups["iQube Operations"] ? (
                          <ChevronDown size={12} className="text-gray-500" />
                        ) : (
                          <ChevronRight size={12} className="text-gray-500" />
                        )}
                      </div>
                      {openIQubesGroups["iQube Operations"] && (
                        <ul className="space-y-1">
                          {section.items.filter(i => IQUBE_OPS_ITEMS.some(oi => oi.href === i.href)).map((item: SidebarItem) => {
                            const active = pathname ? pathname.startsWith(item.href) : false;
                            const isToggleable = 'toggleable' in item && item.toggleable;
                            const isItemActive = isToggleable ? toggleStates[item.href] : false;
                            return (
                              <li key={item.href} className="flex items-center justify-between">
                                <div className={`flex items-center justify-between w-full ${active || isItemActive ? 'bg-slate-700/50 text-slate-100 rounded-xl' : 'text-slate-500 hover:text-slate-300'}`}>
                                  {item.isTextInput ? (
                                    <div className="flex items-center w-full px-3 py-2">
                                      <div className="flex items-center gap-2 w-full">
                                        <span>{item.icon}</span>
                                        <div className="flex w-full relative">
                                          <input
                                            type="text"
                                            value={iQubeId}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setIQubeId(val);
                                              if (val.toLowerCase().includes('template')) {
                                                setToggleStates(prev => ({ ...prev, '#iqube-template': true, '#iqube-instance': false }));
                                              } else if (val.trim() !== '') {
                                                setToggleStates(prev => ({ ...prev, '#iqube-template': false, '#iqube-instance': true }));
                                              }
                                              if (storageAvailable) { safeLocalStorage.setItem('iQubeId', val); }
                                            }}
                                            onFocus={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                              e.stopPropagation();
                                              if (e.key === 'Enter' && iQubeId.trim() !== '') { setDrawerType('view'); setDrawerOpen(true); }
                                            }}
                                            placeholder="Enter iQube ID"
                                            className="text-[13px] bg-black/40 border border-gray-700 rounded px-2 py-1 text-white w-full pr-8"
                                          />
                                          <button
                                            onClick={(e) => { e.stopPropagation(); if (iQubeId.trim() !== '') { setDrawerType('view'); setDrawerOpen(true); } }}
                                            className="absolute right-0 top-0 bottom-0 text-blue-400 hover:text-blue-300 px-2 flex items-center justify-center"
                                            title="View iQube"
                                          >
                                            <Eye size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <Link
                                      href={item.href}
                                      className="flex items-center w-full px-3 py-2"
                                      onClick={(e) => {
                                        if (isToggleable || item.href.startsWith('#iqube-')) { e.preventDefault(); handleIQubeOperationsClick(item.href); }
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span>{item.icon}</span>
                                        <span className="text-[13px]">{item.label}</span>
                                      </div>
                                    </Link>
                                  )}
                                  {isToggleable && (
                                    <button className="p-2" onClick={(e) => { e.preventDefault(); handleIQubeOperationsClick(item.href); }}>
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

                      {/* iQube Registry Group */}
                      <div
                        className="text-[11px] uppercase tracking-wider text-slate-400 px-1 mt-4 flex items-center justify-between cursor-pointer"
                        onClick={() => setOpenIQubesGroups(prev => ({ ...prev, ["iQube Registry"]: !prev["iQube Registry"] }))}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500"><FileText size={12} /></span>
                          <span>iQube Registry</span>
                        </div>
                        {openIQubesGroups["iQube Registry"] ? (
                          <ChevronDown size={12} className="text-gray-500" />
                        ) : (
                          <ChevronRight size={12} className="text-gray-500" />
                        )}
                      </div>
                      {openIQubesGroups["iQube Registry"] && (
                        <ul className="space-y-1">
                          {section.items.filter(i => IQUBE_REGISTRY_ITEMS.some(ri => ri.href === i.href)).map((item: SidebarItem) => {
                            const active = pathname ? pathname.startsWith(item.href) : false;
                            return (
                              <li key={item.href} className="flex items-center justify-between">
                                <div className={`flex items-center justify-between w-full ${active ? 'bg-slate-700/50 text-slate-100 rounded-xl' : 'text-slate-500 hover:text-slate-300'}`}>
                                  <Link href={item.href} className="flex items-center w-full px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span>{item.icon}</span>
                                      <span className="text-[13px]">{item.label}</span>
                                    </div>
                                  </Link>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {section.items.map((item: SidebarItem) => {
                        const active = pathname ? pathname.startsWith(item.href) : false;
                        const isToggleable = 'toggleable' in item && item.toggleable;
                        const isItemActive = isToggleable ? toggleStates[item.href] : false;
                        
                        return (
                          <li key={item.href} className="flex items-center justify-between">
                            <div className={`flex items-center justify-between w-full ${active || isItemActive ? 'bg-slate-700/50 text-slate-100 rounded-xl' : 'text-slate-500 hover:text-slate-300'}`}>
                              {item.isTextInput ? (
                                <div className="flex items-center w-full px-3 py-2">
                                  <div className="flex items-center gap-2 w-full">
                                    <span>{item.icon}</span>
                                    <div className="flex w-full relative">
                                      <input
                                        type="text"
                                        value={iQubeId}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setIQubeId(val);
                                          if (val.toLowerCase().includes('template')) {
                                            setToggleStates(prev => ({ ...prev, '#iqube-template': true, '#iqube-instance': false }));
                                          } else if (val.trim() !== '') {
                                            setToggleStates(prev => ({ ...prev, '#iqube-template': false, '#iqube-instance': true }));
                                          }
                                          if (storageAvailable) { safeLocalStorage.setItem('iQubeId', val); }
                                        }}
                                        onFocus={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                          e.stopPropagation();
                                          if (e.key === 'Enter' && iQubeId.trim() !== '') { setDrawerType('view'); setDrawerOpen(true); }
                                        }}
                                        placeholder="Enter iQube ID"
                                        className="text-[13px] bg-black/40 border border-gray-700 rounded px-2 py-1 text-white w-full pr-8"
                                      />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); if (iQubeId.trim() !== '') { setDrawerType('view'); setDrawerOpen(true); } }}
                                        className="absolute right-0 top-0 bottom-0 text-blue-400 hover:text-blue-300 px-2 flex items-center justify-center"
                                        title="View iQube"
                                      >
                                        <Eye size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <Link
                                  href={item.href}
                                  className="flex items-center w-full px-3 py-2"
                                  onClick={(e) => {
                                    if (isToggleable) {
                                      const sectionLabel = sections.find(section => 
                                        section.items.some(i => i.href === item.href)
                                      )?.label;
                                      
                                      if (sectionLabel === "Persona") {
                                        e.preventDefault();
                                        handlePersonaClick(item.href);
                                      } else if (sectionLabel === "iQubes") {
                                        e.preventDefault();
                                        handleModelQubeClick(item.href);
                                      } else if (item.href.startsWith('#iqube-')) {
                                        e.preventDefault();
                                        handleIQubeOperationsClick(item.href);
                                      }
                                    } else if (item.drawerAction) {
                                      e.preventDefault();
                                      setDrawerType(item.drawerAction);
                                      setDrawerOpen(true);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{item.icon}</span>
                                    <span className="text-[13px]">{item.label}</span>
                                  </div>
                                </Link>
                              )}
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
                                    } else if (item.href.startsWith('#iqube-')) {
                                      handleIQubeOperationsClick(item.href);
                                    } else {
                                      setToggleStates(prev => ({ ...prev, [item.href]: !prev[item.href] }));
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
                </div>
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
                      const active = pathname ? pathname.startsWith(item.href) : false;
                      
                      return !showOnlyActive[section.label] || isItemActive || active;
                    })
                    .map((item: SidebarItem) => {
                      const active = pathname ? pathname.startsWith(item.href) : false;
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
                                } else if (item.href.startsWith('#iqube-')) {
                                  e.preventDefault();
                                  console.log('Collapsed view clicked for:', item.href);
                                  handleIQubeOperationsClick(item.href);
                                }
                              } else if (item.drawerAction) {
                                e.preventDefault();
                                setDrawerType(item.drawerAction);
                                setDrawerOpen(true);
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
      <SubmenuDrawer 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        iQubeId={iQubeId} 
        drawerType={drawerType} 
      />
    </>
  );
}
