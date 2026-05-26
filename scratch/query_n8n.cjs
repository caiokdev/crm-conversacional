const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";
const baseUrl = "https://n8n-n8n.rh3fr2.easypanel.host/api/v1/workflows";

function makeRequest(headers) {
  return new Promise((resolve, reject) => {
    https.get(baseUrl, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log("Testing with X-N8N-API-KEY header...");
  try {
    const res1 = await makeRequest({ 'X-N8N-API-KEY': apiKey });
    console.log("Status X-N8N-API-KEY:", res1.statusCode);
    if (res1.statusCode === 200) {
      console.log("Success! Found workflows:", res1.data.data?.length || 0);
      console.log(JSON.stringify(res1.data.data, null, 2));
      return;
    }
  } catch (e) {
    console.error("Failed X-N8N-API-KEY:", e.message);
  }

  console.log("\nTesting with Authorization: Bearer header...");
  try {
    const res2 = await makeRequest({ 'Authorization': `Bearer ${apiKey}` });
    console.log("Status Bearer:", res2.statusCode);
    if (res2.statusCode === 200) {
      console.log("Success! Found workflows:", res2.data.data?.length || 0);
      console.log(JSON.stringify(res2.data.data, null, 2));
      return;
    }
  } catch (e) {
    console.error("Failed Bearer:", e.message);
  }
}

test();
