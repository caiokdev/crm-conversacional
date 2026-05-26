const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const opt = {
      method,
      hostname: "n8n-n8n.rh3fr2.easypanel.host",
      path: "/api/v1" + path,
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opt, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Check last execution error for outbound
  const result = await apiCall("GET", "/executions?workflowId=NFkf4R8DDJ2o7Sqx&limit=3");
  const execs = result.data?.data || [];
  for (const ex of execs) {
    console.log(`Execution ${ex.id}: status=${ex.status} started=${ex.startedAt}`);
    if (ex.status === 'error') {
      const detail = await apiCall("GET", `/executions/${ex.id}?includeData=true`);
      const rd = detail.data?.data?.resultData || {};
      if (rd.error) {
        console.log(`  ERROR: ${rd.error.message}`);
        if (rd.error.stack) console.log(`  STACK: ${rd.error.stack.substring(0, 300)}`);
      }
      for (const [name, nodeExecs] of Object.entries(rd.runData || {})) {
        for (const ne of nodeExecs) {
          if (ne.error) {
            console.log(`  Node "${name}" ERROR: ${ne.error.message}`);
          }
        }
      }
    }
  }
}

run();
