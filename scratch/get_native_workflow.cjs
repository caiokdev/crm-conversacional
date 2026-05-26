const https = require('https');
const fs = require('fs');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";
const workflowId = "88zOQbdJAT7DOaET";
const url = `https://n8n-n8n.rh3fr2.easypanel.host/api/v1/workflows/${workflowId}`;

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
  const res = await makeRequest(url, { 'X-N8N-API-KEY': apiKey });
  if (res.statusCode === 200) {
    fs.writeFileSync('scratch/meta_workflow_backup.json', JSON.stringify(res.data, null, 2));
    console.log("Success! Saved current workflow to scratch/meta_workflow_backup.json");
    console.log("Active state:", res.data.active);
  } else {
    console.log("Error getting workflow:", res.statusCode, res.data);
  }
}

run();
