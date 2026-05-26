const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";
const workflowId = "m5wmXXTYAqLiRM9c";

const parseCode = `// Parse Evolution API webhook payload
const body = $input.first().json.body || $input.first().json;
const event = body.event;

// Handle different Evolution events
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

  return [{    json: {
      event_type: 'message.received',
      whatsapp_msg_id: key.id,
      phone: phone,
      contact_name: pushName,
      direction: isFromMe ? 'out' : 'in',
      content: content,
      content_type: contentType,
      media_url: mediaUrl,
      timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
      instance: body.instance,
      raw_payload: body
    }  }];

} else if (event === 'connection.update') {
  // Session status change (connected, disconnected, expired)
  const state = body.data?.state;
  return [{
    json: {
      event_type: 'session.status',
      instance: body.instance,
      status: state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'expired',
      skip_message: true,
      raw_payload: body
    }
  }];

} else if (event === 'qrcode.updated') {
  return [{
    json: {
      event_type: 'qrcode.updated',
      instance: body.instance,
      qrcode: body.data?.qrcode,
      skip_message: true,
      raw_payload: body
    }
  }];

} else {
  return [{ json: { skip: true, reason: \`Unhandled event: \${event}\` } }];
}`;

const upsertCode = `// Safely upsert/create contact to avoid agent name overwriting client
const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnUxOWtoa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";
// Correction to match literal key: ibyterftfrqgkhktkaeg
const serviceKeyReal = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";

const phone = $json.phone;
const contactName = $json.contact_name;
const direction = $json.direction;

const bodyData = { phone };
// Only upsert name if the message is inbound from the client (direction === 'in')
if (direction === 'in' && contactName) {
  bodyData.name = contactName;
}

const contactResult = await $helpers.httpRequest({
  method: 'POST',
  url: \`\${supabaseUrl}/rest/v1/contacts?on_conflict=phone\`,
  headers: {
    'apikey': serviceKeyReal,
    'Authorization': \`Bearer \${serviceKeyReal}\`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation'
  },
  body: JSON.stringify(bodyData)
});

const contactId = contactResult?.[0]?.id;
return [{ json: { ...$json, contact_id: contactId } }];`;

