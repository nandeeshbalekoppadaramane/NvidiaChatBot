"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, User } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative z-10 p-4">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#76B900]/20 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#111] border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(118,185,0,0.1)]">
            <KeyRound className="text-[#76B900]" size={32} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-white mb-2">Secure Access</h1>
        <p className="text-gray-400 text-center text-sm mb-8">
          Enter your credentials to connect.
          <br />
          <span className="text-[10px] text-gray-600 mt-1 block">First login auto-registers the account.</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 outline-none focus:border-[#76B900]/50 transition-colors"
                placeholder="admin"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 outline-none focus:border-[#76B900]/50 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#76B900] hover:bg-[#76B900]/90 text-black font-semibold py-3 rounded-xl mt-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(118,185,0,0.2)] hover:shadow-[0_0_30px_rgba(118,185,0,0.4)]"
          >
            {loading ? "Authenticating..." : "Connect"}
          </button>
        </form>
      </div>
    </div>
  );
}
