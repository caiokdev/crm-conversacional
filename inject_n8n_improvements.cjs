const fs = require('fs');
const crypto = require('crypto');

const wf = JSON.parse(fs.readFileSync('ai_agent.json', 'utf8'));

// Generate unique IDs for new nodes
const waitId = crypto.randomUUID();
const fetchMsgId = crypto.randomUUID();
const ifLatestId = crypto.randomUUID();
const splitCodeId = crypto.randomUUID();
const loopId = crypto.randomUUID();
const typingWaitId = crypto.randomUUID();

// 1. Debounce Nodes
wf.nodes.push({
  parameters: {
    resume: 'afterTime',
    amount: 8,
    unit: 'seconds'
  },
  id: waitId,
  name: 'Debounce Wait',
  type: 'n8n-nodes-base.wait',
  typeVersion: 1,
  position: [200, 100]
});

wf.nodes.push({
  parameters: {
    method: 'GET',
    url: '=https://ibyterftfrqgkhktkaeg.supabase.co/rest/v1/messages?contact_id=eq.{{ $(\'AI Webhook Trigger\').item.json.body.contact_id }}&order=created_at.desc&limit=1',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: 'apikey',
          value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.LEAKED_KEY_REMOVED'
        },
        {
          name: 'Authorization',
          value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.LEAKED_KEY_REMOVED'
        }
      ]
    },
    options: {}
  },
  id: fetchMsgId,
  name: 'Fetch Latest Msg',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 3,
  position: [400, 100]
});

wf.nodes.push({
  parameters: {
    conditions: {
      string: [
        {
          value1: '={{ $json[0].id }}',
          value2: '={{ $(\'AI Webhook Trigger\').item.json.body.id }}'
        }
      ]
    }
  },
  id: ifLatestId,
  name: 'If Is Latest',
  type: 'n8n-nodes-base.if',
  typeVersion: 1,
  position: [600, 100]
});

// Rewire Start -> Debounce -> ... -> AI Settings
wf.connections['AI Webhook Trigger'] = {
  main: [ [ { node: 'Debounce Wait', type: 'main', index: 0 } ] ]
};
wf.connections['Debounce Wait'] = {
  main: [ [ { node: 'Fetch Latest Msg', type: 'main', index: 0 } ] ]
};
wf.connections['Fetch Latest Msg'] = {
  main: [ [ { node: 'If Is Latest', type: 'main', index: 0 } ] ]
};
wf.connections['If Is Latest'] = {
  main: [ [ { node: 'Fetch AI Settings', type: 'main', index: 0 } ] ]
};
// Move Fetch AI Settings position
const aiSettingsNode = wf.nodes.find(n => n.name === 'Fetch AI Settings');
if(aiSettingsNode) aiSettingsNode.position = [800, 300];


// 2. Split and Loop nodes
wf.nodes.push({
  parameters: {
    jsCode: `
const input = $input.first().json;
let output = input.content || "";

// 1. PROTEÇÃO (MÁSCARA):
output = output.replace(/\\b(Dr|Dra|Sr|Sra)\\.\\s/gi, "$1@@ ");

// 2. CORTE SEGURO:
const partes = output.split(/(?<=[.!?]) +|\\n+/);

const returnItems = [];
// 3. RESTAURAÇÃO E LIMPEZA:
partes.forEach(pedaco => {
  let textoLimpo = pedaco.trim();
  
  if (textoLimpo.length > 0) {
    textoLimpo = textoLimpo.replace(/@@/g, ".");
    returnItems.push({
      json: { 
        ...input,
        content: textoLimpo 
      }
    });
  }
});

return returnItems;
`
  },
  id: splitCodeId,
  name: 'Split AI Response',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1800, 300]
});

wf.nodes.push({
  parameters: {
    batchSize: 1,
    options: {}
  },
  id: loopId,
  name: 'Loop Over Messages',
  type: 'n8n-nodes-base.splitInBatches',
  typeVersion: 2,
  position: [2000, 300]
});

wf.nodes.push({
  parameters: {
    resume: 'afterTime',
    amount: 3,
    unit: 'seconds'
  },
  id: typingWaitId,
  name: 'Typing Wait',
  type: 'n8n-nodes-base.wait',
  typeVersion: 1,
  position: [2200, 300]
});

// Rewire End sequence
wf.connections['Extract AI Answer'] = {
  main: [ [ { node: 'Split AI Response', type: 'main', index: 0 } ] ]
};
wf.connections['Split AI Response'] = {
  main: [ [ { node: 'Loop Over Messages', type: 'main', index: 0 } ] ]
};
wf.connections['Loop Over Messages'] = {
  main: [
    [ { node: 'Typing Wait', type: 'main', index: 0 } ],
    [] // Done branch empty
  ]
};
wf.connections['Typing Wait'] = {
  main: [ [ { node: 'Send AI Response', type: 'main', index: 0 } ] ]
};
wf.connections['Send AI Response'] = {
  main: [ [ { node: 'Loop Over Messages', type: 'main', index: 0 } ] ]
};
const sendAiNode = wf.nodes.find(n => n.name === 'Send AI Response');
if(sendAiNode) sendAiNode.position = [2400, 300];

fs.writeFileSync('ai_agent.json', JSON.stringify(wf, null, 2));
console.log('Successfully injected n8n improvements into ai_agent.json');
