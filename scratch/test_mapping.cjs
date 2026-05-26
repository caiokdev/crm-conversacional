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
  console.log("=== SIMULATING LOADDATA ===");
  const dbContacts = await request('/contacts?select=*');
  const dbMessages = await request('/messages?select=*&order=timestamp.asc');

  console.log("Loaded raw contacts:", dbContacts.length);
  console.log("Loaded raw messages:", dbMessages.length);

  const mappedContacts = dbContacts.map(c => {
    // Exact mapping from CrmContext.jsx
    const cMsgs = (dbMessages || []).filter(m => m.contact_id === c.id).map(m => {
      return {
        id: m.id,
        sender: m.direction === 'in' ? 'client' : 'agent',
        text: m.content,
        time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(m.timestamp),
        channel_id: m.channel_id,
        content_type: m.content_type,
        media_url: m.media_url,
        status: m.direction === 'out' ? 'sent' : undefined
      };
    });
    return {
      id: c.id,
      name: c.name || c.phone,
      phone: c.phone,
      messagesCount: cMsgs.length,
      messages: cMsgs
    };
  });

  mappedContacts.forEach(mc => {
    console.log(`Contact: ${mc.name} (${mc.phone}) | Messages Linked: ${mc.messagesCount}`);
    if (mc.messagesCount > 0) {
      console.log(`  Last msg: [${mc.messages[mc.messagesCount-1].sender}] ${mc.messages[mc.messagesCount-1].text}`);
    }
  });
}

run();
