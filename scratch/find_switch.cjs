const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";
const baseUrl = "https://n8n-n8n.rh3fr2.easypanel.host/api/v1/workflows";

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'X-N8N-API-KEY': apiKey } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
      });
    }).on('error', reject);
  });
}

async function run() {
  const res = await makeRequest(baseUrl);
  if (res.statusCode !== 200) {
    console.log("Failed to fetch list of workflows");
    return;
  }
  const list = res.data.data || [];
  console.log(`Searching in ${list.length} workflows for switch nodes...`);
  
  for (const w of list) {
    // Only search the first 30 workflows to avoid rate limit or timeout
    try {
      const wDetails = await makeRequest(`${baseUrl}/${w.id}`);
      if (wDetails.statusCode === 200 && wDetails.data.nodes) {
        const switchNode = wDetails.data.nodes.find(n => n.type === 'n8n-nodes-base.switch');
        if (switchNode) {
          console.log(`FOUND Switch node in workflow "${w.name}" (ID: ${w.id}):`);
          console.log(JSON.stringify(switchNode, null, 2));
          return;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  console.log("No switch nodes found in the first 30 workflows.");
}

run();
