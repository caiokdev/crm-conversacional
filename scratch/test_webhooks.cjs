const https = require('https');

function sendPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body))
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log("Testing Meta Webhook POST...");
  try {
    const metaUrl = "https://n8n-n8n.rh3fr2.easypanel.host/webhook/webhook/meta";
    const res1 = await sendPost(metaUrl, {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "123456",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "5511999999999",
                  phone_number_id: "4886443e-4996-4d2a-83e1-d96f503e1a28"
                },
                contacts: [
                  {
                    profile: {
                      name: "Caio Teste"
                    },
                    wa_id: "5511999999999"
                  }
                ],
                messages: [
                  {
                    from: "5511999999999",
                    id: "wamid.HBgNNTUxMTk5OTk5OTk5OQcGPVE1NTExOTk5OTk5OTk5AA==",
                    timestamp: "1779813437",
                    text: {
                      body: "Testando Meta Webhook"
                    },
                    type: "text"
                  }
                ]
              },
              field: "messages"
            }
          ]
        }
      ]
    });
    console.log("Meta Response Status:", res1.statusCode);
    console.log("Meta Response Body:", res1.body);
  } catch (e) {
    console.error("Meta Webhook test failed:", e.message);
  }

  console.log("\nTesting Evolution Webhook POST...");
  try {
    const evolutionUrl = "https://n8n-n8n.rh3fr2.easypanel.host/webhook/webhook/evolution";
    const res2 = await sendPost(evolutionUrl, {
      event: "messages.upsert",
      instance: "EvolutionInstance",
      data: {
        key: {
          remoteJid: "5511988888888@s.whatsapp.net",
          fromMe: false,
          id: "EVO-MSG-12345"
        },
        pushName: "Caio Evolution Test",
        message: {
          conversation: "Testando Evolution Webhook"
        },
        messageTimestamp: 1779813437
      }
    });
    console.log("Evolution Response Status:", res2.statusCode);
    console.log("Evolution Response Body:", res2.body);
  } catch (e) {
    console.error("Evolution Webhook test failed:", e.message);
  }
}

test();
