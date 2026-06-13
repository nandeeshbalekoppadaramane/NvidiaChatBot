import { useState, useRef, useEffect } from "react";
import { Send, Square, Menu, Paperclip, X, Mic, Check, Copy, Globe, PanelLeft, Network, RefreshCw, ArrowDown, Download } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useChat } from "ai/react";
import TextareaAutosize from 'react-textarea-autosize';

interface ChatInterfaceProps {
  onOpenMobileSidebar: () => void;
  isDesktopSidebarOpen: boolean;
  onToggleDesktopSidebar: () => void;
  selectedModel: string;
  selectedModelCategory?: string;
  systemPrompt: string;
  temperature: number;
  apiKey: string;
  webSearchEnabled: boolean;
  deepResearchEnabled?: boolean;
  chatId: string | null;
  initialMessages?: any[];
  onChatCreated?: (id: string) => void;
  onChatUpdated?: () => void;
  chatTitle?: string;
}

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  
  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="rounded-lg overflow-hidden my-4 border border-white/10 bg-[#1e1e1e] shadow-lg">
        <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-white/10">
          <span className="text-xs font-mono text-gray-300 capitalize">{lang}</span>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors"
          >
            {copied ? <Check size={14} className="text-[#76B900]" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Code"}
          </button>
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={lang}
          PreTag="div"
          customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.85rem' }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    );
  }
  return (
    <code className="bg-black/30 rounded px-1.5 py-0.5 font-mono text-sm text-[#76B900]" {...props}>
      {children}
    </code>
  );
};

