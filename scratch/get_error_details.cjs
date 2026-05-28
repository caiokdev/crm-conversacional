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
  // Get detailed execution info for the errors
  const errorIds = [34980, 34977];
  
  for (const id of errorIds) {
    console.log(`\n=== Execution ${id} Details ===`);
    const exec = await apiCall(`/executions/${id}?includeData=true`);
    console.log(`Workflow: ${exec.workflowId}`);
    console.log(`Status: ${exec.status}`);
    console.log(`Started: ${exec.startedAt}`);
    
    if (exec.data) {
      const rd = exec.data.resultData || {};
      if (rd.error) {
        console.log(`\nGlobal Error:`, JSON.stringify(rd.error, null, 2));
      }
      
      // Check each node for errors
      const runData = rd.runData || {};
      for (const [nodeName, nodeExecs] of Object.entries(runData)) {
        for (const ne of nodeExecs) {
          if (ne.error) {
            console.log(`\nNode "${nodeName}" ERROR:`);
            console.log(`  Message: ${ne.error.message}`);
            console.log(`  Description: ${ne.error.description || 'N/A'}`);
            console.log(`  Details:`, JSON.stringify(ne.error, null, 2));
          }
          if (ne.data?.main?.[0]) {
            console.log(`\nNode "${nodeName}" data count: ${ne.data.main.length}`);
            console.log(`  Inputs:`, JSON.stringify(ne.data.main[0], null, 2));
          }
        }
      }
    }
  }
}

run();
