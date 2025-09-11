// This is a temporary file to hold the modified MetaQube section for the Edit tab
// with proper collapse/expand functionality

{/* MetaQube Card - Edit Mode */}
<div className="bg-gradient-to-br from-blue-900/20 to-black/40 border border-blue-500/20 rounded-xl p-6 shadow-xl">
  <div className="flex justify-between items-center mb-4">
    <div className="uppercase text-[11px] tracking-wider text-blue-400 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
      MetaQube
      <span className="text-[10px] ml-2 bg-blue-500/20 px-2 py-0.5 rounded">
        {isTemplate ? 'Template' : getInstanceLabel()}
      </span>
    </div>
    <div className="flex items-center gap-2">
      {isTemplate && (
        <button 
          onClick={() => setIsMetaEditMode(!isMetaEditMode)}
          className={`text-xs px-2 py-1 rounded ${isMetaEditMode ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-900/30 text-blue-400 hover:bg-blue-800/30'}`}
        >
          {isMetaEditMode ? 'Editing...' : 'Edit Fields'}
        </button>
      )}
      <button
        onClick={() => setIsMetaQubeCollapsed(!isMetaQubeCollapsed)}
        className="p-1 rounded-full hover:bg-blue-500/20 transition-colors"
        aria-label={isMetaQubeCollapsed ? "Expand MetaQube" : "Collapse MetaQube"}
        title={isMetaQubeCollapsed ? "Expand MetaQube" : "Collapse MetaQube"}
      >
        {isMetaQubeCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  </div>
  
  {!isMetaQubeCollapsed && (
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
        {/* iQube content here */}
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
        {/* Subject content here */}
      </div>
    </div>

    {/* Add MetaQube Records Option for Templates */}
    {isTemplate && (
      <div className="mt-6 pt-3">
        <div className="text-white text-[13px] font-medium mb-3 flex items-center gap-2">
          <div className="text-blue-400">
            <PlusCircle size={14} />
          </div>
          Add New Record
        </div>
        {/* Add record content here */}
      </div>
    )}
  </div>
  )}
  
  {/* Scores Section - Always Visible */}
  <div className={!isMetaQubeCollapsed ? "mt-6" : ""}>
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
        {/* Score indicators here */}
      </div>
    </div>
  </div>
</div>
