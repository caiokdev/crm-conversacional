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
  const result = await apiCall("/executions?workflowId=m5wmXXTYAqLiRM9c&limit=3");
  const execs = result.data || [];
  console.log("Recent Evolution Executions:");
  for (const ex of execs) {
    console.log(`\n=== Exec ${ex.id} (${ex.startedAt}) Status: ${ex.status} ===`);
    const detail = await apiCall(`/executions/${ex.id}?includeData=true`);
    const rd = detail.data?.resultData || {};
    if (rd.runData) {
      console.log("Nodes executed:", Object.keys(rd.runData));
      
      const upsertContact = rd.runData['Upsert Contact'];
      if (upsertContact) {
        console.log("Upsert Contact Output:", JSON.stringify(upsertContact[0]?.data?.main?.[0], null, 2));
      }
      
      const insertMessage = rd.runData['Insert Message to Supabase'];
      if (insertMessage) {
        console.log("Insert Message to Supabase Input/Output:", JSON.stringify(insertMessage[0]?.data?.main?.[0], null, 2));
      }
    }
  }
}

run();
