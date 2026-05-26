const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";

const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";
const metaChannelId = "4886443e-4996-4d2a-83e1-d96f503e1a28";
const evoChannelId = "50df1e49-8f4c-4f90-b3c5-e9b95e37d8ed";

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

// ==================== META INBOUND WORKFLOW ====================
// KEY FIX: Replace Code v2 nodes that use $helpers with HTTP Request nodes
// Only keep Code v2 for simple parsing (no HTTP calls inside code)

const metaParseCode = `// Parse Meta Cloud API webhook payload — NO HTTP calls here
const body = $input.first().json.body || $input.first().json;

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

// Extract media ID if present (resolve URL later in HTTP Request nodes)
let mediaId = null;
if (['image', 'audio', 'video', 'document'].includes(type)) {
  const mediaObj = message[type];
  mediaId = mediaObj?.id || null;
  
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
    media_id: mediaId,
    timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString()
  }
}];`;

async function patchMeta() {
  const workflowId = "88zOQbdJAT7DOaET";
  
  console.log("=== Patching META Inbound Webhook ===");
  console.log("Deactivating...");
  await apiCall("POST", `/workflows/${workflowId}/deactivate`);

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
          jsCode: metaParseCode
        },
        id: "261d6387-b099-4a21-a289-76b8c758aaa8",
        name: "Parse Meta Payload",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [480, 300]
      },
      // IF node: has message? (boolean check — same format that works)
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
      // Upsert Contact via HTTP Request (NOT code node)
      {
        parameters: {
          method: "POST",
          url: `${supabaseUrl}/rest/v1/contacts?on_conflict=phone`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: serviceKey },
              { name: "Authorization", value: `Bearer ${serviceKey}` },
              { name: "Content-Type", value: "application/json" },
              { name: "Prefer", value: "resolution=merge-duplicates,return=representation" }
            ]
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: `={\n  "phone": "{{ $json.phone }}",\n  "name": "{{ $json.contact_name }}"\n}`,
          options: {}
        },
        id: "767892d0-6059-45ba-be6f-30f96025ca32",
        name: "Upsert Contact",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [920, 200]
      },
      // Insert Message via HTTP Request
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
              { name: "channel_id", value: metaChannelId },
              { name: "contact_id", value: "={{ $json[0].id }}" },
              { name: "direction", value: "in" },
              { name: "content", value: `={{ $('Parse Meta Payload').item.json.content }}` },
              { name: "content_type", value: `={{ $('Parse Meta Payload').item.json.content_type }}` },
              { name: "media_url", value: `={{ $('Parse Meta Payload').item.json.media_url }}` },
              { name: "whatsapp_msg_id", value: `={{ $('Parse Meta Payload').item.json.whatsapp_msg_id }}` },
              { name: "timestamp", value: `={{ $('Parse Meta Payload').item.json.timestamp }}` }
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
      // Log Webhook Event
      {
        parameters: {
          method: "POST",
          url: `${supabaseUrl}/rest/v1/webhook_logs`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: serviceKey },
              { name: "Authorization", value: `Bearer ${serviceKey}` },
              { name: "Content-Type", value: "application/json" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "channel_id", value: metaChannelId },
              { name: "event_type", value: "message.received" },
              { name: "source", value: "meta" },
              { name: "status", value: "processed" }
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
      // Dead Letter Queue
      {
        parameters: {
          method: "POST",
          url: `${supabaseUrl}/rest/v1/failed_messages`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: serviceKey },
              { name: "Authorization", value: `Bearer ${serviceKey}` },
              { name: "Content-Type", value: "application/json" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "channel_id", value: metaChannelId },
              { name: "payload", value: "={{ JSON.stringify($json) }}" },
              { name: "error_message", value: "={{ $json.error?.message || 'Unknown error' }}" }
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
        main: [[{ node: "Parse Meta Payload", type: "main", index: 0 }]]
      },
      "Parse Meta Payload": {
        main: [[{ node: "Has Message?", type: "main", index: 0 }]]
      },
      "Has Message?": {
        main: [
          // true (skip=true) -> skip, false (skip=undefined) -> process
          [],
          [{ node: "Upsert Contact", type: "main", index: 0 }]
        ]
      },
      "Upsert Contact": {
        main: [[{ node: "Insert Message to Supabase", type: "main", index: 0 }]]
      },
      "Insert Message to Supabase": {
        main: [[{ node: "Log Webhook Event", type: "main", index: 0 }]]
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
  console.log("META workflow ACTIVATED SUCCESSFULLY!");
  return true;
}

// ==================== EVOLUTION INBOUND WORKFLOW ====================
const evoParseCode = `// Parse Evolution API webhook payload — NO HTTP calls
const body = $input.first().json.body || $input.first().json;
const event = body.event;

if (event === 'messages.upsert') {
  const msg = body.data;
  const key = msg.key;
  const isFromMe = key.fromMe;
  
  const phone = key.remoteJid?.split('@')[0]?.split(':')[0] || '';
  const pushName = msg.pushName || phone;
  
  let content = '';
  let contentType = 'text';
  let mediaUrl = null;
  
  if (msg.message?.conversation) {
    content = msg.message.conversation;
  } else if (msg.message?.extendedTextMessage?.text) {
    content = msg.message.extendedTextMessage.text;
  } else if (msg.message?.imageMessage) {
    content = msg.message.imageMessage.caption || '[Imagem]';
    contentType = 'image';
    mediaUrl = msg.message.imageMessage.url;
  } else if (msg.message?.audioMessage) {
    content = '[Áudio]';
    contentType = 'audio';
    mediaUrl = msg.message.audioMessage.url;
  } else if (msg.message?.videoMessage) {
    content = msg.message.videoMessage.caption || '[Vídeo]';
    contentType = 'video';
    mediaUrl = msg.message.videoMessage.url;
  } else if (msg.message?.documentMessage) {
    content = msg.message.documentMessage.fileName || '[Documento]';
    contentType = 'document';
    mediaUrl = msg.message.documentMessage.url;
  } else if (msg.message?.stickerMessage) {
    content = '[Sticker]';
    contentType = 'sticker';
  } else {
    content = '[Mensagem não suportada]';
  }

  return [{
    json: {
      event_type: 'message.received',
      whatsapp_msg_id: key.id,
      phone: phone,
      contact_name: pushName,
      direction: isFromMe ? 'out' : 'in',
      content: content,
      content_type: contentType,
      media_url: mediaUrl,
      timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
      instance: body.instance
    }
  }];
} else {
  return [{ json: { skip: true, reason: 'Not a message event: ' + event } }];
}`;

async function patchEvolution() {
  const workflowId = "m5wmXXTYAqLiRM9c";
  
  console.log("\n=== Patching EVOLUTION Inbound Webhook ===");
  console.log("Deactivating...");
  await apiCall("POST", `/workflows/${workflowId}/deactivate`);

  const workflowData = {
    name: "WhatsApp Evolution API – Inbound Webhook",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "webhook/evolution",
          options: {}
        },
        id: "f79aec30-2f4a-4a5f-be76-a73d28679181",
        name: "Evolution Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [-512, 1168]
      },
      {
        parameters: {
          jsCode: evoParseCode
        },
        id: "588f5a8e-3d98-4ff8-b3d1-562a62415367",
        name: "Parse Evolution Payload",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [-272, 1168]
      },
      // IF: Is it a message? (boolean check on 'skip' like meta that works)
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
        id: "91b9cbe2-6116-42e3-a45e-82eee5ae48f5",
        name: "Is Message?",
        type: "n8n-nodes-base.if",
        typeVersion: 1,
        position: [-32, 1168]
      },
      // Upsert Contact via HTTP Request (NOT code — avoids $helpers crash)
      {
        parameters: {
          method: "POST",
          url: `${supabaseUrl}/rest/v1/contacts?on_conflict=phone`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: serviceKey },
              { name: "Authorization", value: `Bearer ${serviceKey}` },
              { name: "Content-Type", value: "application/json" },
              { name: "Prefer", value: "resolution=merge-duplicates,return=representation" }
            ]
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: `={\n  "phone": "{{ $json.phone }}",\n  "name": "{{ $json.contact_name }}"\n}`,
          options: {}
        },
        id: "b4cf8e34-093a-419f-a13a-0a01ebb1c654",
        name: "Upsert Contact",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [208, 1024]
      },
      // Insert Message via HTTP Request
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
          specifyBody: "json",
          jsonBody: `={\n  "channel_id": "${evoChannelId}",\n  "contact_id": "{{ $json[0].id }}",\n  "direction": "{{ $('Parse Evolution Payload').item.json.direction }}",\n  "content": {{ JSON.stringify($('Parse Evolution Payload').item.json.content) }},\n  "content_type": "{{ $('Parse Evolution Payload').item.json.content_type }}",\n  "media_url": {{ $('Parse Evolution Payload').item.json.media_url ? JSON.stringify($('Parse Evolution Payload').item.json.media_url) : 'null' }},\n  "whatsapp_msg_id": "{{ $('Parse Evolution Payload').item.json.whatsapp_msg_id }}",\n  "timestamp": "{{ $('Parse Evolution Payload').item.json.timestamp }}"\n}`,
          options: {}
        },
        id: "617b8bc9-e5b8-4846-8b9a-447c34e11687",
        name: "Insert Message to Supabase",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [448, 1024]
      },
      // Log Webhook Event
      {
        parameters: {
          method: "POST",
          url: `${supabaseUrl}/rest/v1/webhook_logs`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: serviceKey },
              { name: "Authorization", value: `Bearer ${serviceKey}` },
              { name: "Content-Type", value: "application/json" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "channel_id", value: evoChannelId },
              { name: "event_type", value: "={{ $('Parse Evolution Payload').item.json.event_type }}" },
              { name: "source", value: "evolution" },
              { name: "status", value: "processed" }
            ]
          },
          options: {}
        },
        id: "d10f51fa-a406-4955-8b86-f20527bb1822",
        name: "Log Webhook Event",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [688, 1024]
      }
    ],
    connections: {
      "Evolution Webhook Trigger": {
        main: [[{ node: "Parse Evolution Payload", type: "main", index: 0 }]]
      },
      "Parse Evolution Payload": {
        main: [[{ node: "Is Message?", type: "main", index: 0 }]]
      },
      "Is Message?": {
        main: [
          // true (skip=true) -> skip, false (skip=undefined) -> process 
          [],
          [{ node: "Upsert Contact", type: "main", index: 0 }]
        ]
      },
      "Upsert Contact": {
        main: [[{ node: "Insert Message to Supabase", type: "main", index: 0 }]]
      },
      "Insert Message to Supabase": {
        main: [[{ node: "Log Webhook Event", type: "main", index: 0 }]]
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
  console.log("EVOLUTION workflow ACTIVATED SUCCESSFULLY!");
  return true;
}

// ==================== TEST BOTH WEBHOOKS ====================
function sendPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyStr = JSON.stringify(body);
    const options = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
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

async function testWebhooks() {
  console.log("\n=== TESTING WEBHOOKS ===");
  
  // Wait 2 seconds for webhooks to register
  await new Promise(r => setTimeout(r, 2000));
  
  // Test Meta
  console.log("\nTesting Meta POST...");
  const metaRes = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/webhook/meta", {
    object: "whatsapp_business_account",
    entry: [{
      id: "test123",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "5511999999999", phone_number_id: "test" },
          contacts: [{ profile: { name: "Teste Validacao" }, wa_id: "5511999999999" }],
          messages: [{
            from: "5511999999999",
            id: "wamid.TEST_VALIDATE_" + Date.now(),
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: "Teste de validacao Meta " + new Date().toLocaleTimeString() },
            type: "text"
          }]
        },
        field: "messages"
      }]
    }]
  });
  console.log(`Meta Response: ${metaRes.statusCode} - ${metaRes.body}`);

  // Test Evolution
  console.log("\nTesting Evolution POST...");
  const evoRes = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/webhook/evolution", {
    event: "messages.upsert",
    instance: "EvolutionInstance",
    data: {
      key: {
        remoteJid: "5511988888888@s.whatsapp.net",
        fromMe: false,
        id: "EVO_TEST_" + Date.now()
      },
      pushName: "Teste Validacao Evo",
      message: { conversation: "Teste de validacao Evolution " + new Date().toLocaleTimeString() },
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  });
  console.log(`Evolution Response: ${evoRes.statusCode} - ${evoRes.body}`);
  
  // Wait 3 seconds and check if executions were successful
  console.log("\nWaiting 3s to check execution results...");
  await new Promise(r => setTimeout(r, 3000));
  
  // Check latest executions
  for (const wfId of ["88zOQbdJAT7DOaET", "m5wmXXTYAqLiRM9c"]) {
    const result = await apiCall("GET", `/executions?workflowId=${wfId}&limit=1`);
    const execs = result.data?.data || [];
    if (execs.length > 0) {
      const ex = execs[0];
      console.log(`\nLatest execution for ${wfId}: ID=${ex.id} Status=${ex.status} Finished=${ex.stoppedAt}`);
      if (ex.status === 'error') {
        // Get details
        const detail = await apiCall("GET", `/executions/${ex.id}?includeData=true`);
        if (detail.data?.data?.resultData?.error) {
          console.log(`  ERROR: ${detail.data.data.resultData.error.message}`);
        }
      }
    }
  }
  
  // Check Supabase for the test messages
  console.log("\nChecking Supabase for test messages...");
  const supaResp = await new Promise((resolve, reject) => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    https.get(`${supabaseUrl}/rest/v1/messages?created_at=gte.${fiveMinAgo}&order=created_at.desc&limit=5&select=id,content,direction,content_type,channel_id,created_at`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data || '[]')));
    }).on('error', reject);
  });
  
  console.log(`Recent messages in Supabase (last 5 min): ${supaResp.length}`);
  for (const msg of supaResp) {
    console.log(`  - [${msg.direction}] ${msg.content} (type: ${msg.content_type}, channel: ${msg.channel_id?.substring(0,8)}..., at: ${msg.created_at})`);
  }
}

async function run() {
  const metaOk = await patchMeta();
  const evoOk = await patchEvolution();
  
  if (metaOk && evoOk) {
    await testWebhooks();
  } else {
    console.error("\nOne or more patches failed. Cannot test.");
  }
}

run();
