const https = require('https');
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";

function apiCall(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://n8n-n8n.rh3fr2.easypanel.host/api/v1${path}`, { headers: { 'X-N8N-API-KEY': apiKey } }, (res) => {
      let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve(JSON.parse(data || '{}')));
    }).on('error', reject);
  });
}

async function run() {
  const detail = await apiCall(`/executions/33786?includeData=true`);
  const rd = detail.data?.resultData || {};
  console.log("=== Node execution run data ===");
  if (rd.runData) {
    const logNode = rd.runData['Log Outgoing Message1'];
    if (logNode) {
      console.log("Input/Output of Log Outgoing Message1:", JSON.stringify(logNode, null, 2));
    } else {
      console.log("Log Outgoing Message1 was not found in runData");
    }
  } else {
    console.log("No runData found");
  }
}

run();
