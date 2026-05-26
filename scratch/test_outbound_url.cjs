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
  // Test the URL the frontend uses
  console.log("Testing outbound URL (as frontend sends it): /webhook/send");
  const res1 = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/send", {
    channel_id: "4886443e-4996-4d2a-83e1-d96f503e1a28",
    phone: "5511999999999",
    content: "Test from frontend URL"
  });
  console.log(`  Status: ${res1.statusCode}`);
  console.log(`  Body: ${res1.body}`);

  // Test with /webhook/webhook/send 
  console.log("\nTesting /webhook/webhook/send");
  const res2 = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/webhook/send", {
    channel_id: "4886443e-4996-4d2a-83e1-d96f503e1a28",
    phone: "5511999999999",
    content: "Test from double webhook URL"
  });
  console.log(`  Status: ${res2.statusCode}`);
  console.log(`  Body: ${res2.body}`);
}

run();
