const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const settings = await prisma.userSettings.findFirst();
  if (!settings || !settings.apiKey) {
    console.log("No API key found in DB");
    return;
  }
  const apiKey = settings.apiKey;
  
  const modelsToTest = [
    'deepseek-ai/deepseek-coder-6.7b-instruct',
    'ibm/granite-34b-code-instruct',
    'google/codegemma-7b',
    'meta/llama-3.3-70b-instruct',
    'mistralai/mistral-large-2-instruct'
  ];
  
  for (const model of modelsToTest) {
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{role: 'user', content: 'Hi'}],
          max_tokens: 10
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ ${model} works!`);
      } else {
        console.log(`❌ ${model} failed: ${res.status}`, data);
      }
    } catch (e) {
      console.log(`❌ ${model} error:`, e.message);
    }
  }
}

run();
