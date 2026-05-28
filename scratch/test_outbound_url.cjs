const https = require('https');

const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";

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

async function run() {
  console.log("Testing outbound webhook /webhook/send with valid contact_id");
  const payload = {
    channel_id: "4886443e-4996-4d2a-83e1-d96f503e1a28",
    contact_id: "69c52004-a487-474f-a2cc-529f1a1b3505",
    phone: "5512991960679",
    content: "Teste de envio Meta API por Antigravity às " + new Date().toLocaleTimeString()
  };
  
  console.log("Payload:", JSON.stringify(payload, null, 2));
  
  const res1 = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/send", payload);
  console.log(`  Status Code: ${res1.statusCode}`);
  console.log(`  Response Body: ${res1.body}`);

  if (res1.statusCode === 200) {
    console.log("\nSuccess! Verifying message insertion in Supabase...");
    
    // Wait a brief moment for database sync
    await new Promise(r => setTimeout(r, 2000));
    
    const queryUrl = `${supabaseUrl}/rest/v1/messages?contact_id=eq.${payload.contact_id}&order=timestamp.desc&limit=3`;
    const options = {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    };
    
    https.get(queryUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const msgs = JSON.parse(data);
          console.log("\n=== LATEST MESSAGES LOGGED IN SUPABASE ===");
          msgs.forEach(m => {
            console.log(`- ID: ${m.id} | Dir: ${m.direction} | Content: "${m.content}" | Timestamp: ${m.timestamp}`);
          });
        } catch (e) {
          console.error("Failed to parse Supabase response:", data);
        }
      });
    });
  } else {
    console.log("\nFailed request. Checking n8n server logs may be needed.");
  }
}

run();
