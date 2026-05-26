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
  console.log("=== CHECKING ALL MESSAGES TIMESTAMPS ===");
  const messages = await request('/messages?select=id,timestamp,content');
  if (Array.isArray(messages)) {
    let invalidCount = 0;
    messages.forEach(m => {
      const d = new Date(m.timestamp);
      if (isNaN(d.getTime())) {
        console.log(`INVALID MSG: ${m.id} | Timestamp: ${m.timestamp} | Content: ${m.content}`);
        invalidCount++;
      }
    });
    console.log(`Total messages checked: ${messages.length}. Invalid: ${invalidCount}`);
  } else {
    console.log("Error fetching messages:", messages);
  }
}

run();
