const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";
const workflowId = "88zOQbdJAT7DOaET";

const parseCode = `// Parse Meta Cloud API webhook payload
const body = $input.first().json.body || $input.first().json;

if (body['hub.mode'] === 'subscribe') {
  return [{ json: { challenge: body['hub.challenge'] } }];
}

const entry = body.entry?.[0];
const changes = entry?.changes?.[0];
const value = changes?.value;
const message = value?.messages?.[0];
const contact = value?.contacts?.[0];

if (!message) {
  return [{ json: { skip: true, reason: 'No message in payload' } }];
}

const msgId = message.id;
const phone = message.from;
const contactName = contact?.profile?.name || phone;
const type = message.type || 'text';
let content = message.text?.body || message.caption || '';
let mediaUrl = null;

// If message has media, resolve the URL from Meta API
if (['image', 'audio', 'video', 'document'].includes(type)) {
  const mediaObj = message[type];
  const mediaId = mediaObj?.id;
  
  if (mediaId) {
    try {
      const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
      const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";
      const channelId = "4886443e-4996-4d2a-83e1-d96f503e1a28";
      
      const channelsResp = await $helpers.httpRequest({
        method: 'GET',
        url: \`\${supabaseUrl}/rest/v1/channels?id=eq.\${channelId}&select=access_token\`,
        headers: {
          'apikey': serviceKey,
          'Authorization': \`Bearer \${serviceKey}\`
        }
      });
      
      const accessToken = channelsResp?.[0]?.access_token;
      
      if (accessToken) {
        const mediaResp = await $helpers.httpRequest({
          method: 'GET',
          url: \`https://graph.facebook.com/v20.0/\${mediaId}\`,
          headers: {
            'Authorization': \`Bearer \${accessToken}\`
          }
        });
        
        mediaUrl = mediaResp?.url || null;
      }
    } catch (e) {
      console.error('Error resolving Meta media URL:', e.message);
    }
  }
  
  if (!content) {
    if (type === 'image') content = '[Imagem]';
    else if (type === 'audio') content = '[Áudio]';
    else if (type === 'video') content = '[Vídeo]';
    else if (type === 'document') content = '[Documento]';
    else content = '[Mídia]';
  }
}

return [{
  json: {
    whatsapp_msg_id: msgId,
    phone: phone,
    contact_name: contactName,
    direction: 'in',
    content: content,
    content_type: type,
    media_url: mediaUrl,
    timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    raw_payload: body
  }
}];`;

const upsertCode = `// Check for duplicate message (idempotency)
const msgId = $json.whatsapp_msg_id;

// Upsert contact
const contactResult = await $helpers.httpRequest({
  method: 'POST',
  url: "https://ibyterftfrqgkhktkaeg.supabase.co/rest/v1/contacts?on_conflict=phone",
  headers: {
    'apikey': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8",
    'Authorization': "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8",
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation'
  },
  body: JSON.stringify({
    phone: $json.phone,
    name: $json.contact_name
  })
});

const contactId = contactResult?.[0]?.id;

return [{
  json: {
    ...$json,
    contact_id: contactId
  }
}];`;

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
  console.log("Deactivating current workflow to edit safely...");
  await apiCall("POST", `/workflows/${workflowId}/deactivate`);

  console.log("Updating workflow structure...");
  
  // Define a complete, correct POST-only workflow that uses jsCode parameter for Code nodes (typeVersion 2)
  const workflowData = {
    name: "WhatsApp Meta Official – Inbound Webhook",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "webhook/meta",
          responseMode: "onReceived",
          options: {}
        },
        id: "1d6629ba-7d5d-4e0e-b942-c0d0b82fe845",
        name: "Meta Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [240, 300]
      },
      {
        parameters: {
          jsCode: parseCode
        },
        id: "261d6387-b099-4a21-a289-76b8c758aaa8",
        name: "Parse Meta Payload",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [480, 300]
      },
      {
        parameters: {
          conditions: {
            boolean: [
              {
                value1: "={{ $json.skip }}",
                value2: true
              }
            ]
          }
        },
        id: "d9c2d088-ac0d-42ce-b58e-ab11dc919585",
        name: "Has Message?",
        type: "n8n-nodes-base.if",
        typeVersion: 1,
        position: [700, 300]
      },
      {
        parameters: {
          jsCode: upsertCode
        },
        id: "767892d0-6059-45ba-be6f-30f96025ca32",
        name: "Upsert Contact",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [920, 200]
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
              { "name": "channel_id", "value": "4886443e-4996-4d2a-83e1-d96f503e1a28" },
              { "name": "contact_id", "value": "={{ $json.contact_id }}" },
              { "name": "direction", "value": "in" },
              { "name": "content", "value": "={{ $json.content }}" },
              { "name": "content_type", "value": "={{ $json.content_type }}" },
              { "name": "media_url", "value": "={{ $json.media_url }}" },
              { "name": "whatsapp_msg_id", "value": "={{ $json.whatsapp_msg_id }}" },
              { "name": "timestamp", "value": "={{ $json.timestamp }}" }
            ]
          },
          options: {}
        },
        id: "768d3699-117b-4346-bfb1-5fd614054dbf",
        name: "Insert Message to Supabase",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [1160, 200]
      },
      {
        parameters: {
          method: "POST",
          url: "https://ibyterftfrqgkhktkaeg.supabase.co/rest/v1/webhook_logs",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8" },
              { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8" },
              { "name": "Content-Type", "value": "application/json" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { "name": "channel_id", "value": "4886443e-4996-4d2a-83e1-d96f503e1a28" },
              { "name": "event_type", "value": "message.received" },
              { "name": "source", "value": "meta" },
              { "name": "status", "value": "processed" }
            ]
          },
          options: {}
        },
        id: "e682408c-9bf6-41f9-87a7-5436642d4ec5",
        name: "Log Webhook Event",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [1400, 200]
      },
      {
        parameters: {
          method: "POST",
          url: "https://ibyterftfrqgkhktkaeg.supabase.co/rest/v1/failed_messages",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8" },
              { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8" },
              { "name": "Content-Type", "value": "application/json" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { "name": "channel_id", "value": "4886443e-4996-4d2a-83e1-d96f503e1a28" },
              { "name": "payload", "value": "={{ JSON.stringify($json) }}" },
              { "name": "error_message", "value": "={{ $json.error?.message || 'Unknown error' }}" }
            ]
          },
          options: {}
        },
        id: "c2149d80-0a6f-480e-8b6c-f32e2b8f3fab",
        name: "Dead Letter Queue",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [1160, 440]
      }
    ],
    connections: {
      "Meta Webhook Trigger": {
        "main": [[{ "node": "Parse Meta Payload", "type": "main", "index": 0 }]]
      },
      "Parse Meta Payload": {
        "main": [[{ "node": "Has Message?", "type": "main", "index": 0 }]]
      },
      "Has Message?": {
        "main": [
          [{ "node": "Upsert Contact", "type": "main", "index": 0 }],
          []
        ]
      },
      "Upsert Contact": {
        "main": [[{ "node": "Insert Message to Supabase", "type": "main", "index": 0 }]]
      },
      "Insert Message to Supabase": {
        "main": [[{ "node": "Log Webhook Event", "type": "main", "index": 0 }]]
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

  console.log("Re-activating updated workflow...");
  const activateRes = await apiCall("POST", `/workflows/${workflowId}/activate`);
  console.log("Activation status:", activateRes.statusCode);
  if (activateRes.statusCode === 200) {
    console.log("SUCCESS! Workflow updated and activated directly on n8n server!");
  } else {
    console.error("Activation failed:", activateRes.data);
  }
}

run();