export function ChatInterface({
  onOpenMobileSidebar,
  isDesktopSidebarOpen,
  onToggleDesktopSidebar,
  selectedModel,
  selectedModelCategory = "chat",
  systemPrompt,
  temperature,
  apiKey,
  webSearchEnabled = false,
  deepResearchEnabled = false,
  chatId,
  chatTitle,
  initialMessages = [],
  onChatCreated,
  onChatUpdated,
}: ChatInterfaceProps) {
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const startInputRef = useRef("");
  const [autoScroll, setAutoScroll] = useState(true);
  const pendingMessageRef = useRef<any>(null);

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, append, error, reload } = useChat({
    api: "/api/chat",
    initialMessages: systemPrompt ? [{ id: 'system', role: 'system', content: systemPrompt }] : initialMessages,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model: selectedModel,
      temperature,
      webSearchEnabled,
      deepResearchEnabled,
      chatId,
    },
    onResponse: (response) => {
      const newChatId = response.headers.get("x-chat-id");
      if (newChatId && !chatId && onChatCreated) {
        onChatCreated(newChatId);
      }
    },
    onFinish: () => {
      if (onChatUpdated) onChatUpdated();
    },
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
    if (autoScroll && messagesEndRef.current) {
      // Use 'auto' instead of 'smooth' to prevent jittering during fast token streaming
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    // If the user scrolls up more than 100px from the bottom, pause auto-scroll
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setAutoScroll(isAtBottom);
  };

  // Robust Interruption Handler: When the stream stops (isLoading becomes false), send any queued message
  useEffect(() => {
    if (!isLoading && pendingMessageRef.current) {
      const msg = pendingMessageRef.current;
      pendingMessageRef.current = null;
      // Wait a short tick to guarantee useChat's internal state machine is completely unlocked
      setTimeout(() => {
        append(msg);
      }, 150);
    }
  }, [isLoading, append]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        handleInputChange({ target: { value: startInputRef.current + (startInputRef.current ? " " : "") + transcript } } as any);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }

    startInputRef.current = input || "";
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedModel || !(input || "").trim()) return;

    // Claude-style Interruption: Stop current generation and queue the new prompt
    if (isLoading) {
      stop(); // Abort the current stream
      
      // Queue the new message to be sent exactly when the abort resolves
      if (selectedModelCategory === "vision" && attachedImage) {
        pendingMessageRef.current = {
          id: Date.now().toString(),
          role: "user",
          content: input,
          data: { imageUrl: attachedImage }
        };
        setAttachedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        pendingMessageRef.current = {
          id: Date.now().toString(),
          role: "user",
          content: input,
        };
      }
      handleInputChange({ target: { value: "" } } as any);
      return;
    }

    if (selectedModelCategory === "vision" && attachedImage) {
      // Send with data attached
      append({
        id: Date.now().toString(),
        role: "user",
        content: input,
        data: { imageUrl: attachedImage }
      });
      handleInputChange({ target: { value: "" } } as any);
      setAttachedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

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

  const renderMessageContent = (content: string) => {
    // Check if the content has a <think> block
    const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thinkMatch) {
      const thinkContent = thinkMatch[1].trim();
      const restContent = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
      
      return (
        <div className="flex flex-col gap-3 w-full">
          {thinkContent && (
            <div className="bg-black/20 border border-white/5 p-3 rounded-xl text-xs text-gray-400 italic custom-scrollbar overflow-x-auto">
              <div className="font-semibold text-gray-500 mb-1.5 flex items-center gap-2 not-italic">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                Thinking Process...
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{thinkContent}</div>
            </div>
          )}
          {restContent && (
            <div className="text-sm leading-relaxed overflow-x-hidden">
               <ReactMarkdown 
                 remarkPlugins={[remarkGfm]}
                 components={{
                   code: CodeBlock as any,
                   p: ({node, ...props}) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
                   ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-1.5" {...props} />,
                   ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-1.5" {...props} />,
                   li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                   h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 mt-6 text-[#76B900]" {...props} />,
                   h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-3 mt-5 text-white" {...props} />,
                   h3: ({node, ...props}) => <h3 className="text-lg font-semibold mb-2 mt-4 text-gray-200" {...props} />,
                   table: ({node, ...props}) => <div className="overflow-x-auto mb-4 custom-scrollbar"><table className="w-full border-collapse text-left text-sm" {...props} /></div>,
                   th: ({node, ...props}) => <th className="border-b border-white/20 bg-white/5 p-3 font-semibold text-gray-200" {...props} />,
                   td: ({node, ...props}) => <td className="border-b border-white/5 p-3 text-gray-300 align-top" {...props} />,
                   blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#76B900] pl-4 italic text-gray-400 my-4 bg-[#76B900]/5 py-2 pr-2 rounded-r" {...props} />,
                   a: ({node, ...props}) => (
                     <a className="inline-flex items-center gap-1 text-[11px] font-bold text-[#76B900] bg-[#76B900]/10 hover:bg-[#76B900]/20 px-2 py-0.5 rounded-md transition-all mx-0.5 border border-[#76B900]/20 whitespace-nowrap" target="_blank" rel="noopener noreferrer" {...props}>
                       <Globe size={10} className="opacity-80" />
                       <span className="truncate max-w-[200px]">{props.children}</span>
                     </a>
                   )
                 }}
               >
                 {restContent}
               </ReactMarkdown>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="text-sm leading-relaxed overflow-x-hidden">
         <ReactMarkdown 
           remarkPlugins={[remarkGfm]}
           components={{
             code: CodeBlock as any,
             p: ({node, ...props}) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
             ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-1.5" {...props} />,
             ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-1.5" {...props} />,
             li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
             h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 mt-6 text-[#76B900]" {...props} />,
             h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-3 mt-5 text-white" {...props} />,
             h3: ({node, ...props}) => <h3 className="text-lg font-semibold mb-2 mt-4 text-gray-200" {...props} />,
             table: ({node, ...props}) => <div className="overflow-x-auto mb-4 custom-scrollbar"><table className="w-full border-collapse text-left text-sm" {...props} /></div>,
             th: ({node, ...props}) => <th className="border-b border-white/20 bg-white/5 p-3 font-semibold text-gray-200" {...props} />,
             td: ({node, ...props}) => <td className="border-b border-white/5 p-3 text-gray-300 align-top" {...props} />,
             blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#76B900] pl-4 italic text-gray-400 my-4 bg-[#76B900]/5 py-2 pr-2 rounded-r" {...props} />,
             a: ({node, ...props}) => <a className="text-[#76B900] hover:underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />
           }}
         >
           {content}
         </ReactMarkdown>
      </div>
    );
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-transparent relative z-10 print:bg-white print:text-black">
      <header className="h-[64px] flex items-center px-5 glass-panel border-b border-white/5 border-x-0 border-t-0 shrink-0 relative print:hidden">
        <div className="flex items-center gap-4 absolute left-5">
          {!isDesktopSidebarOpen && (
            <button onClick={onToggleDesktopSidebar} className="hidden md:block text-gray-400 hover:text-white transition-colors" title="Open Sidebar">
              <PanelLeft size={22} />
            </button>
          )}
          <button onClick={onOpenMobileSidebar} className="md:hidden text-gray-400 hover:text-white transition-colors">
            <Menu size={22} />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center pointer-events-none">
          {chatTitle && chatTitle !== "New Chat" && (
            <h2 className="text-[13px] font-semibold text-white">{chatTitle}</h2>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[11px] font-medium ${chatTitle && chatTitle !== "New Chat" ? "text-gray-400" : "text-gray-200"}`}>
              {selectedModel ? selectedModel.split('/').pop() : "New Chat"}
            </span>
            <span className="px-1 py-[1px] rounded-md bg-white/5 border border-white/10 text-[8px] font-mono text-gray-500 tracking-wider">
              MODEL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 absolute right-5">
          {messages.length > 0 && (
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors border border-white/10"
              title="Export Chat to PDF"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          )}
        </div>
      </header>

      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-8 w-full relative print:overflow-visible print:h-auto print:block"
        onScroll={handleScroll}
      >
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-xl mx-auto mt-10">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_30px_rgba(168,85,247,0.3)] mb-6">
              <Network size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-white">How can I help you today?</h2>
            <p className="text-[15px] leading-relaxed text-gray-400">Select a model from the sidebar and start chatting. Enjoy the minimalist experience.</p>
          </div>
        ) : (
          displayMessages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full max-w-3xl mx-auto`}
            >
              <div className={`w-full ${
                msg.role === 'user' 
                  ? 'max-w-[85%] md:max-w-[75%] bg-[#2f2f2f] text-gray-100 rounded-3xl py-3.5 px-5' 
                  : 'max-w-full text-gray-300'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                      <Network size={14} className="text-white" />
                    </div>
                    <span className="text-[15px] font-semibold text-gray-100">Synapse</span>
                    {msg.createdAt && (
                      <span 
                        className="text-[11px] text-gray-500 font-normal ml-1.5 mt-0.5 cursor-default transition-colors hover:text-gray-400"
                        title={new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}
                <div className={`${msg.role === 'assistant' ? 'pl-9' : ''} group relative pb-6`}>
                  {(msg.data as any)?.imageUrl && msg.role === 'user' ? (
                    <div className="flex flex-col gap-3">
                      <img src={(msg.data as any).imageUrl} alt="Upload" className="rounded-lg max-w-sm max-h-64 object-contain border border-white/10" />
                      {renderMessageContent(msg.content)}
                    </div>
                  ) : (
                    renderMessageContent(msg.content)
                  )}

                  {msg.role === 'assistant' && !isLoading && (
                    <div className="absolute -bottom-1 left-9 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 print:hidden">
                      <button onClick={() => handleCopyMessage(msg.content, msg.id)} className="flex items-center gap-1.5 p-1 text-xs text-gray-500 hover:text-white bg-transparent hover:bg-white/10 rounded transition-colors" title="Copy Message">
                         {copiedMessageId === msg.id ? <Check size={14} className="text-[#76B900]"/> : <Copy size={14} />}
                      </button>
                      {msg.id === messages[messages.length - 1]?.id && (
                        <button onClick={() => reload()} className="flex items-center gap-1.5 p-1 text-xs text-gray-500 hover:text-white bg-transparent hover:bg-white/10 rounded transition-colors" title="Regenerate Response">
                           <RefreshCw size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && displayMessages[displayMessages.length - 1]?.role === 'user' && (
          <div className="flex justify-start w-full max-w-3xl mx-auto">
            <div className="max-w-full text-gray-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                  <Network size={14} className="text-white" />
                </div>
                <span className="text-[15px] font-semibold text-gray-100">Synapse</span>
              </div>
              <div className="pl-9 flex items-center gap-1.5 h-6">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />

        {/* Error display */}
        {error && !isLoading && (
          <div className="flex justify-start w-full max-w-3xl mx-auto">
            <div className="pl-9 w-full">
              <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/30 text-red-300">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold text-red-400">⚠ Error</span>
                </div>
                <p className="text-sm">{error.message || "Something went wrong. Please try again."}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6 shrink-0 bg-[#1e1e1e]/80 backdrop-blur-md relative print:hidden">
        {!autoScroll && messages.length > 0 && (
          <button 
            onClick={() => {
              setAutoScroll(true);
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#2f2f2f] hover:bg-[#3f3f3f] text-white border border-white/10 rounded-full p-2 shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all flex items-center justify-center animate-in fade-in slide-in-from-bottom-2"
          >
            <ArrowDown size={18} />
          </button>
        )}
        <div className="max-w-3xl mx-auto bg-[#2f2f2f] rounded-3xl p-1.5 focus-within:ring-1 focus-within:ring-gray-500 transition-all flex flex-col">
          {attachedImage && (
            <div className="relative w-16 h-16 ml-2 mt-2 mb-2 group">
              <img src={attachedImage} alt="Attachment preview" className="w-full h-full object-cover rounded-lg border border-white/20" />
              <button 
                type="button"
                onClick={() => { setAttachedImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            {selectedModelCategory === "vision" && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
              >
                <Paperclip size={20} />
              </button>
            )}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-xl transition-colors shrink-0 ${isListening ? 'text-red-500 bg-red-500/20 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              <Mic size={20} />
            </button>
            <TextareaAutosize
              value={input || ""}
              onChange={handleInputChange as any}
              onKeyDown={handleKeyDown as any}
              placeholder={deepResearchEnabled ? "Ask a complex question for Deep Research (Agent mode)..." : webSearchEnabled ? "Ask anything (Web Search enabled)..." : "Type a message... (Enter to send, Shift+Enter for newline)"}
              className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none py-3 custom-scrollbar"
              minRows={1}
              maxRows={8}
              disabled={!selectedModel}
            />
            <div className="flex items-center gap-2 pr-1 pb-1">
              {webSearchEnabled && (
                <div className={`hidden sm:flex items-center justify-center p-1.5 mr-1 ${deepResearchEnabled ? 'text-purple-400 bg-purple-500/10' : 'text-[#76B900] bg-[#76B900]/10'} rounded-full`} title={deepResearchEnabled ? "Deep Research Enabled" : "Web Search Enabled"}>
                  <Globe size={16} />
                </div>
              )}
              
              {/* Show Stop button ONLY if generating AND input is empty */}
              {isLoading && !(input || "").trim() && (
                <button
                  type="button"
                  onClick={stop}
                  className="p-2.5 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-xl transition-colors disabled:opacity-50"
                  title="Stop generation"
                >
                  <Square size={18} fill="currentColor" />
                </button>
              )}
              
              {/* Show Send button if NOT generating, OR if they started typing a new prompt during generation */}
              {(!isLoading || (input || "").trim().length > 0) && (
                <button
                  type="submit"
                  disabled={!(input || "").trim() || !selectedModel}
                  className="p-2.5 bg-[#76B900] text-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(118,185,0,0.2)]"
                  title={isLoading ? "Interrupt & Send" : "Send message"}
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </form>
        </div>
        <div className="text-center mt-3">
          <span className="text-[10px] text-gray-500">Synapse AI can make mistakes. Consider verifying important information.</span>
        </div>
      </div>
    </main>
  );
}
