import { useState, useRef, useEffect } from "react";
import { Send, Square, Menu, Paperclip } from "lucide-react";
import { useChat } from "ai/react";

interface ChatInterfaceProps {
  onOpenSidebar: () => void;
  selectedModel: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  apiKey: string;
}

export function ChatInterface({
  onOpenSidebar,
  selectedModel,
  systemPrompt,
  temperature,
  maxTokens,
  apiKey
}: ChatInterfaceProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages } = useChat({
    api: "/api/chat",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model: selectedModel,
      temperature,
      maxTokens,
    },
    initialMessages: systemPrompt ? [{ id: 'system', role: 'system', content: systemPrompt }] : [],
    onError: (error) => {
      console.error("Chat Error:", error);
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Update system prompt message if it changes (only affect new chats ideally)
  useEffect(() => {
    if (messages.length <= 1) {
       if (systemPrompt) {
         setMessages([{ id: 'system', role: 'system', content: systemPrompt }]);
       } else {
         setMessages([]);
       }
    }
  }, [systemPrompt]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedModel) return;
    handleSubmit(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // programmatic submit
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  };

  const displayMessages = messages.filter(m => m.role !== 'system');

  return (
    <main className="flex-1 flex flex-col h-full bg-transparent relative z-10">
      <header className="h-[64px] flex items-center justify-between px-5 glass-panel border-b border-white/5 border-x-0 border-t-0 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onOpenSidebar} className="md:hidden text-gray-400 hover:text-white">
            <Menu size={22} />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-white">NVIDIA Chat</h2>
            <p className="text-xs text-gray-400">{selectedModel || "Select a model to begin"}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6">
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#76B900] to-[#00b4d8] flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(118,185,0,0.2)]">
               <div className="w-8 h-8 rounded-[50%_50%_50%_8px] bg-bg-deep -rotate-45 relative flex items-center justify-center">
                 <div className="w-3 h-3 rounded-full bg-[#76B900] shadow-[0_0_8px_rgba(118,185,0,0.8)]" />
               </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
            <p className="text-sm text-gray-400">Select a model from the sidebar and start chatting with NVIDIA's AI models.</p>
          </div>
        ) : (
          displayMessages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}
            >
              <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-[#76B900]/20 to-[#5a8f00]/20 border border-[#76B900]/30 text-white rounded-br-sm' 
                  : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-sm glass-panel'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full bg-[#76B900] flex items-center justify-center">
                       <span className="text-[8px] font-bold text-black">AI</span>
                    </div>
                    <span className="text-xs font-semibold text-[#76B900]">NVIDIA</span>
                  </div>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && displayMessages[displayMessages.length - 1]?.role === 'user' && (
          <div className="flex justify-start w-full">
            <div className="max-w-[85%] rounded-2xl p-4 bg-white/5 border border-white/10 text-gray-200 rounded-bl-sm glass-panel flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#76B900] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#76B900] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#76B900] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 md:p-6 shrink-0">
        <div className="max-w-4xl mx-auto glass-panel rounded-2xl border border-white/10 p-2 shadow-2xl focus-within:border-[#76B900]/50 focus-within:shadow-[0_0_30px_rgba(118,185,0,0.15)] transition-all">
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <button type="button" className="p-3 text-gray-400 hover:text-white transition-colors" title="Attach file (UI only)">
              <Paperclip size={20} />
            </button>
            <textarea
              value={input || ""}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
              className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none max-h-[200px] min-h-[44px] py-3"
              rows={1}
              disabled={!selectedModel}
              style={{ height: 'auto' }}
            />
            <div className="flex items-center gap-2 pr-1 pb-1">
              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  className="p-2.5 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-xl transition-colors"
                >
                  <Square size={18} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!(input || "").trim() || !selectedModel}
                  className="p-2.5 bg-gradient-to-br from-[#76B900] to-[#5a8f00] text-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(118,185,0,0.3)]"
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </form>
        </div>
        <div className="text-center mt-3">
          <span className="text-[10px] text-gray-500">Responses are generated by NVIDIA AI models and may be inaccurate.</span>
        </div>
      </div>
    </main>
  );
}
