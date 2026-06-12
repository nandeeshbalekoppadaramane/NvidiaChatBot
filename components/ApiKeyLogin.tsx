"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface ApiKeyLoginProps {
  onLogin: (apiKey: string) => void;
}

export function ApiKeyLogin({ onLogin }: ApiKeyLoginProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Please enter your API key.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Validate the key by attempting to fetch models
      const res = await fetch("/api/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid API Key");
      }

      onLogin(apiKey);
    } catch (err: any) {
      setError(err.message || "Failed to connect. Please check your API key.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="glass-card w-full max-w-md p-10 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/5 h-px bg-gradient-to-r from-transparent via-[#76B900] to-transparent" />
        
        {/* NVIDIA Logo CSS Art */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-[#76B900] to-[#00b4d8] flex items-center justify-center shadow-[0_0_60px_rgba(118,185,0,0.25)]"
          >
            <div className="w-6 h-6 rounded-[50%_50%_50%_8px] bg-bg-deep -rotate-45 relative flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#76B900] shadow-[0_0_8px_rgba(118,185,0,0.8)]" />
            </div>
          </motion.div>
          <div className="text-sm font-extrabold tracking-[6px] text-white indent-[6px]">
            NVIDIA
          </div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight mb-2 bg-gradient-to-br from-white to-[#8dd417] bg-clip-text text-transparent">
          NVIDIA AI Interface
        </h1>
        <p className="text-sm text-gray-400 mb-8">
          Connect to NVIDIA's powerful AI models
        </p>

        <form onSubmit={handleConnect} className="text-left mb-6">
          <div className="mb-6 relative">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm font-mono text-white outline-none focus:border-[#76B900]/50 focus:ring-2 focus:ring-[#76B900]/10 transition-all shadow-[0_0_30px_rgba(118,185,0,0.15)] focus:shadow-[0_0_60px_rgba(118,185,0,0.25)]"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-2 transition-colors"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="w-full relative overflow-hidden bg-gradient-to-br from-[#76B900] to-[#5a8f00] text-black font-semibold py-3.5 rounded-xl shadow-[0_0_30px_rgba(118,185,0,0.15)] hover:shadow-[0_0_60px_rgba(118,185,0,0.25)] hover:scale-[1.02] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect"
            )}
          </button>
        </form>


        {error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mt-4 text-sm text-red-500"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
