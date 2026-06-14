const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const settings = await prisma.userSettings.findFirst();
  if (!settings || !settings.apiKey) {
    console.log("No API key found in DB");
    return;
  }
  
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: 'mistralai/codestral-22b-instruct-v0.1',
      messages: [{role: 'user', content: 'Hi'}],
      max_tokens: 100
    })
  });
  
  const data = await res.json();
  console.log("STATUS:", res.status);
  console.log(JSON.stringify(data, null, 2));
}

run();
