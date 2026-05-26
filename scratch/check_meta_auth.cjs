const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";

function apiCall(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://n8n-n8n.rh3fr2.easypanel.host/api/v1${path}`, {
      headers: { 'X-N8N-API-KEY': apiKey }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data || '{}')));
    }).on('error', reject);
  });
}

async function run() {
  console.log("=== Detail of Execution 33779 (Outbound) ===");
  const detail = await apiCall("/executions/33779?includeData=true");
  
  const rd = detail.data?.resultData || {};
  
  if (rd.runData) {
    for (const [nodeName, nodeExecs] of Object.entries(rd.runData)) {
      console.log(`\nNode: ${nodeName}`);
      for (const ne of nodeExecs) {
        if (ne.error) {
          console.log(`  ERROR: ${ne.error.message}`);
        }
        // print output data to see what it sent
        if (ne.data?.main?.[0]) {
          console.log(`  Output: ${JSON.stringify(ne.data.main[0]?.[0]?.json, null, 2)}`);
        }
      }
    }
  }
}

run();
