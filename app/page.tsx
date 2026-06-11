"use client";

import { useState, useEffect } from "react";
import { ApiKeyLogin } from "@/components/ApiKeyLogin";
import { Sidebar } from "@/components/Sidebar";
import { ChatInterface } from "@/components/ChatInterface";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [models, setModels] = useState<any[]>([]);
  
  // Settings
  const [selectedModel, setSelectedModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [systemPrompt, setSystemPrompt] = useState("");
  
  // Chat state
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load from local storage
  useEffect(() => {
    setIsMounted(true);
    const savedKey = localStorage.getItem("nv_api_key");
    if (savedKey) setApiKey(savedKey);

    const savedModel = localStorage.getItem("nv_last_model");
    if (savedModel) setSelectedModel(savedModel);

    const savedTemp = localStorage.getItem("nv_temperature");
    if (savedTemp) setTemperature(parseFloat(savedTemp));

    const savedTokens = localStorage.getItem("nv_max_tokens");
    if (savedTokens) setMaxTokens(parseInt(savedTokens));

    const savedHistory = localStorage.getItem("nv_history");
    if (savedHistory) {
      try {
        setChatHistory(JSON.parse(savedHistory));
      } catch (e) {}
    }
  }, []);

  // Save settings to local storage when they change
  useEffect(() => {
    if (isMounted && selectedModel) localStorage.setItem("nv_last_model", selectedModel);
  }, [selectedModel, isMounted]);

  useEffect(() => {
    if (isMounted) localStorage.setItem("nv_temperature", temperature.toString());
  }, [temperature, isMounted]);

  useEffect(() => {
    if (isMounted) localStorage.setItem("nv_max_tokens", maxTokens.toString());
  }, [maxTokens, isMounted]);

  useEffect(() => {
    if (isMounted && apiKey) localStorage.setItem("nv_api_key", apiKey);
  }, [apiKey, isMounted]);

  useEffect(() => {
    if (isMounted) localStorage.setItem("nv_history", JSON.stringify(chatHistory));
  }, [chatHistory, isMounted]);

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

  const handleLogin = (key: string) => {
    setApiKey(key);
  };

  const handleLogout = () => {
    setApiKey(null);
    localStorage.removeItem("nv_api_key");
  };

  const handleNewChat = () => {
    setCurrentChatId(Date.now().toString());
    // We would clear the useChat messages here if we could, 
    // but the ChatInterface component handles its own hook.
    // By giving it a unique key based on currentChatId, it will remount and reset!
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
    setIsSidebarOpen(false);
  };

  const handleDeleteChat = (id: string) => {
    setChatHistory(prev => prev.filter(c => c.id !== id));
    if (currentChatId === id) {
      setCurrentChatId(null);
    }
  };

  if (!isMounted) return null;

  if (!apiKey) {
    return <ApiKeyLogin onLogin={handleLogin} savedKey={localStorage.getItem("nv_api_key")} />;
  }

  // The chat UI
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        temperature={temperature}
        setTemperature={setTemperature}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        chatHistory={chatHistory}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onLogout={handleLogout}
      />
      <ChatInterface 
        key={currentChatId || 'default'}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        selectedModel={selectedModel}
        systemPrompt={systemPrompt}
        temperature={temperature}
        maxTokens={maxTokens}
        apiKey={apiKey}
      />
    </div>
  );
}
