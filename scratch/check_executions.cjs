const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";

// Check last 5 executions for each of our workflows
const workflowIds = ["88zOQbdJAT7DOaET", "m5wmXXTYAqLiRM9c", "NFkf4R8DDJ2o7Sqx"];

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
  for (const wfId of workflowIds) {
    console.log(`\n=== Executions for ${wfId} ===`);
    try {
      const result = await apiCall(`/executions?workflowId=${wfId}&limit=5&status=error`);
      const execs = result.data || [];
      console.log(`Found ${execs.length} error executions:`);
      for (const ex of execs) {
        console.log(`  - ID: ${ex.id} | Status: ${ex.status} | Finished: ${ex.stoppedAt}`);
        if (ex.data?.resultData?.error) {
          console.log(`    ERROR: ${ex.data.resultData.error.message}`);
        }
      }
    } catch (e) {
      console.error(`  Failed to get executions: ${e.message}`);
    }
    
    // Also get recent successful ones
    try {
      const result = await apiCall(`/executions?workflowId=${wfId}&limit=3`);
      const execs = result.data || [];
      console.log(`\n  Recent executions (any status):`);
      for (const ex of execs) {
        console.log(`  - ID: ${ex.id} | Status: ${ex.status} | Started: ${ex.startedAt} | Finished: ${ex.stoppedAt}`);
      }
    } catch (e) {
      console.error(`  Failed: ${e.message}`);
    }
  }
}

run();
