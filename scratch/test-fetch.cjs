const http = require('http');

function testFetch(id) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5174,
      path: '/api/certstore?store=Root&location=CurrentUser',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data) {
            console.log(`[Req ${id}] Success! Fetched ${json.data.length} certificates.`);
          } else {
            console.log(`[Req ${id}] Response error: ${JSON.stringify(json)}`);
          }
        } catch (e) {
          console.log(`[Req ${id}] Failed to parse JSON: ${data.substring(0, 100)}`);
        }
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.error(`[Req ${id}] Problem with request: ${e.message}`);
      resolve();
    });
    
    req.end();
  });
}

async function runTest() {
  console.log("Running sequentially...");
  await testFetch(1);
  await testFetch(2);
  
  console.log("Running concurrently...");
  await Promise.all([
    testFetch('3a'),
    testFetch('3b')
  ]);
}

runTest();
