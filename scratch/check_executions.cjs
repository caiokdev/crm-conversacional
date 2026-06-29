const fs = require('fs');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjNkZGI1ZTAtOWU1ZS00ZWVmLTk3MGYtMTg1NTM1MDE4YmYyIiwiaWF0IjoxNzgwOTU1OTI0fQ.2BsiFzbIzF_LMSEqi5TOY50YY9U4ugBDOQaocKZ89xg";
const baseUrl = "https://n8n-n8n.rh3fr2.easypanel.host/api/v1";

async function main() {
  const listRes = await fetch(`${baseUrl}/executions?workflowId=qzJptf3XgjdxpZG5&limit=5`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  const listData = await listRes.json();
  
  for (const exec of listData.data || []) {
    console.log(`\n=== Execution ${exec.id} (${exec.status}) ===`);
    console.log(`Started: ${exec.startedAt}, Stopped: ${exec.stoppedAt}`);
    
    const detRes = await fetch(`${baseUrl}/executions/${exec.id}?includeData=true`, {
      headers: { 'X-N8N-API-KEY': apiKey }
    });
    const detData = await detRes.json();
    const runData = detData.data?.resultData?.runData;
    
    if (runData) {
      const nodeNames = Object.keys(runData);
      console.log(`Nodes executed: ${nodeNames.join(' -> ')}`);
      
      const webhookData = runData['AI Webhook Trigger'];
      if (webhookData && webhookData[0]) {
        const body = webhookData[0].data?.main?.[0]?.[0]?.json?.body;
        console.log(`Webhook body: ${JSON.stringify(body)}`);
      }
      
      const isLatest = runData['If Is Latest'];
      if (isLatest && isLatest[0]) {
        const outputs = isLatest[0].data?.main;
        const trueOutput = outputs?.[0]?.length || 0;
        const falseOutput = outputs?.[1]?.length || 0;
        console.log(`If Is Latest output: TrueBranchCount=${trueOutput}, FalseBranchCount=${falseOutput}`);
      }
    }
  }
}

main().catch(console.error);
