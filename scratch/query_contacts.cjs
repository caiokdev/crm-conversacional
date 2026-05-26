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
  console.log("=== FETCHING CONTACTS ===");
  const contacts = await request('/contacts?select=*');
  console.log("Contacts count:", Array.isArray(contacts) ? contacts.length : 0);
  if (Array.isArray(contacts)) {
    contacts.forEach(c => {
      console.log(`ID: ${c.id} | Name: ${c.name} | Phone: ${c.phone} | CreatedAt: ${c.created_at}`);
    });
  } else {
    console.log("Error or invalid response:", contacts);
  }

  console.log("\n=== FETCHING RECENT MESSAGES ===");
  const messages = await request('/messages?select=*&order=timestamp.desc&limit=10');
  if (Array.isArray(messages)) {
    messages.forEach(m => {
      console.log(`Msg ID: ${m.id} | ContactID: ${m.contact_id} | Direction: ${m.direction} | Content: ${m.content} | Time: ${m.timestamp}`);
    });
  } else {
    console.log("Error or invalid response:", messages);
  }
}

run();
