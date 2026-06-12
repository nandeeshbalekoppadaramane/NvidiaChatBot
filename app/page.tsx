"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ApiKeyLogin } from "@/components/ApiKeyLogin";
import { Sidebar } from "@/components/Sidebar";
import { ChatInterface } from "@/components/ChatInterface";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [models, setModels] = useState<any[]>([]);
  
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Settings
  const [selectedModel, setSelectedModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  
  // Chat state
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatSessionKey, setChatSessionKey] = useState<string>("default");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

  const fetchChats = async () => {
    const res = await fetch("/api/chats");
    if (res.ok) {
      const data = await res.json();
      setChatHistory(data);
    }
  };

  // Load settings from local storage
  useEffect(() => {
    setIsMounted(true);
    const savedModel = localStorage.getItem("synapse_last_model");
    if (savedModel) setSelectedModel(savedModel);

    const savedTemp = localStorage.getItem("synapse_temperature");
    if (savedTemp) setTemperature(parseFloat(savedTemp));

    const savedWebSearch = localStorage.getItem("synapse_web_search");
    if (savedWebSearch) setWebSearchEnabled(savedWebSearch === "true");
  }, []);

  // Fetch API Key & Chat History from database when authenticated
  useEffect(() => {
    if (status === "authenticated") {
      setIsLoadingKey(true);
      fetch("/api/settings")
        .then(res => res.json())
        .then(data => {
          if (data?.apiKey) setApiKey(data.apiKey);
        })
        .finally(() => setIsLoadingKey(false));
      
      const loadChats = async () => {
        const res = await fetch("/api/chats");
        if (res.ok) {
          const data = await res.json();
          setChatHistory(data);
          // We no longer auto-select the first chat; defaulting to New Chat
        }
      };
      loadChats();
    }
  }, [status]);

  // Save UI preferences to local storage when they change
  useEffect(() => {
    if (isMounted && selectedModel) localStorage.setItem("synapse_last_model", selectedModel);
  }, [selectedModel, isMounted]);

  useEffect(() => {
    if (isMounted) localStorage.setItem("synapse_temperature", temperature.toString());
  }, [temperature, isMounted]);

  useEffect(() => {
    if (isMounted) localStorage.setItem("synapse_web_search", webSearchEnabled.toString());
  }, [webSearchEnabled, isMounted]);

  // Fetch models when API key is set
  useEffect(() => {
    if (apiKey) {
      fetch("/api/models", {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.models) {
          setModels(data.models);
          if (!selectedModel && data.models.length > 0) {
            setSelectedModel(data.models[0].id);
          }
        }
      })
      .catch(console.error);
    }
  }, [apiKey]);

  const handleLogin = async (key: string) => {
    // Save to database
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key })
    });
    setApiKey(key);
  };

  const handleLogout = async () => {
    // We do NOT log out of the whole app, we just remove the API key
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "" })
    });
    setApiKey(null);
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setChatSessionKey(Date.now().toString());
    setIsMobileSidebarOpen(false);
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
    setChatSessionKey(id);
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteChat = async (id: string) => {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    setChatHistory(prev => prev.filter(c => c.id !== id));
    if (currentChatId === id) {
      setCurrentChatId(null);
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    setChatHistory(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  if (!isMounted || status === "loading") return null;

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  if (isLoadingKey) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#111]">
        <div className="w-8 h-8 rounded-full border-2 border-[#76B900] border-t-transparent animate-spin mb-4 shadow-[0_0_15px_rgba(118,185,0,0.5)]" />
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeyLogin onLogin={handleLogin} />;
  }

  // The chat UI
  const selectedModelObj = models.find(m => m.id === selectedModel);
  let selectedModelCategory = selectedModelObj?.category;
  if (!selectedModelCategory) {
    const smLower = selectedModel.toLowerCase();
    if (smLower.includes("vision") || smLower.includes("pixtral") || smLower.includes("llava")) {
      selectedModelCategory = "vision";
    } else {
      selectedModelCategory = "chat";
    }
  }

  const currentChat = chatHistory.find(c => c.id === currentChatId);
  const initialMessages = currentChat?.messages || [];

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen}
        isDesktopOpen={isDesktopSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        onDesktopToggle={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        temperature={temperature}
        setTemperature={setTemperature}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        chatHistory={chatHistory}
        currentChatId={currentChatId}
        webSearchEnabled={webSearchEnabled}
        setWebSearchEnabled={setWebSearchEnabled}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onLogout={handleLogout}
      />
      <ChatInterface 
        key={chatSessionKey}
        chatId={currentChatId}
        chatTitle={currentChat?.title}
        initialMessages={initialMessages}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        isDesktopSidebarOpen={isDesktopSidebarOpen}
        onToggleDesktopSidebar={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
        selectedModel={selectedModel}
        selectedModelCategory={selectedModelCategory}
        systemPrompt={systemPrompt}
        temperature={temperature}
        apiKey={apiKey}
        webSearchEnabled={webSearchEnabled}
        onChatCreated={(newId) => {
          setCurrentChatId(newId);
          // Instantly refresh from DB to get the smart title Claude-style
          fetchChats();
        }}
        onChatUpdated={fetchChats}
      />
    </div>
  );
}
