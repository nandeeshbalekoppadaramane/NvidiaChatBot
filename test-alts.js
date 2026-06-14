const { Client } = require('pg');

async function run() {
  const connectionString = require('fs')
    .readFileSync('.env', 'utf8')
    .match(/POSTGRES_URL=(.*)/)[1];
    
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query('SELECT "apiKey" FROM "UserSettings" LIMIT 1');
  const apiKey = res.rows[0].apiKey;
  await client.end();
  
  const models = [
    'databricks/dbrx-instruct',
    'microsoft/phi-4-mini-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct'
  ];
  
  const promises = models.map(async (model) => {
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model, messages: [{role: 'user', content: 'Say OK'}], max_tokens: 10 })
      });
      if (response.ok) return { model, status: 'OK' };
      return { model, status: 'FAILED', code: response.status };
    } catch (e) {
      return { model, status: 'ERROR' };
    }
  });
  
  console.table(await Promise.all(promises));
}

run();
