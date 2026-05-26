const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";

const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const opt = {
      method,
      hostname: "n8n-n8n.rh3fr2.easypanel.host",
      path: "/api/v1" + path,
      headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' }
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

// Simple Code node that extracts fields from the webhook body and the fetched channel data
// No HTTP calls — just plain parsing
const resolveChannelCode = `// Extract payload and channel info — no HTTP calls
const body = $('Send Message Trigger').item.json.body || $('Send Message Trigger').item.json;
const channelData = $('Fetch Channel').item.json;

// channelData is the first result from Supabase array or the object itself
const channel = Array.isArray(channelData) ? channelData[0] : channelData;

return [{
  json: {
    channel_id: body.channel_id,
    contact_id: body.contact_id,
    provider: channel?.provider || 'unknown',
    content: body.content,
    phone: body.phone,
    phone_id: channel?.phone_id,
    access_token: channel?.access_token,
    evo_url: channel?.url,
    evo_instance: channel?.instance,
    evo_api_key: channel?.api_key
  }
}];`;

const responseOkCode = `return [{ json: { success: true, message: 'Mensagem enviada com sucesso' } }];`;

async function patchOutbound() {
  const workflowId = "NFkf4R8DDJ2o7Sqx";
  
  console.log("=== Patching OUTBOUND Send Message ===");
  console.log("Deactivating...");
  await apiCall("POST", `/workflows/${workflowId}/deactivate`);

  // Change path from "webhook/send" to "send" so final URL is /webhook/send
  const workflowData = {
    name: "WhatsApp – Outbound Send Message",
    nodes: [
      // Webhook Trigger — path = "send" results in URL /webhook/send
      {
        parameters: {
          httpMethod: "POST",
          path: "send",
          responseMode: "lastNode",
          options: {}
        },
        id: "f5cc9383-b694-4e74-9248-ba5d41f0231d",
        name: "Send Message Trigger",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [960, 928]
      },
      // Fetch Channel via HTTP Request (replaces Code node that used $helpers)
      {
        parameters: {
          method: "GET",
          url: `=${supabaseUrl}/rest/v1/channels?id=eq.{{ $json.body?.channel_id || $json.channel_id }}&select=*`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: serviceKey },
              { name: "Authorization", value: `Bearer ${serviceKey}` }
            ]
          },
          options: {}
        },
        id: "a1234567-fetch-chan-nel1-000000000001",
        name: "Fetch Channel",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [1200, 928]
      },
      // Parse channel result (simple code — no HTTP calls)
      {
        parameters: {
          jsCode: resolveChannelCode
        },
        id: "36a82d05-75ba-4e5a-bff4-201382e2fd6e",
        name: "Resolve Channel",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [1440, 928]
      },
      // Which Provider? (IF node — proven working format)
      {
        parameters: {
          conditions: {
            string: [
              {
                value1: "={{ $json.provider }}",
                operation: "equals",
                value2: "meta"
              }
            ]
          }
        },
        id: "7ee5a4e9-db7b-4331-82dd-bf8b938158db",
        name: "Which Provider?1",
        type: "n8n-nodes-base.if",
        typeVersion: 1,
        position: [1680, 928]
      },
      // Send via Meta API
      {
        parameters: {
          method: "POST",
          url: "=https://graph.facebook.com/v20.0/{{ $json.phone_id }}/messages",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: "Bearer {{ $json.access_token }}" },
              { name: "Content-Type", value: "application/json" }
            ]
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: `={\n  "messaging_product": "whatsapp",\n  "to": "{{ $json.phone }}",\n  "type": "text",\n  "text": {\n    "body": "{{ $json.content }}"\n  }\n}`,
          options: { timeout: 15000 }
        },
        id: "3a5db98f-770f-4fbc-b4a2-dea74a35a623",
        name: "Send via Meta API1",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [1920, 800]
      },
      // Send via Evolution API
      {
        parameters: {
          method: "POST",
          url: "={{ $json.evo_url }}/message/sendText/{{ $json.evo_instance }}",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: "={{ $json.evo_api_key }}" },
              { name: "Content-Type", value: "application/json" }
            ]
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: `={\n  "number": "{{ $json.phone }}@s.whatsapp.net",\n  "text": "{{ $json.content }}"\n}`,
          options: { timeout: 15000 }
        },
        id: "3100315a-c6ec-45f0-8294-e4cc73047a34",
        name: "Send via Evolution API1",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [1920, 1040]
      },
      // Log Outgoing Message to Supabase
      {
        parameters: {
          method: "POST",
          url: `${supabaseUrl}/rest/v1/messages`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: serviceKey },
              { name: "Authorization", value: `Bearer ${serviceKey}` },
              { name: "Content-Type", value: "application/json" },
              { name: "Prefer", value: "return=representation" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "channel_id", value: "={{ $json.channel_id || $input.first().json.channel_id }}" },
              { name: "contact_id", value: "={{ $json.contact_id || $input.first().json.contact_id }}" },
              { name: "direction", value: "out" },
              { name: "content", value: "={{ $json.content || $input.first().json.content }}" },
              { name: "content_type", value: "text" },
              { name: "status", value: "sent" },
              { name: "timestamp", value: "={{ new Date().toISOString() }}" }
            ]
          },
          options: {}
        },
        id: "8f054d66-7182-4dfb-bcb9-5c2b9617b361",
        name: "Log Outgoing Message1",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [2160, 928]
      },
      // Response OK
      {
        parameters: {
          jsCode: responseOkCode
        },
        id: "cf9b8f69-3960-4a69-a4de-214830b2d082",
        name: "Response OK1",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [2400, 928]
      }
    ],
    connections: {
      "Send Message Trigger": {
        main: [[{ node: "Fetch Channel", type: "main", index: 0 }]]
      },
      "Fetch Channel": {
        main: [[{ node: "Resolve Channel", type: "main", index: 0 }]]
      },
      "Resolve Channel": {
        main: [[{ node: "Which Provider?1", type: "main", index: 0 }]]
      },
      "Which Provider?1": {
        main: [
          [{ node: "Send via Meta API1", type: "main", index: 0 }],
          [{ node: "Send via Evolution API1", type: "main", index: 0 }]
        ]
      },
      "Send via Meta API1": {
        main: [[{ node: "Log Outgoing Message1", type: "main", index: 0 }]]
      },
      "Send via Evolution API1": {
        main: [[{ node: "Log Outgoing Message1", type: "main", index: 0 }]]
      },
      "Log Outgoing Message1": {
        main: [[{ node: "Response OK1", type: "main", index: 0 }]]
      }
    },
    settings: {}
  };

  const updateRes = await apiCall("PUT", `/workflows/${workflowId}`, workflowData);
  console.log("Update status:", updateRes.statusCode);
  if (updateRes.statusCode !== 200) {
    console.error("Update failed:", JSON.stringify(updateRes.data));
    return false;
  }

  console.log("Activating...");
  const activateRes = await apiCall("POST", `/workflows/${workflowId}/activate`);
  console.log("Activation status:", activateRes.statusCode);
  if (activateRes.statusCode !== 200) {
    console.error("Activation failed:", JSON.stringify(activateRes.data));
    return false;
  }
  console.log("OUTBOUND workflow ACTIVATED SUCCESSFULLY!");
  return true;
}

