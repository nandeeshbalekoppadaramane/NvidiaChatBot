import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.userSettings.findFirst();
  if (!settings?.apiKey) return NextResponse.json({ error: "No key" });
  
  const models = [
    'moonshotai/kimi-k2.6',
    'z-ai/glm-5.1',
    'minimaxai/minimax-m2.7',
    'qwen/qwen3.5-397b-a17b',
    'meta/llama-3.3-70b-instruct',
    'meta/llama-3.2-90b-vision-instruct',
    'meta/llama-3.2-11b-vision-instruct'
  ];
  
  const results: any[] = [];
  
  for (const model of models) {
    const start = Date.now();
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{role: 'user', content: 'Say OK'}],
          max_tokens: 10
        })
      });
      
      const duration = Date.now() - start;
      
      if (res.ok) {
        results.push({ model, status: 'OK', durationMs: duration });
      } else {
        const errorText = await res.text();
        results.push({ model, status: 'FAILED', code: res.status, error: errorText.slice(0, 100) });
      }
    } catch(e: any) {
      results.push({ model, status: 'NETWORK_ERROR', error: e.message });
    }
  }
  
  return NextResponse.json(results);
}
