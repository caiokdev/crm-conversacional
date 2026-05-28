const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";
const workflowId = "NFkf4R8DDJ2o7Sqx";

const resolveCode = `// Fetch channel details from Supabase to determine provider
const channelId = $json.body?.channel_id || $json.channel_id;
const content = $json.body?.content || $json.content;
const phone = $json.body?.phone || $json.phone;
const contactId = $json.body?.contact_id || $json.contact_id;

const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";

const channelResp = await this.helpers.httpRequest({
  method: 'GET',
  url: \`\${supabaseUrl}/rest/v1/channels?id=eq.\${channelId}&select=*\`,
  headers: {
    'apikey': serviceKey,
    'Authorization': \`Bearer \${serviceKey}\`
  }
});

const channel = channelResp?.[0];
if (!channel) {
  throw new Error(\`Channel \${channelId} not found\`);
}

return [{
  json: {
    channel_id: channelId,
    contact_id: contactId,
    provider: channel.provider,
    content: content,
    phone: phone,
    // Meta fields
    phone_id: channel.phone_id,
    access_token: channel.access_token,
    // Evolution fields
    evo_url: channel.url,
    evo_instance: channel.instance,
    evo_api_key: channel.api_key
  }
}];`;

const responseCode = `return [{ json: { success: true, message: 'Mensagem enviada com sucesso' } }];`;

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
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log("Deactivating outbound workflow...");
  await apiCall("POST", `/workflows/${workflowId}/deactivate`);

  console.log("Updating outbound workflow structure...");
  
  const workflowData = {
    name: "WhatsApp – Outbound Send Message",
    nodes: [
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
      {
        parameters: {
          jsCode: resolveCode
        },
        id: "36a82d05-75ba-4e5a-bff4-201382e2fd6e",
        name: "Resolve Channel",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [1200, 928]
      },
      {
        parameters: {
          conditions: {
            string: [
              {
                value1: "={{ $json.provider }}",
                operation: "equal",
                value2: "meta"
              }
            ]
          }
        },
        id: "7ee5a4e9-db7b-4331-82dd-bf8b938158db",
        name: "Which Provider?1",
        type: "n8n-nodes-base.if",
        typeVersion: 1,
        position: [1440, 928]
      },
      {
        parameters: {
          method: "POST",
          url: "=https://graph.facebook.com/v20.0/{{ $json.phone_id }}/messages",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { "name": "Authorization", "value": "=Bearer {{ $json.access_token }}" },
              { "name": "Content-Type", "value": "application/json" }
            ]
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: "={\n  \"messaging_product\": \"whatsapp\",\n  \"to\": \"{{ $json.phone }}\",\n  \"type\": \"text\",\n  \"text\": {\n    \"body\": \"{{ $json.content }}\"\n  }\n}",
          options: {
            timeout: 15000
          }
        },
        id: "3a5db98f-770f-4fbc-b4a2-dea74a35a623",
        name: "Send via Meta API1",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [1696, 800]
      },
      {
        parameters: {
          method: "POST",
          url: "={{ $json.evo_url }}/message/sendText/{{ $json.evo_instance }}",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { "name": "apikey", "value": "={{ $json.evo_api_key }}" },
              { "name": "Content-Type", "value": "application/json" }
            ]
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: "={\n  \"number\": \"{{ $json.phone }}@s.whatsapp.net\",\n  \"text\": \"{{ $json.content }}\"\n}",
          options: {
            timeout: 15000
          }
        },
        id: "3100315a-c6ec-45f0-8294-e4cc73047a34",
        name: "Send via Evolution API1",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [1696, 1040]
      },
      {
        parameters: {
          method: "POST",
          url: "https://ibyterftfrqgkhktkaeg.supabase.co/rest/v1/messages",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8" },
              { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8" },
              { "name": "Content-Type", "value": "application/json" },
              { "name": "Prefer", "value": "return=representation" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { "name": "channel_id", "value": "={{ $('Resolve Channel').first().json.channel_id }}" },
              { "name": "contact_id", "value": "={{ $('Resolve Channel').first().json.contact_id }}" },
              { "name": "direction", "value": "out" },
              { "name": "content", "value": "={{ $('Resolve Channel').first().json.content }}" },
              { "name": "content_type", "value": "text" },
              { "name": "timestamp", "value": "={{ new Date().toISOString() }}" }
            ]
          },
          options: {}
        },
        id: "8f054d66-7182-4dfb-bcb9-5c2b9617b361",
        name: "Log Outgoing Message1",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [1968, 928]
      },
      {
        parameters: {
          jsCode: responseCode
        },
        id: "cf9b8f69-3960-4a69-a4de-214830b2d082",
        name: "Response OK1",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [2208, 928]
      }
    ],
    connections: {
      "Send Message Trigger": {
        "main": [[{ "node": "Resolve Channel", "type": "main", "index": 0 }]]
      },
      "Resolve Channel": {
        "main": [[{ "node": "Which Provider?1", "type": "main", "index": 0 }]]
      },
      "Which Provider?1": {
        "main": [
          [{ "node": "Send via Meta API1", "type": "main", "index": 0 }],
          [{ "node": "Send via Evolution API1", "type": "main", "index": 0 }]
        ]
      },
      "Send via Meta API1": {
        "main": [[{ "node": "Log Outgoing Message1", "type": "main", "index": 0 }]]
      },
      "Send via Evolution API1": {
        "main": [[{ "node": "Log Outgoing Message1", "type": "main", "index": 0 }]]
      },
      "Log Outgoing Message1": {
        "main": [[{ "node": "Response OK1", "type": "main", "index": 0 }]]
      }
    },
    settings: {}
  };

  const updateRes = await apiCall("PUT", `/workflows/${workflowId}`, workflowData);
  console.log("Update status:", updateRes.statusCode);
  if (updateRes.statusCode !== 200) {
    console.error("Update failed:", updateRes.data);
    return;
  }

  console.log("Re-activating outbound workflow...");
  const activateRes = await apiCall("POST", `/workflows/${workflowId}/activate`);
  console.log("Activation status:", activateRes.statusCode);
  if (activateRes.statusCode === 200) {
    console.log("SUCCESS! Outbound workflow updated and activated directly on n8n server!");
  } else {
    console.error("Activation failed:", activateRes.data);
  }
}

run();