// Test the outbound
function sendPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyStr = JSON.stringify(body);
    const options = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function testOutbound() {
  console.log("\n=== TESTING OUTBOUND ===");
  await new Promise(r => setTimeout(r, 2000));
  
  // Now path="send", URL is /webhook/send — exactly what frontend sends
  console.log("Testing /webhook/send...");
  const res = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/send", {
    channel_id: "4886443e-4996-4d2a-83e1-d96f503e1a28",
    phone: "5511999999999",
    content: "Teste outbound validacao " + new Date().toLocaleTimeString()
  });
  console.log(`  Status: ${res.statusCode}`);
  console.log(`  Body: ${res.body}`);
  
  // Wait and check execution
  await new Promise(r => setTimeout(r, 3000));
  const result = await apiCall("GET", "/executions?workflowId=NFkf4R8DDJ2o7Sqx&limit=1");
  const execs = result.data?.data || [];
  if (execs.length > 0) {
    const ex = execs[0];
    console.log(`\nLatest execution: ID=${ex.id} Status=${ex.status}`);
    if (ex.status === 'error') {
      const detail = await apiCall("GET", `/executions/${ex.id}?includeData=true`);
      const rd = detail.data?.data?.resultData || {};
      if (rd.error) console.log(`  ERROR: ${rd.error.message}`);
      for (const [name, nodeExecs] of Object.entries(rd.runData || {})) {
        for (const ne of nodeExecs) {
          if (ne.error) console.log(`  Node "${name}" ERROR: ${ne.error.message}`);
        }
      }
    }
  }
}

async function run() {
  const ok = await patchOutbound();
  if (ok) {
    await testOutbound();
  }
}

run();
