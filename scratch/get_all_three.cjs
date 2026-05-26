const https = require('https');
const fs = require('fs');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";

const workflows = {
  meta: "88zOQbdJAT7DOaET",
  evolution: "m5wmXXTYAqLiRM9c",
  outbound: "NFkf4R8DDJ2o7Sqx"
};

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
  for (const [name, id] of Object.entries(workflows)) {
    console.log(`\n=== ${name.toUpperCase()} (${id}) ===`);
    const w = await getWorkflow(id);
    console.log(`Active: ${w.active}`);
    console.log(`Nodes (${w.nodes?.length}):`);
    for (const n of (w.nodes || [])) {
      console.log(`  - ${n.name} (${n.type} v${n.typeVersion})`);
      if (n.type === 'n8n-nodes-base.webhook') {
        console.log(`    httpMethod: ${n.parameters?.httpMethod}`);
        console.log(`    path: ${n.parameters?.path}`);
        console.log(`    responseMode: ${n.parameters?.responseMode}`);
      }
      if (n.type === 'n8n-nodes-base.code') {
        const code = n.parameters?.jsCode || n.parameters?.functionCode || '';
        console.log(`    code length: ${code.length} chars`);
        if (code.length === 0) {
          console.log(`    *** WARNING: EMPTY CODE BLOCK ***`);
        }
      }
      if (n.type === 'n8n-nodes-base.httpRequest') {
        console.log(`    url: ${n.parameters?.url}`);
        const headers = n.parameters?.headerParameters?.parameters || [];
        for (const h of headers) {
          if (h.value?.includes('$env')) {
            console.log(`    *** WARNING: $env REFERENCE in header "${h.name}": ${h.value} ***`);
          }
        }
      }
    }
    console.log(`Connections:`, JSON.stringify(Object.keys(w.connections || {})));
    
    // Save full JSON
    fs.writeFileSync(`scratch/${name}_current.json`, JSON.stringify(w, null, 2));
  }
}

run();
