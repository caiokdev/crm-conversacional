const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";

const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";
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
      res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

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
  
  console.log("=== Patching EVOLUTION Inbound Webhook ===");
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
      // IF: boolean check on 'skip' field (proven working format from Meta)
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
      // Upsert Contact via HTTP Request — use bodyParameters (simple key-value)
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
      // Insert Message via HTTP Request — use simple bodyParameters (key-value pairs)
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
              { name: "channel_id", value: evoChannelId },
              { name: "contact_id", value: "={{ $json[0].id }}" },
              { name: "direction", value: `={{ $('Parse Evolution Payload').item.json.direction }}` },
              { name: "content", value: `={{ $('Parse Evolution Payload').item.json.content }}` },
              { name: "content_type", value: `={{ $('Parse Evolution Payload').item.json.content_type }}` },
              { name: "media_url", value: `={{ $('Parse Evolution Payload').item.json.media_url }}` },
              { name: "whatsapp_msg_id", value: `={{ $('Parse Evolution Payload').item.json.whatsapp_msg_id }}` },
              { name: "timestamp", value: `={{ $('Parse Evolution Payload').item.json.timestamp }}` }
            ]
          },
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
              { name: "event_type", value: `={{ $('Parse Evolution Payload').item.json.event_type }}` },
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

async function testEvolution() {
  console.log("\n=== TESTING EVOLUTION WEBHOOK ===");
  await new Promise(r => setTimeout(r, 2000));
  
  const evoRes = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/webhook/evolution", {
    event: "messages.upsert",
    instance: "EvolutionInstance",
    data: {
      key: {
        remoteJid: "5511988888888@s.whatsapp.net",
        fromMe: false,
        id: "EVO_FINAL_TEST_" + Date.now()
      },
      pushName: "Teste Final Evo",
      message: { conversation: "Teste final Evolution " + new Date().toLocaleTimeString() },
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  });
  console.log(`Evolution Response: ${evoRes.statusCode} - ${evoRes.body}`);

  console.log("Waiting 3s...");
  await new Promise(r => setTimeout(r, 3000));
  
  // Check latest execution
  const wfId = "m5wmXXTYAqLiRM9c";
  const result = await apiCall("GET", `/executions?workflowId=${wfId}&limit=1`);
  const execs = result.data?.data || [];
  if (execs.length > 0) {
    const ex = execs[0];
    console.log(`Latest execution: ID=${ex.id} Status=${ex.status}`);
    if (ex.status === 'error') {
      const detail = await apiCall("GET", `/executions/${ex.id}?includeData=true`);
      const rd = detail.data?.data?.resultData || {};
      if (rd.error) {
        console.log(`  GLOBAL ERROR: ${rd.error.message}`);
      }
      // Check each node
      for (const [name, nodeExecs] of Object.entries(rd.runData || {})) {
        for (const ne of nodeExecs) {
          if (ne.error) {
            console.log(`  Node "${name}" ERROR: ${ne.error.message}`);
            if (ne.error.description) console.log(`    Description: ${ne.error.description}`);
          }
        }
      }
    }
  }

  // Check Supabase
  const supaResp = await new Promise((resolve, reject) => {
    const twoMinAgo = new Date(Date.now() - 2 * 60000).toISOString();
    https.get(`${supabaseUrl}/rest/v1/messages?created_at=gte.${twoMinAgo}&order=created_at.desc&limit=5&select=id,content,direction,content_type,channel_id,created_at`, {
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
  
  console.log(`\nRecent messages in Supabase (last 2 min): ${supaResp.length}`);
  for (const msg of supaResp) {
    console.log(`  - [${msg.direction}] ${msg.content} (channel: ${msg.channel_id?.substring(0,8)})`);
  }
}

async function run() {
  const ok = await patchEvolution();
  if (ok) {
    await testEvolution();
  }
}

run();
