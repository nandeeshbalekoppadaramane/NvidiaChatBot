const google = require('googlethis');

async function run() {
  try {
    const options = {
      page: 0, 
      safe: false,
      additional_params: {
        hl: 'en'
      }
    };
    
    const response = await google.search('test query', options);
    console.log("Success:", response.results.length, "results");
    console.log(response.results[0]);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
