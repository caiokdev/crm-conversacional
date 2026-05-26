const https = require('https');

const supabaseUrl = 'https://ibyterftfrqgkhktkaeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDk4MDMsImV4cCI6MjA5NDAyNTgwM30.9I7RS-NxobdNvr76U_Z9H4IiW10SUfqEzzfVGCa46Uk';

function request(path) {
  return new Promise((resolve, reject) => {
    const url = `${supabaseUrl}/rest/v1${path}`;
    const options = {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Failed parsing response', raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log("=== FETCHING MESSAGES FOR CAIO (1ace3945-9dd2-4bec-b245-1b1f829213b5) ===");
  const messages = await request('/messages?contact_id=eq.1ace3945-9dd2-4bec-b245-1b1f829213b5&select=*&order=timestamp.asc');
  console.log("Messages count:", Array.isArray(messages) ? messages.length : 0);
  if (Array.isArray(messages)) {
    messages.forEach(m => {
      console.log(`[${m.direction}] Content: ${m.content} | Time: ${m.timestamp}`);
    });
  } else {
    console.log("Error or invalid response:", messages);
  }
}

run();