const insertCode = `// Smart Upsert/Insert message to handle mobile sync & idempotency
const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";
const channelId = "50df1e49-8f4c-4f90-b3c5-e9b95e37d8ed";
const contactId = $json.contact_id;
const whatsappMsgId = $json.whatsapp_msg_id;
const content = $json.content;
const contentType = $json.content_type;
const mediaUrl = $json.media_url;
const direction = $json.direction; // 'in' or 'out'
const timestamp = $json.timestamp;

if (direction === 'out') {
  // Check if CRM already logged this outgoing message within the last 30s
  const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
  
  // Search for the most recent outbound message for this contact without an ID in the last 30s
  const searchUrl = \`\${supabaseUrl}/rest/v1/messages?contact_id=eq.\${contactId}&direction=eq.out&whatsapp_msg_id=is.null&created_at=gte.\${thirtySecsAgo}&order=created_at.desc&limit=1\`;
  
  try {
    const existingMsgs = await $helpers.httpRequest({
      method: 'GET',
      url: searchUrl,
      headers: {
        'apikey': serviceKey,
        'Authorization': \`Bearer \${serviceKey}\`
      }
    });
    
    if (existingMsgs && existingMsgs.length > 0) {
      // Outgoing message found! Link it to the real WhatsApp ID
      const match = existingMsgs[0];
      await $helpers.httpRequest({
        method: 'PATCH',
        url: \`\${supabaseUrl}/rest/v1/messages?id=eq.\${match.id}\`,
        headers: {
          'apikey': serviceKey,
          'Authorization': \`Bearer \${serviceKey}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          whatsapp_msg_id: whatsappMsgId,
          status: 'sent'
        })
      });
      return [{ json: { ...$json, message_id: match.id, action: 'updated' } }];
    }
  } catch (e) {
    console.error('Error checking for duplicate outgoing message:', e);
  }
} else {
  // For incoming messages, check if we already have this whatsapp_msg_id to prevent duplicates
  if (whatsappMsgId) {
    try {
      const existingMsgs = await $helpers.httpRequest({
        method: 'GET',
        url: \`\${supabaseUrl}/rest/v1/messages?whatsapp_msg_id=eq.\${whatsappMsgId}&select=id\`,
        headers: {
          'apikey': serviceKey,
          'Authorization': \`Bearer \${serviceKey}\`
        }
      });
      if (existingMsgs && existingMsgs.length > 0) {
        return [{ json: { ...$json, message_id: existingMsgs[0].id, action: 'skipped_duplicate' } }];
      }
    } catch (e) {
      console.error('Error checking for duplicate incoming message:', e);
    }
  }
}

// Insert a fresh row for client inbound or mobile-initiated outbound
const insertResult = await $helpers.httpRequest({
  method: 'POST',
  url: \`\${supabaseUrl}/rest/v1/messages\`,
  headers: {
    'apikey': serviceKey,
    'Authorization': \`Bearer \${serviceKey}\`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    channel_id: channelId,
    contact_id: contactId,
    direction: direction,
    content: content,
    content_type: contentType,
    media_url: mediaUrl,
    whatsapp_msg_id: whatsappMsgId,
    timestamp: timestamp,
    status: direction === 'out' ? 'sent' : undefined
  })
});

return [{ json: { ...$json, message_id: insertResult?.[0]?.id, action: 'inserted' } }];`;

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
  console.log("Deactivating Evolution Inbound workflow...");
  await apiCall("POST", `/workflows/${workflowId}/deactivate`);

  console.log("Updating Evolution Inbound workflow structure using robust IF nodes...");
  
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
          jsCode: parseCode
        },
        id: "588f5a8e-3d98-4ff8-b3d1-562a62415367",
        name: "Parse Evolution Payload",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [-272, 1168]
      },
      {
        parameters: {
          conditions: {
            string: [
              {
                value1: "={{ $json.event_type }}",
                operation: "equals",
                value2: "message.received"
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
      {
        parameters: {
          conditions: {
            string: [
              {
                value1: "={{ $json.event_type }}",
                operation: "equals",
                value2: "session.status"
              }
            ]
          }
        },
        id: "a123e004-be5b-4d3b-9eae-ecbf28cc997b",
        name: "Is Session Update?",
        type: "n8n-nodes-base.if",
        typeVersion: 1,
        position: [-32, 1368]
      },
      {
        parameters: {
          jsCode: upsertCode
        },
        id: "b4cf8e34-093a-419f-a13a-0a01ebb1c654",
        name: "Upsert Contact",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [208, 1024]
      },
      {
        parameters: {
          jsCode: insertCode
        },
        id: "617b8bc9-e5b8-4846-8b9a-447c34e11687",
        name: "Insert Message to Supabase",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [448, 1024]
      },
      {
        parameters: {
          method: "PATCH",
          url: "https://ibyterftfrqgkhktkaeg.supabase.co/rest/v1/channels?instance=eq.{{ $json.instance }}",
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
              { "name": "status", "value": "={{ $json.status }}" },
              { "name": "last_seen", "value": "={{ new Date().toISOString() }}" }
            ]
          },
          options: {}
        },
        id: "6421e004-be5b-4d3b-9eae-ecbf28cc997a",
        name: "Update Channel Status",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [208, 1368]
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
              { "name": "channel_id", "value": "50df1e49-8f4c-4f90-b3c5-e9b95e37d8ed" },
              { "name": "event_type", "value": "={{ $json.event_type }}" },
              { "name": "source", "value": "evolution" },
              { "name": "status", "value": "processed" }
            ]
          },
          options: {}
        },
        id: "d10f51fa-a406-4955-8b86-f20527bb1822",
        name: "Log Webhook Event",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [688, 1024]
      },
      {
        parameters: {
          method: "POST",
          url: "https://ibyterftfrqgkhktkaeg.supabase.co/rest/v1/failed_messages",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { "name": "channel_id", "value": "50df1e49-8f4c-4f90-b3c5-e9b95e37d8ed" },
              { "name": "payload", "value": "={{ JSON.stringify($json) }}" },
              { "name": "error_message", "value": "={{ $json.error?.message || 'Unknown error' }}" }
            ]
          },
          options: {}
        },
        id: "d721f079-b5bc-4f2a-afb3-2abde8f6f4e9",
        name: "Dead Letter Queue",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 3,
        position: [448, 1344]
      }
    ],
    connections: {
      "Evolution Webhook Trigger": {
        "main": [[{ "node": "Parse Evolution Payload", "type": "main", "index": 0 }]]
      },
      "Parse Evolution Payload": {
        "main": [[{ "node": "Is Message?", "type": "main", "index": 0 }]]
      },
      "Is Message?": {
        "main": [
          [{ "node": "Upsert Contact", "type": "main", "index": 0 }],
          [{ "node": "Is Session Update?", "type": "main", "index": 0 }]
        ]
      },
      "Is Session Update?": {
        "main": [
          [{ "node": "Update Channel Status", "type": "main", "index": 0 }]
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

  console.log("Re-activating Evolution Inbound workflow...");
  const activateRes = await apiCall("POST", `/workflows/${workflowId}/activate`);
  console.log("Activation status:", activateRes.statusCode);
  if (activateRes.statusCode === 200) {
    console.log("SUCCESS! Evolution Inbound workflow updated and activated directly on n8n server!");
  } else {
    console.error("Activation failed:", activateRes.data);
  }
}

run();
