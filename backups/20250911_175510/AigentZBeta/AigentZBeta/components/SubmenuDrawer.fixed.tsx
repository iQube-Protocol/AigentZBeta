import React, { useState, useEffect } from 'react';

// A simplified version of the SubmenuDrawer component with just the tab UI enhancements
export const SubmenuDrawer = () => {
  const [activeTab, setActiveTab] = useState<"decrypt" | "use" | "view" | "mint" | "activate" | "edit">("view");
  const [isTemplate, setIsTemplate] = useState(true);
  
  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg shadow-lg">
      <div className="flex border-b border-gray-700 mb-4" role="tablist" aria-label="iQube Operations">
        <button
          onClick={() => setActiveTab("view")}
          className={`px-4 py-2 text-[13px] font-medium ${activeTab === "view" ? "text-white border-b-2 border-blue-500 bg-blue-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
          role="tab"
          aria-selected="true"
          aria-controls="view-panel"
          id="view-tab"
        >
          View
        </button>
        <button
          onClick={() => setActiveTab("use")}
          className={`px-4 py-2 text-[13px] font-medium ${activeTab === "use" ? "text-white border-b-2 border-green-500 bg-green-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
          role="tab"
          aria-selected="false"
          aria-controls="use-panel"
          id="use-tab"
        >
          Use
        </button>
        <button
          onClick={() => setActiveTab("edit")}
          className={`px-4 py-2 text-[13px] font-medium ${activeTab === "edit" ? "text-white border-b-2 border-purple-500 bg-purple-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
          role="tab"
          aria-selected="false"
          aria-controls="edit-panel"
          id="edit-tab"
        >
          Edit
        </button>
        <button
          onClick={() => setActiveTab("decrypt")}
          className={`px-4 py-2 text-[13px] font-medium ${activeTab === "decrypt" ? "text-white border-b-2 border-amber-500 bg-amber-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
          role="tab"
          aria-selected="false"
          aria-controls="decrypt-panel"
          id="decrypt-tab"
        >
          Decrypt
        </button>
        {isTemplate && (
          <button
            onClick={() => setActiveTab("mint")}
            className={`px-4 py-2 text-[13px] font-medium ${activeTab === "mint" ? "text-white border-b-2 border-green-500 bg-green-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
            role="tab"
            aria-selected="false"
            aria-controls="mint-panel"
            id="mint-tab"
          >
            Mint
          </button>
        )}
        {!isTemplate && (
          <button
            onClick={() => setActiveTab("activate")}
            className={`px-4 py-2 text-[13px] font-medium ${activeTab === "activate" ? "text-white border-b-2 border-purple-500 bg-purple-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/30"}`}
            role="tab"
            aria-selected="false"
            aria-controls="activate-panel"
            id="activate-tab"
          >
            Activate
          </button>
        )}
      </div>
      
      {/* Tab Panels */}
      <div className="p-4">
        <div 
          id="view-panel" 
          role="tabpanel" 
          aria-labelledby="view-tab"
          className={activeTab === "view" ? "" : "hidden"}
        >
          View Panel Content
        </div>
        <div 
          id="use-panel" 
          role="tabpanel" 
          aria-labelledby="use-tab"
          className={activeTab === "use" ? "" : "hidden"}
        >
          Use Panel Content
        </div>
        <div 
          id="edit-panel" 
          role="tabpanel" 
          aria-labelledby="edit-tab"
          className={activeTab === "edit" ? "" : "hidden"}
        >
          Edit Panel Content
        </div>
        <div 
          id="decrypt-panel" 
          role="tabpanel" 
          aria-labelledby="decrypt-tab"
          className={activeTab === "decrypt" ? "" : "hidden"}
        >
          Decrypt Panel Content
        </div>
        {isTemplate && (
          <div 
            id="mint-panel" 
            role="tabpanel" 
            aria-labelledby="mint-tab"
            className={activeTab === "mint" ? "" : "hidden"}
          >
            Mint Panel Content
          </div>
        )}
        {!isTemplate && (
          <div 
            id="activate-panel" 
            role="tabpanel" 
            aria-labelledby="activate-tab"
            className={activeTab === "activate" ? "" : "hidden"}
          >
            Activate Panel Content
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmenuDrawer;
