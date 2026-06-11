const cheerio = require('cheerio');

async function testScrape() {
  try {
    const res = await fetch("https://html.duckduckgo.com/html/?q=latest+news+on+AI", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const results = [];
    $('.result').each((i, el) => {
      const title = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      const url = $(el).find('.result__url').attr('href') || $(el).find('.result__a').attr('href');
      if (title && snippet) {
        results.push({ title, snippet, url });
      }
    });
    
    console.log("Found:", results.length);
    console.log(results[0]);
  } catch (e) {
    console.error(e);
  }
}
testScrape();
