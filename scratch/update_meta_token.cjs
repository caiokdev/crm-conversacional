const https = require('https');

const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";
const newToken = "EAARutYjXAksBRnKL0ijQiSXmASMC33skWjqmZAaQWlmzf978nFZAM3M5O80tY4jDwjxqPUgApGZBEZBY0AIBvBsgljwejugd2KoY1x2elb03nH8MzkeZAjEYJ7jjZCrZBlUZA5bGFG3jaZAD9zI5Ri0PzilZBrU56Wo41G8m2X54Dje0L5KvYuvtEKQawada5yllED6QZDZD";

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(supabaseUrl + path);
    const opt = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
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
  console.log("Fetching meta channels...");
  const getRes = await apiCall("GET", "/rest/v1/channels?provider=eq.meta&select=*");
  if (!getRes.data || getRes.data.length === 0) {
    console.log("No meta channel found.");
    return;
  }
  
  const channel = getRes.data[0];
  console.log("Found Meta Channel ID:", channel.id);
  
  console.log("Updating access token...");
  const updateRes = await apiCall("PATCH", `/rest/v1/channels?id=eq.${channel.id}`, {
    access_token: newToken
  });
  
  console.log("Update status:", updateRes.statusCode);
  if (updateRes.statusCode >= 200 && updateRes.statusCode < 300) {
    console.log("Successfully updated the token!");
  } else {
    console.error("Failed:", updateRes.data);
  }
}

run();
