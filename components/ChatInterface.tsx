import { useState, useRef, useEffect } from "react";
import { Send, Square, Menu, Paperclip, X, Mic, Check, Copy, Globe, PanelLeft, Network, RefreshCw, ArrowDown, Download, ChevronDown, Library, Book } from "lucide-react";
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
  chatId: string | null;
  initialMessages?: any[];
  onChatCreated?: (id: string) => void;
  onChatUpdated?: () => void;
  chatTitle?: string;
  selectedCollection: string | null;
  selectedCollectionName?: string;
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
  chatId,
  chatTitle,
  initialMessages = [],
  onChatCreated,
  onChatUpdated,
  selectedCollection,
  selectedCollectionName,
}: ChatInterfaceProps) {
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<{name: string, content: string, type: string, images?: string[]}[]>([]);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const startInputRef = useRef("");
  const [autoScroll, setAutoScroll] = useState(true);
  const pendingMessageRef = useRef<any>(null);
  const sessionModelsRef = useRef<Record<string, string>>({});

  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };


  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, append, error, reload } = useChat({
    api: "/api/chat",
    initialMessages: initialMessages.length > 0 ? initialMessages : (systemPrompt ? [{ id: 'system', role: 'system', content: systemPrompt }] : []),
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model: selectedModel,
      temperature,
      webSearchEnabled,
      chatId,
      collectionId: selectedCollection,
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
  
  // Only update system prompt for NEW empty chats when systemPrompt changes
  useEffect(() => {
    if (messages.length === 0 && systemPrompt) {
       setMessages([{ id: 'system', role: 'system', content: systemPrompt }]);
    } else if (messages.length === 1 && messages[0].role === 'system' && messages[0].content !== systemPrompt) {
       // If it's a new chat with just a system prompt, update it
       setMessages(systemPrompt ? [{ id: 'system', role: 'system', content: systemPrompt }] : []);
    }
  }, [systemPrompt]);

  // Instantly lock in the model name for newly streaming AI messages (ignore historical messages)
  useEffect(() => {
    messages.forEach(msg => {
      const isHistorical = initialMessages.some((orig: any) => orig.id === msg.id);
      if (msg.role === 'assistant' && !isHistorical && !sessionModelsRef.current[msg.id] && !(msg as any).model) {
        sessionModelsRef.current[msg.id] = selectedModel;
      }
    });
  }, [messages, selectedModel, initialMessages]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      if (selectedModelCategory !== "vision") {
        setAlertMessage("Image uploads are only supported for Vision models. Please select a Vision model to upload images.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setAttachedImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    // Document handling
    setIsParsingFile(true);
    try {
      let extractedText = "";

      let pdfObj: any = null;

      if (file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        extractedText = await file.text();
      } else if (file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
        
        pdfObj = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        let text = '';
        for (let i = 1; i <= pdfObj.numPages; i++) {
          const page = await pdfObj.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
        extractedText = text;
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        // Fallback or explicit browser import
        const mammoth = (await import('mammoth')).default || (await import('mammoth'));
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      }

      // Detect garbled OCR text (e.g. hidden layers in scanned PDFs with missing font maps)
      let isGarbled = false;
      if (extractedText && extractedText.length > 50) {
        // Count valid alphanumeric characters (supports all languages via Unicode properties)
        const validChars = extractedText.match(/[\p{L}\p{N}]/gu);
        const validCount = validChars ? validChars.length : 0;
        
        // If less than 35% of the text is actual letters/numbers, it's almost certainly garbled font-mapping
        if (validCount / extractedText.length < 0.35) {
          isGarbled = true;
          console.warn("Detected garbled PDF text layer. Falling back to image extraction.");
        }
      }

      if (extractedText && extractedText.trim().length > 0 && !isGarbled) {
        setAttachedFiles(prev => [...prev, {
          name: file.name,
          content: extractedText,
          type: file.type
        }]);
      } else if (pdfObj && selectedModelCategory === "vision") {
        // Scanned PDF Fallback - Convert to images
        const newImages: string[] = [];
        const maxPages = Math.min(pdfObj.numPages, 10); // Limit to 10 pages to avoid massive canvas height

        // First pass: get dimensions
        let totalHeight = 0;
        let maxWidth = 0;
        const pageViewports: any[] = [];
        
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdfObj.getPage(i);
          const viewport = page.getViewport({ scale: 1.2 });
          totalHeight += viewport.height;
          maxWidth = Math.max(maxWidth, viewport.width);
          pageViewports.push({ page, viewport });
        }
        
        // Create one giant stitched canvas
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        const context = canvas.getContext('2d');
        
        if (context) {
          // Fill background with white
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);
          
          let currentY = 0;
          for (const { page, viewport } of pageViewports) {
            // Render each page to a temporary canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = viewport.width;
            tempCanvas.height = viewport.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            if (tempCtx) {
              await page.render({ canvasContext: tempCtx, viewport }).promise;
              // Draw the rendered page onto the main stitched canvas
              context.drawImage(tempCanvas, 0, currentY);
            }
            currentY += viewport.height;
          }
          
          // Export the fully stitched continuous document as ONE single image
          newImages.push(canvas.toDataURL('image/jpeg', 0.6));
        }
        setAttachedFiles(prev => [...prev, {
          name: file.name,
          content: "",
          type: file.type,
          images: newImages
        }]);

        if (pdfObj.numPages > 10) {
          setAlertMessage(`The scanned document "${file.name}" has ${pdfObj.numPages} pages. To prevent API limits, only the first 10 pages will be read by the Vision model.`);
        }
      } else {
        setAlertMessage(`No text could be extracted from ${file.name}. If this is a scanned document, please select a Vision model to read it.`);
      }
    } catch (err) {
      console.error("Error parsing file", err);
      setAlertMessage("Failed to parse file.");
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      setAlertMessage("Voice input is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    // Always create a fresh instance to avoid Android session caching bugs
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    let currentSessionTranscript = "";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      currentSessionTranscript += finalTranscript;
      
      handleInputChange({ 
        target: { 
          value: startInputRef.current + (startInputRef.current ? " " : "") + currentSessionTranscript + interimTranscript 
        } 
      } as any);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    startInputRef.current = input || "";

    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!(input || "").trim() && attachedImages.length === 0 && attachedFiles.length === 0) return;
    if (!selectedModel) return;

    const dataPayload: any = {};
    if (attachedImages.length > 0 && selectedModelCategory === "vision") {
      dataPayload.images = attachedImages;
    }
    if (attachedFiles.length > 0) {
      const validContexts = attachedFiles.filter(f => f.content).map(f => ({
        name: f.name,
        content: f.content,
        type: f.type
      }));
      if (validContexts.length > 0) {
        dataPayload.fileContexts = validContexts;
      }

      const fileImages = attachedFiles.filter(f => f.images).flatMap(f => f.images || []);
      if (fileImages.length > 0 && selectedModelCategory === "vision") {
        dataPayload.images = [...(dataPayload.images || []), ...fileImages];
      }
    }

    // Claude-style Interruption: Stop current generation and queue the new prompt
    if (isLoading) {
      stop(); // Abort the current stream

      pendingMessageRef.current = {
        id: Date.now().toString(),
        role: "user",
        content: input,
        data: Object.keys(dataPayload).length > 0 ? dataPayload : undefined
      };
      
      setAttachedImages([]);
      setAttachedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      handleInputChange({ target: { value: "" } } as any);
      return;
    }

    // Normal Submit
    append({
      id: Date.now().toString(),
      role: "user",
      content: input,
      data: Object.keys(dataPayload).length > 0 ? dataPayload : undefined
    });
    
    handleInputChange({ target: { value: "" } } as any);
    setAttachedImages([]);
    setAttachedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // programmatic submit
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  };

  const displayMessages = messages.filter(m => m.role !== 'system').map(msg => {
    // Vercel AI SDK strips custom fields from initialMessages when initializing state.
    // We map them back here so the UI can display the model badge.
    const originalMsg = initialMessages.find((orig: any) => orig.id === msg.id);
    return {
      ...msg,
      model: (msg as any).model || originalMsg?.model
    };
  });

  const renderMessageContent = (content: string) => {
    return (
      <div className="text-[15px] leading-relaxed overflow-x-hidden prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0 prose-headings:text-white prose-headings:font-semibold prose-a:text-[#76B900] prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-strong:font-bold">
         <ReactMarkdown 
           remarkPlugins={[remarkGfm]}
           components={{
             code: CodeBlock as any,
             a: ({node, ...props}) => (
               <a className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#76B900] bg-[#76B900]/10 hover:bg-[#76B900]/20 px-2.5 py-1 rounded-md transition-all mx-0.5 border border-[#76B900]/20 whitespace-nowrap" target="_blank" rel="noopener noreferrer" {...props}>
                 <Globe size={12} className="opacity-80" />
                 <span className="truncate max-w-[250px]">{props.children}</span>
               </a>
             )
           }}
         >
           {content}
         </ReactMarkdown>
      </div>
    );
  };

  const renderMessageList = (msgs: any[], currentIsLoading: boolean, currentReload: any, targetModel: string) => (
    <>
      {msgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center max-w-xl mx-auto mt-10">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_30px_rgba(168,85,247,0.3)] mb-6">
            <Network size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">How can I help you today?</h2>
          <p className="text-[15px] leading-relaxed text-gray-400">Select a model from the sidebar and start chatting.</p>
        </div>
      ) : (
        msgs.map((msg) => (
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
                  <span className="text-[15px] font-semibold text-gray-100 flex items-center gap-2">
                    Synapse 
                    {(() => {
                      const modelName = (msg as any).model;
                      const isLastMessage = msg.id === msgs[msgs.length - 1]?.id;
                      
                      let displayModel = null;
                      if (modelName) {
                        displayModel = modelName;
                      } else if (sessionModelsRef.current[msg.id]) {
                        displayModel = sessionModelsRef.current[msg.id];
                      } else if (isLastMessage) {
                        displayModel = targetModel;
                      } else {
                        displayModel = "Legacy";
                      }

                      if (!displayModel) return null;

                      return (
                        <span className="text-[9px] font-mono font-medium text-gray-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded tracking-wider">
                          {displayModel.split('/').pop()}
                        </span>
                      );
                    })()}
                  </span>
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
              <div id={`message-${msg.id}`} className={`${msg.role === 'assistant' ? 'pl-9' : ''} group relative pb-6`}>
                {(msg.data as any)?.imageUrl && msg.role === 'user' ? (
                  <div className="flex flex-col gap-3">
                    <img src={(msg.data as any).imageUrl} alt="Upload" className="rounded-lg max-w-sm max-h-64 object-contain border border-white/10" />
                    {renderMessageContent(msg.content)}
                  </div>
                ) : (
                  renderMessageContent(msg.content)
                )}

                {msg.role === 'assistant' && !currentIsLoading && (
                  <div className="absolute -bottom-1 left-9 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 print:hidden">
                    <button onClick={() => handleCopyMessage(msg.content, msg.id)} className="flex items-center gap-1.5 p-1 text-xs text-gray-500 hover:text-white bg-transparent hover:bg-white/10 rounded transition-colors" title="Copy Message">
                       {copiedMessageId === msg.id ? <Check size={14} className="text-[#76B900]"/> : <Copy size={14} />}
                    </button>
                    {msg.id === msgs[msgs.length - 1]?.id && (
                      <button onClick={() => currentReload()} className="flex items-center gap-1.5 p-1 text-xs text-gray-500 hover:text-white bg-transparent hover:bg-white/10 rounded transition-colors" title="Regenerate Response">
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
      
      {currentIsLoading && msgs[msgs.length - 1]?.role === 'user' && (
        <div className="flex justify-start w-full max-w-3xl mx-auto">
          <div className="max-w-full text-gray-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                <Network size={14} className="text-white" />
              </div>
              <span className="text-[15px] font-semibold text-gray-100 flex items-center gap-2">
                Synapse 
                <span className="text-[9px] font-mono font-medium text-gray-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded tracking-wider">
                  {targetModel ? targetModel.split('/').pop() : "Model"}
                </span>
              </span>
            </div>
            <div className="pl-9 flex items-center gap-1.5 h-6">
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <main className="flex-1 flex flex-col h-full bg-transparent relative z-10 print:bg-white print:text-black">
      <header className="h-[64px] flex items-center px-5 glass-panel border-b border-white/5 border-x-0 border-t-0 shrink-0 relative z-50 print:hidden">
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
        
        <div className="flex-1 flex flex-col items-center justify-center">
          {chatTitle && chatTitle !== "New Chat" && (
            <h2 className="text-[13px] font-semibold text-white pointer-events-none">{chatTitle}</h2>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[11px] font-medium pointer-events-none ${chatTitle && chatTitle !== "New Chat" ? "text-gray-400" : "text-gray-200"}`}>
              {selectedModel ? selectedModel.split('/').pop() : "New Chat"}
            </span>
            <span className="px-1 py-[1px] rounded-md bg-white/5 border border-white/10 text-[8px] font-mono text-gray-500 tracking-wider pointer-events-none">
              MODEL
            </span>
            
            {/* Knowledge Base Badge */}
            {selectedCollection && (
              <div className="flex items-center gap-1.5 ml-2 bg-[#76B900]/10 border border-[#76B900]/20 text-[#76B900] px-2.5 py-1 rounded-lg">
                <Book size={12} />
                <span className="text-[11px] font-semibold">{selectedCollectionName || "Knowledge Base Chat"}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-8 w-full relative print:overflow-visible print:h-auto print:block"
        onScroll={handleScroll}
      >
        {renderMessageList(displayMessages, isLoading, reload, selectedModel || "")}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && !isLoading && (
          <div className="flex justify-start w-full max-w-3xl mx-auto">
            <div className="pl-9 w-full">
              <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/30 text-red-300">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold text-red-400">⚠ Error</span>
                </div>
                <p className="text-sm">{error?.message || "Something went wrong. Please try again."}</p>
              </div>
            </div>
          </div>
        )}

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
          {attachedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 ml-2 mt-2 mb-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative w-16 h-16 shrink-0 group">
                  <img src={img} alt="Attachment preview" className="w-full h-full object-cover rounded-lg border border-white/20" />
                  <button 
                    type="button"
                    onClick={() => {
                      setAttachedImages(prev => prev.filter((_, idx) => idx !== i));
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 ml-2 mt-2 mb-2">
              {attachedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-[#1e1e1e] border border-white/10 px-2.5 py-1.5 rounded-lg text-xs text-gray-300">
                  <span className="truncate max-w-[120px] font-medium text-[#76B900]">{f.name}</span>
                  <button 
                    type="button" 
                    onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-gray-500 hover:text-red-400 transition-colors ml-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isParsingFile && (
            <div className="flex items-center gap-2 ml-3 mt-2 mb-2 text-xs text-gray-400">
              <span className="w-3 h-3 border-2 border-t-[#76B900] border-transparent rounded-full animate-spin"></span>
              Extracting text...
            </div>
          )}
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <input 
              type="file" 
              accept={selectedModelCategory === "vision" ? "image/*,.pdf,.txt,.csv,.docx" : ".pdf,.txt,.csv,.docx"}
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
              title="Attach File or Image"
            >
              <Paperclip size={20} />
            </button>
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
              placeholder={webSearchEnabled ? "Ask anything (Web Search enabled)..." : "Type a message... (Enter to send, Shift+Enter for newline)"}
              className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none py-3 custom-scrollbar"
              minRows={1}
              maxRows={8}
              disabled={!selectedModel}
            />
            <div className="flex items-center gap-2 pr-1 pb-1">
              {webSearchEnabled && (
                <div className={`hidden sm:flex items-center justify-center p-1.5 mr-1 text-[#76B900] bg-[#76B900]/10 rounded-full`} title="Web Search Enabled">
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

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-red-500">⚠</span> Notice
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">{alertMessage}</p>
            <div className="flex items-center justify-end mt-2">
              <button 
                onClick={() => setAlertMessage(null)} 
                className="px-5 py-2 text-sm font-semibold bg-[#76B900] text-black hover:bg-[#86c900] rounded-lg transition-colors shadow-lg active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
