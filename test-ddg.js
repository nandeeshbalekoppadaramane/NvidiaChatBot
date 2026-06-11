const { search, SafeSearchType } = require('duck-duck-scrape');

async function run() {
  try {
    const results = await search('test query', { safeSearch: SafeSearchType.STRICT });
    console.log("Success:", results.results.length, "results");
    console.log(results.results[0]);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
