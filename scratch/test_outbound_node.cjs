const https = require('https');

function sendPost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const s = JSON.stringify(body);
    const req = https.request({
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(s)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(s);
    req.end();
  });
}

async function run() {
  console.log("Sending Outbound webhook trigger...");
  const resp = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/send", {
    channel_id: "50df1e49-8f4c-4f90-b3c5-e9b95e37d8ed",
    contact_id: "1ace3945-9dd2-4bec-b245-1b1f829213b5",
    phone: "5512991408298",
    content: "Teste outbound final de confirmacao às " + new Date().toLocaleTimeString()
  });

  console.log("Response:", resp.statusCode, resp.body);
}

run();
