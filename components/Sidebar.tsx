import { useState, useMemo } from "react";
import { X, Plus, Search, Settings2, Download, LogOut, MessageSquare, Trash2 } from "lucide-react";

interface Model {
  id: string;
  name: string;
  owned_by: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: any[];
  updatedAt: number;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  temperature: number;
  setTemperature: (val: number) => void;
  maxTokens: number;
  setMaxTokens: (val: number) => void;
  systemPrompt: string;
  setSystemPrompt: (val: string) => void;
  chatHistory: ChatSession[];
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onLogout: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  models,
  selectedModel,
  setSelectedModel,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  systemPrompt,
  setSystemPrompt,
  chatHistory,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onLogout,
}: SidebarProps) {
  const [modelSearch, setModelSearch] = useState("");

  const filteredModels = useMemo(() => {
    const query = modelSearch.toLowerCase();
    const grouped: Record<string, Model[]> = {};
    
    models.forEach((m) => {
      if (m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query) || m.owned_by.toLowerCase().includes(query)) {
        const provider = m.owned_by;
        if (!grouped[provider]) grouped[provider] = [];
        grouped[provider].push(m);
      }
    });
    return grouped;
  }, [models, modelSearch]);

  const selectedModelObj = models.find(m => m.id === selectedModel);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed md:relative top-0 left-0 h-full w-[300px] min-w-[300px] z-50
        glass-panel border-r border-white/5 flex flex-col transition-transform duration-300 ease-out
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#76B900] shadow-[0_0_10px_rgba(118,185,0,0.6)] animate-pulse" />
            <span className="font-bold tracking-wide">NVIDIA AI</span>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          <button 
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 border border-white/10 hover:border-[#76B900] hover:text-[#76B900] hover:shadow-[inset_0_0_20px_rgba(118,185,0,0.05)] text-white py-2.5 rounded-xl text-sm transition-all"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>

          {/* History */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">History</h3>
            <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto -mr-2 pr-2">
              {chatHistory.length === 0 ? (
                <div className="text-xs text-gray-600 italic">No past chats</div>
              ) : (
                chatHistory.map(chat => (
                  <div 
                    key={chat.id} 
                    onClick={() => onSelectChat(chat.id)}
                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm transition-colors ${chat.id === currentChatId ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5"}`}
                  >
                    <span className="truncate flex-1"><MessageSquare size={14} className="inline mr-2 opacity-50"/>{chat.title}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Models */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Model</h3>
              <span className="bg-[#76B900]/15 text-[#76B900] text-[10px] font-bold px-1.5 py-0.5 rounded-full">{models.length}</span>
            </div>
            
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search models..." 
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-[#76B900]/50"
              />
            </div>
            
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto bg-[#111] border border-white/10 rounded-lg p-1">
              {Object.entries(filteredModels).map(([provider, providerModels]) => (
                <div key={provider}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#76B900] px-2 py-1 sticky top-0 bg-[#111] z-10">
                    {provider} ({providerModels.length})
                  </div>
                  {providerModels.map(m => (
                    <div 
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`p-2 rounded cursor-pointer transition-colors flex flex-col gap-0.5 mx-1 ${selectedModel === m.id ? "bg-[#76B900]/10" : "hover:bg-[#222]"}`}
                    >
                      <span className="text-xs font-medium text-white break-all">{m.name}</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{m.owned_by}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {selectedModelObj && (
              <div className="bg-[#111] border border-white/10 rounded-lg p-3 flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#76B900]">Selected</span>
                <span className="text-xs text-white">{selectedModelObj.name}</span>
              </div>
            )}
          </div>

          {/* Parameters */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Parameters</h3>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-300">Temperature</label>
                <span className="text-xs text-[#76B900] font-mono">{temperature.toFixed(1)}</span>
              </div>
              <input 
                type="range" 
                min="0" max="2" step="0.1" 
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-[#76B900]"
              />
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>0.0</span>
                <span>2.0</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <label className="text-xs font-medium text-gray-300">Max Tokens</label>
              <input 
                type="number" 
                min="1" max="128000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                className="w-full bg-[#111] border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white outline-none focus:border-[#76B900]/50"
              />
            </div>
          </div>

          {/* System Prompt */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">System Prompt</h3>
            <textarea 
              placeholder="You are a helpful AI assistant..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              className="w-full bg-[#111] border border-white/10 rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-[#76B900]/50 resize-none"
            />
          </div>

        </div>

        <div className="mt-auto p-5 border-t border-white/5 flex flex-col gap-3">
           <div className="flex flex-col gap-1 bg-[#111]/50 p-3 rounded-xl border border-white/5">
             <div className="flex items-center justify-between">
               <span className="text-xs text-gray-400">Status</span>
               <span className="text-xs text-[#76B900] flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 rounded-full bg-[#76B900] animate-pulse"></span>
                 Connected
               </span>
             </div>
             <div className="flex items-center justify-between">
               <span className="text-xs text-gray-400">Model</span>
               <span className="text-xs text-white truncate max-w-[150px]">{selectedModelObj?.name || "None"}</span>
             </div>
           </div>
           
           <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 border border-white/5 hover:bg-red-500/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 py-2 rounded-xl text-xs transition-colors"
           >
             <LogOut size={14} />
             Change API Key
           </button>
        </div>
      </aside>
    </>
  );
}
