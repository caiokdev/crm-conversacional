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
  const workflows = {
    "88zOQbdJAT7DOaET": "META INBOUND",
    "m5wmXXTYAqLiRM9c": "EVOLUTION INBOUND", 
    "NFkf4R8DDJ2o7Sqx": "OUTBOUND"
  };

  for (const [id, name] of Object.entries(workflows)) {
    console.log(`\n=== ${name} (${id}) ===`);
    const result = await apiCall(`/executions?workflowId=${id}&limit=5`);
    const execs = result.data || [];
    
    for (const ex of execs) {
      console.log(`Execution ${ex.id}: ${ex.status} (${ex.startedAt})`);
      if (ex.status === 'error') {
        const detail = await apiCall(`/executions/${ex.id}?includeData=true`);
        const rd = detail.data?.resultData || {};
        if (rd.error) {
          console.log(`  ERROR: ${rd.error.message}`);
        }
        for (const [nodeName, nodeExecs] of Object.entries(rd.runData || {})) {
          for (const ne of nodeExecs) {
            if (ne.error) {
              console.log(`  Node "${nodeName}" ERROR: ${ne.error.message}`);
            }
          }
        }
      }
    }
  }
}

run();
