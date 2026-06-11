const fs = require('fs');

async function fetchModels() {
  // Replace this with your actual NVIDIA API key
  const API_KEY = "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";

  if (API_KEY === "YOUR_NVIDIA_API_KEY") {
    console.error("❌ Please replace 'YOUR_NVIDIA_API_KEY' inside this file with your actual API key before running.");
    process.exit(1);
  }

  try {
    console.log("Fetching models from NVIDIA NIM API...");
    const response = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract just the model IDs
    const modelIds = data.data.map(m => m.id).sort();

    console.log(`\n✅ Successfully fetched ${modelIds.length} models!\n`);

    // Save to a text file for easy reading
    const fileContent = modelIds.join('\n');
    fs.writeFileSync('nvidia-models-list.txt', fileContent);

    console.log("Here are the first 20 models as a preview:");
    console.log(modelIds.slice(0, 20).join('\n'));
    console.log("\n...and many more.");

    console.log("\n📁 The complete list has been saved to 'nvidia-models-list.txt' in this directory.");
    console.log("Please open 'nvidia-models-list.txt', go through the names, and tell me exactly which ones you want to include!");

  } catch (err) {
    console.error("❌ Error fetching models:", err.message);
  }
}

fetchModels();
