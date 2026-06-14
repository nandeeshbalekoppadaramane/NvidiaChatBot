import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.userSettings.findFirst();
  if (!settings?.apiKey) return NextResponse.json({ error: "No key" });
  
  const modelsToTest = [
    'meta/codellama-70b',
    'mistralai/codestral-22b-instruct-v0.1',
    'deepseek-ai/deepseek-coder-6.7b-instruct',
    'ibm/granite-34b-code-instruct',
    'google/codegemma-7b'
  ];
  
  const results: any[] = [];
  
  for (const model of modelsToTest) {
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{role: 'user', content: 'Hi'}],
          max_tokens: 10
        })
      });
      results.push({ model, status: res.status });
    } catch(e: any) {
      results.push({ model, error: e.message });
    }
  }
  
  return NextResponse.json(results);
}
