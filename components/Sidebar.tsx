import { useState, useMemo, useEffect } from "react";
import { X, Plus, Search, Settings2, Download, LogOut, MessageSquare, Trash2, UserCircle, PanelLeftClose, ChevronDown, ChevronRight, SlidersHorizontal, Pencil, Network } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

interface Model {
  id: string;
  name: string;
  owned_by: string;
  category?: string;
  description?: string;
  maxTokens?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: any[];
  updatedAt: number;
}

interface SidebarProps {
  isMobileOpen: boolean;
  isDesktopOpen: boolean;
  onMobileClose: () => void;
  onDesktopToggle: () => void;
  models: Model[];
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  temperature: number;
  setTemperature: (val: number) => void;
  systemPrompt: string;
  setSystemPrompt: (val: string) => void;
  chatHistory: ChatSession[];
  currentChatId: string | null;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (val: boolean) => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onLogout: () => void;
}

export function Sidebar({
  isMobileOpen,
  isDesktopOpen,
  onMobileClose,
  onDesktopToggle,
  models,
  selectedModel,
  setSelectedModel,
  temperature,
  setTemperature,
  systemPrompt,
  setSystemPrompt,
  chatHistory,
  currentChatId,
  webSearchEnabled,
  setWebSearchEnabled,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onLogout,
}: SidebarProps) {
  const [modelSearch, setModelSearch] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Local settings state for modal
  const [localModel, setLocalModel] = useState(selectedModel);
  const [localTemp, setLocalTemp] = useState(temperature);
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);
  const [localSearch, setLocalSearch] = useState(webSearchEnabled);

  useEffect(() => {
    if (isSettingsOpen) {
      setLocalModel(selectedModel);
      setLocalTemp(temperature);
      setLocalPrompt(systemPrompt);
      setLocalSearch(webSearchEnabled);
    }
  }, [isSettingsOpen, selectedModel, temperature, systemPrompt, webSearchEnabled]);

  const handleSaveSettings = () => {
    setSelectedModel(localModel);
    setTemperature(localTemp);
    setSystemPrompt(localPrompt);
    setWebSearchEnabled(localSearch);
    setIsSettingsOpen(false);
  };
  
  // Modals and inputs
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  
  const { data: session } = useSession();

  const groupedHistory = useMemo(() => {
    const groups: Record<string, ChatSession[]> = {
      "Today": [],
      "Previous 7 Days": [],
      "Previous 30 Days": [],
      "Older": []
    };

    const now = new Date();
    
    chatHistory.forEach(chat => {
      // Assuming updatedAt is available. If not, fallback to Date.now()
      const date = new Date(chat.updatedAt || Date.now());
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0 && now.getDate() === date.getDate()) {
        groups["Today"].push(chat);
      } else if (diffDays <= 7) {
        groups["Previous 7 Days"].push(chat);
      } else if (diffDays <= 30) {
        groups["Previous 30 Days"].push(chat);
      } else {
        groups["Older"].push(chat);
      }
    });

    return groups;
  }, [chatHistory]);

  const filteredModels = useMemo(() => {
    const query = modelSearch.toLowerCase();
    const grouped: Record<string, Model[]> = {
      "Vision": [],
      "Text / Chat": []
    };
    
    models.forEach((m) => {
      if (m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query) || m.owned_by.toLowerCase().includes(query)) {
        if (m.category === "vision") {
          grouped["Vision"].push(m);
        } else {
          grouped["Text / Chat"].push(m);
        }
      }
    });
    
    // Remove empty categories
    Object.keys(grouped).forEach(k => {
      if (grouped[k].length === 0) delete grouped[k];
    });
    
    return grouped;
  }, [models, modelSearch]);

  const selectedModelObj = models.find(m => m.id === selectedModel);

  return (
    <>
      {/* Configuration Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#111]/50">
              <div className="flex items-center gap-2 text-gray-200">
                <SlidersHorizontal size={18} className="text-[#76B900]" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Configuration</h3>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-gray-500 hover:text-white p-1 rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar bg-[#18181b]">
              {/* Models */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    Model Selection <span className="lowercase normal-case font-semibold text-[#76B900]/80 ml-1">({models.length} total)</span>
                  </h3>
                </div>
                
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Search models..." 
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-[#76B900]/50"
                  />
                </div>
                
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto bg-[#111] border border-white/10 rounded-lg p-2 custom-scrollbar">
                  {Object.entries(filteredModels).map(([category, categoryModels]) => (
                    <div key={category} className="mb-2 last:mb-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#76B900] px-2 py-1 mb-1 border-b border-white/5">
                        {category} ({categoryModels.length})
                      </div>
                      {categoryModels.map(m => (
                        <div 
                          key={m.id}
                          onClick={() => setLocalModel(m.id)}
                          className={`p-2.5 rounded cursor-pointer transition-colors flex flex-col gap-0.5 mx-1 ${localModel === m.id ? "bg-[#76B900]/10 border border-[#76B900]/30" : "hover:bg-[#222] border border-transparent"}`}
                        >
                          <span className="text-xs font-medium text-white break-all">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Parameters */}
              <div className="flex flex-col gap-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Parameters</h3>
                
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">Temperature</label>
                    <span className="text-sm text-[#76B900] font-mono bg-[#76B900]/10 px-2 py-0.5 rounded">{localTemp.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.1" 
                    value={localTemp}
                    onChange={(e) => setLocalTemp(parseFloat(e.target.value))}
                    className="w-full accent-[#76B900]"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[#111] border border-white/10 cursor-pointer hover:bg-white/5 transition-colors mt-2" onClick={() => setLocalSearch(!localSearch)}>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-200">Web Search</span>
                    <span className="text-xs text-gray-500 mt-0.5">Augment AI with live data</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full flex items-center p-0.5 transition-colors ${localSearch ? 'bg-[#76B900]' : 'bg-gray-700'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${localSearch ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
              </div>

              {/* System Prompt */}
              <div className="flex flex-col gap-3">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">System Prompt</h3>
                <textarea 
                  placeholder="You are a helpful AI assistant..."
                  value={localPrompt}
                  onChange={(e) => setLocalPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-[#111] border border-white/10 rounded-lg py-3 px-4 text-sm text-white outline-none focus:border-[#76B900]/50 resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-[#111]/50 flex justify-end">
              <button
                onClick={handleSaveSettings}
                className="bg-[#76B900] hover:bg-[#8dd417] text-black font-semibold px-6 py-2 rounded-lg transition-colors text-sm shadow-[0_0_15px_rgba(118,185,0,0.2)]"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white">Delete Chat</h3>
            <p className="text-sm text-gray-400">Are you sure you want to delete this chat? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button 
                onClick={() => setChatToDelete(null)} 
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDeleteChat(chatToDelete);
                  setChatToDelete(null);
                }} 
                className="px-4 py-2 text-sm font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* When desktop is NOT open, we return early so it hides on MD screens */}
      <aside className={`
        fixed md:relative top-0 left-0 h-full w-[300px] min-w-[300px] z-50
        bg-[#18181b] flex flex-col transition-transform duration-300 ease-out
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        ${isDesktopOpen ? "md:translate-x-0" : "md:hidden"}
      `}>
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
              <Network size={14} className="text-white" />
            </div>
            <span className="font-bold tracking-wide">Synapse</span>
          </div>
          <button onClick={onDesktopToggle} className="hidden md:block text-gray-500 hover:text-white p-1 transition-colors">
            <PanelLeftClose size={18} />
          </button>
          <button onClick={onMobileClose} className="md:hidden text-gray-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          <button 
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 bg-[#2f2f2f] hover:bg-[#3f3f3f] text-white py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>

          {/* History */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">History</h3>
            <div className="flex flex-col gap-4 overflow-y-auto -mr-2 pr-2 custom-scrollbar">
              {chatHistory.length === 0 ? (
                <div className="text-xs text-gray-600 italic">No past chats</div>
              ) : (
                Object.entries(groupedHistory).map(([groupName, chats]) => {
                  if (chats.length === 0) return null;
                  return (
                    <div key={groupName} className="flex flex-col gap-1">
                      <div className="text-[10px] font-semibold text-gray-600 sticky top-0 bg-[#18181b] z-10 pb-1">
                        {groupName}
                      </div>
                      {chats.map((chat: ChatSession) => (
                        <div 
                          key={chat.id} 
                          onClick={() => onSelectChat(chat.id)}
                          className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm transition-colors ${chat.id === currentChatId ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5"}`}
                        >
                          {editingChatId === chat.id ? (
                            <input 
                              type="text" 
                              autoFocus
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (editingTitle.trim()) onRenameChat(chat.id, editingTitle.trim());
                                  setEditingChatId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingChatId(null);
                                }
                              }}
                              onBlur={() => {
                                if (editingTitle.trim() && editingTitle.trim() !== chat.title) {
                                  onRenameChat(chat.id, editingTitle.trim());
                                }
                                setEditingChatId(null);
                              }}
                              className="flex-1 bg-black/50 border border-[#76B900]/50 rounded px-2 py-0.5 text-white outline-none mr-2 text-sm w-full"
                            />
                          ) : (
                            <span className="truncate flex-1"><MessageSquare size={14} className="inline mr-2 opacity-50"/>{chat.title}</span>
                          )}
                          
                          {editingChatId !== chat.id && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setEditingChatId(chat.id);
                                  setEditingTitle(chat.title);
                                }}
                                className="p-1 hover:text-[#76B900] transition-colors"
                                title="Rename"
                              >
                                <Pencil size={14} />
                              </button>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setChatToDelete(chat.id);
                                }}
                                className="p-1 hover:text-red-400 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        <div className="mt-auto flex flex-col border-t border-white/5 bg-[#18181b]">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-between p-4 w-full hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-200 transition-colors">
              <SlidersHorizontal size={14} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Configuration</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 text-[10px]">
              {selectedModelObj?.name && <span className="truncate max-w-[120px]">{selectedModelObj.name}</span>}
            </div>
          </button>

          <div className="p-4 border-t border-white/5 space-y-2 bg-[#111]/30">
            <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5 mb-2">
              <div className="flex items-center gap-2">
                <UserCircle size={16} className="text-[#76B900]" />
                <span className="text-xs font-bold text-white capitalize">{session?.user?.name || "User"}</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-[#76B900] shadow-[0_0_5px_#76B900]"></span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onLogout}
                className="flex-1 flex items-center justify-center gap-1.5 border border-white/5 hover:bg-orange-500/10 hover:border-orange-500/30 text-gray-400 hover:text-orange-400 py-2 rounded-lg text-[10px] transition-colors"
                title="Clear API Key"
              >
                <Settings2 size={12} />
                Reset Key
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex-1 flex items-center justify-center gap-1.5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 py-2 rounded-lg text-[10px] transition-colors"
                title="Sign Out"
              >
                <LogOut size={12} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
