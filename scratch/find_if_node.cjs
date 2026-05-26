const https = require('https');
const fs = require('fs');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";

function getWorkflow(id) {
  return new Promise((resolve, reject) => {
    https.get(`https://n8n-n8n.rh3fr2.easypanel.host/api/v1/workflows/${id}`, {
      headers: { 'X-N8N-API-KEY': apiKey }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data || '{}')));
    }).on('error', reject);
  });
}

async function run() {
  // Find an IF node that WORKS in a currently active workflow
  // Let's look at the outbound that WAS working (before we patched it)
  // The old backup had typeVersion 1 but it ran fine...
  
  // Look at other workflows with active IF nodes
  const workflowIds = ["ArMvnRn58xoqoxZk", "Dp6gMSfRQVgJsH0y", "bp6JMrz77eFCoc4z"];
  
  for (const wfId of workflowIds) {
    const w = await getWorkflow(wfId);
    if (w.nodes) {
      for (const n of w.nodes) {
        if (n.type === 'n8n-nodes-base.if') {
          console.log(`\nFound IF node in "${w.name}" (${wfId}):`);
          console.log(`  Name: ${n.name}`);
          console.log(`  TypeVersion: ${n.typeVersion}`);
          console.log(`  Parameters: ${JSON.stringify(n.parameters, null, 2)}`);
        }
      }
    }
  }
}

run();
