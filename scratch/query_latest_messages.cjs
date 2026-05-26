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
  console.log("=== FETCHING LATEST 10 MESSAGES ===");
  const messages = await request('/messages?select=id,contact_id,direction,content,timestamp,created_at&order=created_at.desc&limit=10');
  if (Array.isArray(messages)) {
    messages.forEach(m => {
      console.log(`Msg ID: ${m.id} | ContactID: ${m.contact_id} | Direction: ${m.direction} | Content: ${m.content} | CreatedAt: ${m.created_at}`);
    });
  } else {
    console.log("Error fetching messages:", messages);
  }
}

run();
