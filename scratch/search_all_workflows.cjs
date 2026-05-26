const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";
const baseUrl = "https://n8n-n8n.rh3fr2.easypanel.host/api/v1/workflows";

function makeRequest(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
      });
    }).on('error', reject);
  });
}

async function run() {
  const res = await makeRequest(baseUrl, { 'X-N8N-API-KEY': apiKey });
  if (res.statusCode === 200) {
    const list = res.data.data || [];
    console.log(`Found ${list.length} workflows:`);
    list.forEach(w => {
      console.log(`- ID: ${w.id} | Name: ${w.name} | Active: ${w.active}`);
    });
  } else {
    console.log("Error listing workflows:", res.statusCode, res.data);
  }
}

run();
