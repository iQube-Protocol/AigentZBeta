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
