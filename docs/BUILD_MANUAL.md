# AigentZ Build Manual

## Table of Contents
1. [Build Environment Setup](#build-environment-setup)
2. [Common Issues & Solutions](#common-issues--solutions)
   - [JSX Syntax Resolution](#jsx-syntax-resolution)
   - [Submenu Drawer Implementation](#submenu-drawer-implementation)
   - [State Management Patterns](#state-management-patterns)
3. [Component Architecture](#component-architecture)
4. [Best Practices](#best-practices)
5. [Deployment Guide](#deployment-guide)

## Build Environment Setup

### Prerequisites
- Node.js 18+
- npm 9+
- TypeScript 5.0+
- Next.js 13+
- React 18+

### Installation
```bash
# Clone the repository
git clone https://github.com/iQube-Protocol/AigentZBeta.git
cd AigentZBeta

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

## Common Issues & Solutions

### Sidebar Auto-Expansion Bug Resolution

#### Issue: Infinite Update Loop and Unwanted Auto-Expansion
**Problem:** Sidebar sections were auto-expanding unexpectedly when interacting with form inputs, causing infinite re-renders and application crashes.

**Root Cause:**
- Auto-expansion logic was triggered by toggle state changes
- Circular dependency in useEffect hooks
- State updates causing cascading effects between sections

**Solution:**
1. **Removed Auto-Expansion Logic**
   ```typescript
   // Before: Complex auto-expansion based on toggle states
   useEffect(() => {
     // Complex logic that caused infinite loops
     const sectionsWithActiveItems = [];
     // ... problematic auto-expansion code
   }, [toggleStates, openSections]); // Circular dependency
   
   // After: Simple path-based opening only
   useEffect(() => {
     if (!initialized || !isClient || !pathname) return;
     
     // Only open sections based on navigation
     let currentPathSection = "";
     for (const section of sections) {
       for (const item of section.items) {
         if (pathname.startsWith(item.href)) {
           currentPathSection = section.label;
           break;
         }
       }
       if (currentPathSection) break;
     }
     
     if (currentPathSection && !openSections.includes(currentPathSection)) {
       setOpenSections(prev => [...prev, currentPathSection]);
     }
   }, [pathname, initialized, isClient, sections]);
   ```

2. **Manual Section Control**
   - Sections now only open/close via manual user clicks
   - No automatic expansion based on form interactions
   - Preserved user preferences in localStorage

3. **Separated Toggle State Management**
   ```typescript
   // Separate effect for saving toggle states without affecting sections
   useEffect(() => {
     if (!initialized || !isClient || !storageAvailable) return;
     safeLocalStorage.setItem('toggleStates', JSON.stringify(toggleStates));
   }, [toggleStates, initialized, isClient, storageAvailable]);
   ```

**Prevention:**
- Never include state variables in useEffect dependencies if the effect modifies those same variables
- Use comparison checks before state updates to prevent unnecessary re-renders
- Separate concerns: navigation-based opening vs. manual control vs. state persistence

### JSX Syntax Resolution

#### Issue: Unexpected Token Errors
**Problem:** JSX parser fails with "Unexpected token `div`. Expected jsx identifier" error.

**Root Cause:**
- Inconsistent indentation in nested JSX structures
- Mismatched or missing closing tags
- Improperly escaped JavaScript expressions within JSX

**Solution:**
1. **Consistent Indentation**
   ```jsx
   // Bad
   {condition && (
   <div>
     <Component />
     </div>
   )}
   
   // Good
   {condition && (
     <div>
       <Component />
     </div>
   )}
   ```

2. **Proper Tag Nesting**
   - Always close self-closing tags: `<Component />`
   - Ensure all tags are properly nested and closed
   - Use fragments (`<>...</>`) for multiple elements

3. **Expression Handling**
   ```jsx
   // Bad
   {items.map(item => 
     <div>{item.name}</div>
   )}
   
   // Good
   {items.map((item) => (
     <div key={item.id}>{item.name}</div>
   ))}
   ```

### Submenu Drawer Implementation

#### Key Features
- Collapsible sections
- State persistence
- Responsive design
- Accessibility support

#### Implementation Details

**State Management**
```typescript
const [isExpanded, setIsExpanded] = useState<boolean>(false);
const [activeSection, setActiveSection] = useState<string | null>(null);

// Toggle section with persistence
const toggleSection = (sectionId: string) => {
  setActiveSection(prev => prev === sectionId ? null : sectionId);
  // Persist state if needed
  localStorage.setItem('activeSection', sectionId);
};
```

**Accessibility**
```jsx
<button 
  aria-expanded={isExpanded}
  aria-controls="section-content"
  onClick={() => toggleSection('section-id')}
>
  {sectionLabel}
  <ChevronIcon isExpanded={isExpanded} />
</button>
<div 
  id="section-content" 
  role="region" 
  aria-hidden={!isExpanded}
>
  {/* Content */}
</div>
```

### State Management Patterns

#### Issue: State Persistence Across Navigation
**Problem:** State was being lost during page navigation.

**Solution:**
1. Implemented context-based state management
2. Added localStorage persistence for critical states
3. Used URL parameters for shareable states

```typescript
// Context Provider
const AppStateContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  
  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('appState');
    if (savedState) {
      setState(JSON.parse(savedState));
    }
  }, []);
  
  // Persist state on change
  useEffect(() => {
    localStorage.setItem('appState', JSON.stringify(state));
  }, [state]);
  
  return (
    <AppStateContext.Provider value={{ state, setState }}>
      {children}
    </AppStateContext.Provider>
  );
};
```

## Component Architecture

### File Structure
```
components/
  ├── layout/
  │   ├── Sidebar.tsx
  │   └── Header.tsx
  ├── ui/
  │   ├── Button.tsx
  │   └── Input.tsx
  └── sections/
      ├── DrawerSection.tsx
      └── ContentSection.tsx
```

### Component Design Principles
1. **Single Responsibility**
   - Each component should do one thing well
   - Keep components small and focused

2. **Props Interface**
   ```typescript
   interface ButtonProps {
     variant?: 'primary' | 'secondary' | 'danger';
     size?: 'sm' | 'md' | 'lg';
     onClick: () => void;
     children: ReactNode;
     disabled?: boolean;
     className?: string;
   }
   ```

3. **Type Safety**
   - Use TypeScript interfaces for all props
   - Enable strict mode in tsconfig.json
   - Use React.FC for functional components

## Best Practices

### Code Organization
1. **Hooks**
   - Keep hooks at the top of the component
   - Extract complex logic into custom hooks
   - Follow the Rules of Hooks strictly

2. **Styling**
   - Use CSS Modules or styled-components
   - Follow BEM naming convention
   - Keep styles co-located with components

3. **Performance**
   - Use React.memo for expensive renders
   - Implement proper key props in lists
   - Use useCallback and useMemo appropriately

### Error Handling
```typescript
try {
  // Potentially failing operation
} catch (error) {
  if (error instanceof Error) {
    console.error('Operation failed:', error.message);
    // Handle error state
  } else {
    console.error('An unknown error occurred');
  }
}
```

## Deployment Guide

### Prerequisites
- Vercel account
- GitHub repository access
- Environment variables configured

### Steps
1. Push changes to main branch
2. Vercel will automatically deploy
3. Monitor deployment in Vercel dashboard
4. Run tests in staging before production

### Rollback Procedure
1. Identify last stable commit
2. Revert if needed:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```
3. Or rollback deployment in Vercel

## Recent Major Updates

### Version 2.1.0 - UI Improvements and Stability Fixes

#### New Features Added
1. **metaMe Persona Integration**
   - Added new `metaMe` persona to personas.ts
   - Integrated with sidebar navigation and generic-ai page
   - Full functionality matching existing personas

2. **Enhanced MetaQube Headers**
   - Added Sats price display for Instance mode only
   - Dynamic price matching between header and data sections
   - Green styling consistent with design system

3. **Improved iQube Name Display**
   - Added iQube names to View tab headers
   - Consistent naming across Template and Instance modes
   - Removed redundant "Template" and "Instance" text from headers

#### Critical Bug Fixes
1. **Sidebar Auto-Expansion Resolution**
   - Fixed infinite update loop causing application crashes
   - Removed problematic auto-expansion logic
   - Implemented manual-only section control
   - Separated navigation-based opening from form interactions

2. **Price Consistency Fix**
   - Fixed mismatch between MetaQube header (2,100 sats) and iQube data (100 sats)
   - Implemented dynamic price display using state variables
   - Ensured consistency across all tabs and sections

#### Process Management Improvements
- Enhanced PM2 configuration with log rotation
- Added auto-start on boot functionality
- Improved development server stability

## Lessons Learned

### What Went Well
- TypeScript integration caught many potential runtime errors
- Component composition allowed for flexible UI building
- State management with Context API provided clean data flow
- Comprehensive testing prevented regression issues

### Challenges Overcome
1. **Sidebar Auto-Expansion Bug**
   - Root cause: Circular dependencies in useEffect hooks
   - Solution: Separated concerns and removed auto-expansion logic
   - Prevention: Better state management patterns and dependency analysis

2. **JSX Syntax Issues**
   - Implemented strict ESLint rules
   - Added Prettier for consistent formatting
   - Created custom ESLint rules for common patterns

3. **State Management**
   - Moved from prop drilling to Context API
   - Implemented proper TypeScript types
   - Added error boundaries for graceful failures

4. **Performance**
   - Optimized re-renders with useMemo/useCallback
   - Implemented code splitting
   - Added lazy loading for non-critical components

## Troubleshooting

### Common Issues
1. **Build Failures**
   - Check TypeScript errors first
   - Verify all dependencies are installed
   - Clear .next folder and node_modules if needed

2. **Runtime Errors**
   - Check browser console
   - Verify environment variables
   - Look for undefined variables or missing props

3. **Performance Issues**
   - Use React DevTools profiler
   - Check for unnecessary re-renders
   - Optimize expensive calculations

## Support
For additional help, please contact:
- Development Team: dev@iqube-protocol.com
- Documentation: docs@iqube-protocol.com
- Support: support@iqube-protocol.com
