const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyN2Y2NjgzMS1iNjE2LTQwZGEtYjZkYS05MGQzZWExMmE0NmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmNjYzViNWQtOTI4NS00N2I2LWJhOWUtNmZhYjQ1NDM1MTc0IiwiaWF0IjoxNzc5ODE1MjU0fQ.-l3smjKe9_ejhjXd1X7HzdnxROuC2CZQblCC7KJoJYM";
const supabaseUrl = "https://ibyterftfrqgkhktkaeg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieXRlcmZ0ZnJxZ2toa3RrYWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0OTgwMywiZXhwIjoyMDk0MDI1ODAzfQ.9ObjlZum0x9XQuZYVxBZJGzLKA_jbaz1wqxC4lMj_M8";
const metaChannelId = "4886443e-4996-4d2a-83e1-d96f503e1a28";
const evoChannelId = "50df1e49-8f4c-4f90-b3c5-e9b95e37d8ed";

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const opt = { method, hostname:"n8n-n8n.rh3fr2.easypanel.host", path:"/api/v1"+path, headers:{'X-N8N-API-KEY':apiKey,'Content-Type':'application/json'} };
    const req = https.request(opt, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({statusCode:res.statusCode,data:JSON.parse(d||'{}')})); });
    req.on('error',reject); if(body) req.write(JSON.stringify(body)); req.end();
  });
}
function sendPost(url, body) {
  return new Promise((resolve, reject) => {
    const u=new URL(url); const s=JSON.stringify(body);
    const req=https.request({method:'POST',hostname:u.hostname,path:u.pathname,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(s)}}, (res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({statusCode:res.statusCode,body:d}));});
    req.on('error',reject); req.write(s); req.end();
  });
}

// IF v2.2 node with STRING equals check (not boolean!) 
function makeIfEquals(id, name, position, leftValue, rightValue) {
  return {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [{ id:"c-"+Date.now(), leftValue, rightValue, operator: { type:"string", operation:"equals" } }],
        combinator: "and"
      },
      options: {}
    },
    id, name, type:"n8n-nodes-base.if", typeVersion:2.2, position
  };
}

// Parse codes that set event_type for routing
const metaParseCode = `const body = $input.first().json.body || $input.first().json;
const entry = body.entry?.[0];
const changes = entry?.changes?.[0];
const value = changes?.value;
const message = value?.messages?.[0];
const contact = value?.contacts?.[0];
if (!message) return [{ json: { event_type:'skip', reason:'No message' } }];
const type = message.type || 'text';
let content = message.text?.body || message.caption || '';
if (['image','audio','video','document'].includes(type) && !content) {
  if (type==='image') content='[Imagem]'; else if (type==='audio') content='[Áudio]';
  else if (type==='video') content='[Vídeo]'; else if (type==='document') content='[Documento]';
  else content='[Mídia]';
}
return [{ json: { event_type:'message.received', whatsapp_msg_id:message.id, phone:message.from, contact_name:contact?.profile?.name||message.from, direction:'in', content, content_type:type, media_url:null, timestamp:new Date(parseInt(message.timestamp)*1000).toISOString() } }];`;

const evoParseCode = `const body = $input.first().json.body || $input.first().json;
const event = body.event;
if (event === 'messages.upsert') {
  const msg = body.data; const key = msg.key;
  const phone = key.remoteJid?.split('@')[0]?.split(':')[0] || '';
  let content='', contentType='text', mediaUrl=null;
  if (msg.message?.conversation) content = msg.message.conversation;
  else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
  else if (msg.message?.imageMessage) { content = msg.message.imageMessage.caption || '[Imagem]'; contentType='image'; mediaUrl=msg.message.imageMessage.url; }
  else if (msg.message?.audioMessage) { content='[Áudio]'; contentType='audio'; mediaUrl=msg.message.audioMessage.url; }
  else if (msg.message?.videoMessage) { content = msg.message.videoMessage.caption || '[Vídeo]'; contentType='video'; mediaUrl=msg.message.videoMessage.url; }
  else if (msg.message?.documentMessage) { content = msg.message.documentMessage.fileName || '[Documento]'; contentType='document'; mediaUrl=msg.message.documentMessage.url; }
  else if (msg.message?.stickerMessage) { content='[Sticker]'; contentType='sticker'; }
  else content='[Mensagem não suportada]';
  return [{ json: { event_type:'message.received', whatsapp_msg_id:key.id, phone, contact_name:msg.pushName||phone, direction:key.fromMe?'out':'in', content, content_type:contentType, media_url:mediaUrl, timestamp:new Date(msg.messageTimestamp*1000).toISOString(), instance:body.instance }}];
} else return [{ json: { event_type:'skip', reason:'Not a message: '+event }}];`;

const resolveCode = `const body = $('Send Message Trigger').item.json.body || $('Send Message Trigger').item.json;
const channelData = $('Fetch Channel').item.json;
const channel = Array.isArray(channelData) ? channelData[0] : channelData;
return [{ json: { channel_id:body.channel_id, contact_id:body.contact_id, provider:channel?.provider||'unknown', content:body.content, phone:body.phone, phone_id:channel?.phone_id, access_token:channel?.access_token, evo_url:channel?.url, evo_instance:channel?.instance, evo_api_key:channel?.api_key }}];`;

async function fixAll() {
  // ===== META =====
  console.log("=== Fixing META ===");
  await apiCall("POST","/workflows/88zOQbdJAT7DOaET/deactivate");
  let r = await apiCall("PUT","/workflows/88zOQbdJAT7DOaET", {
    name:"WhatsApp Meta Official – Inbound Webhook",
    nodes: [
      {parameters:{httpMethod:"POST",path:"webhook/meta",responseMode:"onReceived",options:{}},id:"1d6629ba-7d5d-4e0e-b942-c0d0b82fe845",name:"Meta Webhook Trigger",type:"n8n-nodes-base.webhook",typeVersion:1,position:[240,300]},
      {parameters:{jsCode:metaParseCode},id:"261d6387-b099-4a21-a289-76b8c758aaa8",name:"Parse Meta Payload",type:"n8n-nodes-base.code",typeVersion:2,position:[480,300]},
      // IF: event_type equals "message.received" -> TRUE=process, FALSE=skip
      makeIfEquals("d9c2d088-ac0d-42ce-b58e-ab11dc919585","Has Message?",[700,300],"={{ $json.event_type }}","message.received"),
      {parameters:{method:"POST",url:`${supabaseUrl}/rest/v1/contacts?on_conflict=phone`,sendHeaders:true,headerParameters:{parameters:[{name:"apikey",value:serviceKey},{name:"Authorization",value:`Bearer ${serviceKey}`},{name:"Content-Type",value:"application/json"},{name:"Prefer",value:"resolution=merge-duplicates,return=representation"}]},sendBody:true,specifyBody:"json",jsonBody:`={\n  "phone":"{{ $('Parse Meta Payload').item.json.phone }}",\n  "name":"{{ $('Parse Meta Payload').item.json.contact_name }}"\n}`,options:{}},id:"767892d0-6059-45ba-be6f-30f96025ca32",name:"Upsert Contact",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[920,200]},
      {parameters:{method:"POST",url:`${supabaseUrl}/rest/v1/messages`,sendHeaders:true,headerParameters:{parameters:[{name:"apikey",value:serviceKey},{name:"Authorization",value:`Bearer ${serviceKey}`},{name:"Content-Type",value:"application/json"},{name:"Prefer",value:"return=representation"}]},sendBody:true,bodyParameters:{parameters:[{name:"channel_id",value:metaChannelId},{name:"contact_id",value:"={{ $json.id }}"},{name:"direction",value:"in"},{name:"content",value:`={{ $('Parse Meta Payload').item.json.content }}`},{name:"content_type",value:`={{ $('Parse Meta Payload').item.json.content_type }}`},{name:"media_url",value:`={{ $('Parse Meta Payload').item.json.media_url }}`},{name:"whatsapp_msg_id",value:`={{ $('Parse Meta Payload').item.json.whatsapp_msg_id }}`},{name:"timestamp",value:`={{ $('Parse Meta Payload').item.json.timestamp }}`}]},options:{}},id:"768d3699-117b-4346-bfb1-5fd614054dbf",name:"Insert Message to Supabase",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[1160,200]},
      {parameters:{method:"POST",url:`${supabaseUrl}/rest/v1/webhook_logs`,sendHeaders:true,headerParameters:{parameters:[{name:"apikey",value:serviceKey},{name:"Authorization",value:`Bearer ${serviceKey}`},{name:"Content-Type",value:"application/json"}]},sendBody:true,bodyParameters:{parameters:[{name:"channel_id",value:metaChannelId},{name:"event_type",value:"message.received"},{name:"source",value:"meta"},{name:"status",value:"processed"}]},options:{}},id:"e682408c-9bf6-41f9-87a7-5436642d4ec5",name:"Log Webhook Event",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[1400,200]}
    ],
    connections:{"Meta Webhook Trigger":{main:[[{node:"Parse Meta Payload",type:"main",index:0}]]},"Parse Meta Payload":{main:[[{node:"Has Message?",type:"main",index:0}]]},"Has Message?":{main:[[{node:"Upsert Contact",type:"main",index:0}],[]]},"Upsert Contact":{main:[[{node:"Insert Message to Supabase",type:"main",index:0}]]},"Insert Message to Supabase":{main:[[{node:"Log Webhook Event",type:"main",index:0}]]}},
    settings:{}
  });
  console.log("Update:", r.statusCode);
  if(r.statusCode!==200){console.error(JSON.stringify(r.data));return;}
  r=await apiCall("POST","/workflows/88zOQbdJAT7DOaET/activate");
  console.log("Activate:", r.statusCode, r.statusCode===200?"OK":"FAIL");

  // ===== EVOLUTION =====
  console.log("\n=== Fixing EVOLUTION ===");
  await apiCall("POST","/workflows/m5wmXXTYAqLiRM9c/deactivate");
  r = await apiCall("PUT","/workflows/m5wmXXTYAqLiRM9c", {
    name:"WhatsApp Evolution API – Inbound Webhook",
    nodes: [
      {parameters:{httpMethod:"POST",path:"webhook/evolution",options:{}},id:"f79aec30-2f4a-4a5f-be76-a73d28679181",name:"Evolution Webhook Trigger",type:"n8n-nodes-base.webhook",typeVersion:1,position:[-512,1168]},
      {parameters:{jsCode:evoParseCode},id:"588f5a8e-3d98-4ff8-b3d1-562a62415367",name:"Parse Evolution Payload",type:"n8n-nodes-base.code",typeVersion:2,position:[-272,1168]},
      makeIfEquals("91b9cbe2-6116-42e3-a45e-82eee5ae48f5","Is Message?",[-32,1168],"={{ $json.event_type }}","message.received"),
      {parameters:{method:"POST",url:`${supabaseUrl}/rest/v1/contacts?on_conflict=phone`,sendHeaders:true,headerParameters:{parameters:[{name:"apikey",value:serviceKey},{name:"Authorization",value:`Bearer ${serviceKey}`},{name:"Content-Type",value:"application/json"},{name:"Prefer",value:"resolution=merge-duplicates,return=representation"}]},sendBody:true,specifyBody:"json",jsonBody:`={\n  "phone":"{{ $('Parse Evolution Payload').item.json.phone }}",\n  "name":"{{ $('Parse Evolution Payload').item.json.contact_name }}"\n}`,options:{}},id:"b4cf8e34-093a-419f-a13a-0a01ebb1c654",name:"Upsert Contact",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[208,1024]},
      {parameters:{method:"POST",url:`${supabaseUrl}/rest/v1/messages`,sendHeaders:true,headerParameters:{parameters:[{name:"apikey",value:serviceKey},{name:"Authorization",value:`Bearer ${serviceKey}`},{name:"Content-Type",value:"application/json"},{name:"Prefer",value:"return=representation"}]},sendBody:true,bodyParameters:{parameters:[{name:"channel_id",value:evoChannelId},{name:"contact_id",value:"={{ $json.id }}"},{name:"direction",value:`={{ $('Parse Evolution Payload').item.json.direction }}`},{name:"content",value:`={{ $('Parse Evolution Payload').item.json.content }}`},{name:"content_type",value:`={{ $('Parse Evolution Payload').item.json.content_type }}`},{name:"media_url",value:`={{ $('Parse Evolution Payload').item.json.media_url }}`},{name:"whatsapp_msg_id",value:`={{ $('Parse Evolution Payload').item.json.whatsapp_msg_id }}`},{name:"timestamp",value:`={{ $('Parse Evolution Payload').item.json.timestamp }}`}]},options:{}},id:"617b8bc9-e5b8-4846-8b9a-447c34e11687",name:"Insert Message to Supabase",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[448,1024]},
      {parameters:{method:"POST",url:`${supabaseUrl}/rest/v1/webhook_logs`,sendHeaders:true,headerParameters:{parameters:[{name:"apikey",value:serviceKey},{name:"Authorization",value:`Bearer ${serviceKey}`},{name:"Content-Type",value:"application/json"}]},sendBody:true,bodyParameters:{parameters:[{name:"channel_id",value:evoChannelId},{name:"event_type",value:`={{ $('Parse Evolution Payload').item.json.event_type }}`},{name:"source",value:"evolution"},{name:"status",value:"processed"}]},options:{}},id:"d10f51fa-a406-4955-8b86-f20527bb1822",name:"Log Webhook Event",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[688,1024]}
    ],
    connections:{"Evolution Webhook Trigger":{main:[[{node:"Parse Evolution Payload",type:"main",index:0}]]},"Parse Evolution Payload":{main:[[{node:"Is Message?",type:"main",index:0}]]},"Is Message?":{main:[[{node:"Upsert Contact",type:"main",index:0}],[]]},"Upsert Contact":{main:[[{node:"Insert Message to Supabase",type:"main",index:0}]]},"Insert Message to Supabase":{main:[[{node:"Log Webhook Event",type:"main",index:0}]]}},
    settings:{}
  });
  console.log("Update:", r.statusCode);
  if(r.statusCode!==200){console.error(JSON.stringify(r.data));return;}
  r=await apiCall("POST","/workflows/m5wmXXTYAqLiRM9c/activate");
  console.log("Activate:", r.statusCode, r.statusCode===200?"OK":"FAIL");

  // ===== OUTBOUND =====
  console.log("\n=== Fixing OUTBOUND ===");
  await apiCall("POST","/workflows/NFkf4R8DDJ2o7Sqx/deactivate");
  r = await apiCall("PUT","/workflows/NFkf4R8DDJ2o7Sqx", {
    name:"WhatsApp – Outbound Send Message",
    nodes: [
      {parameters:{httpMethod:"POST",path:"send",responseMode:"lastNode",options:{}},id:"f5cc9383-b694-4e74-9248-ba5d41f0231d",name:"Send Message Trigger",type:"n8n-nodes-base.webhook",typeVersion:1,position:[960,928]},
      {parameters:{method:"GET",url:`=${supabaseUrl}/rest/v1/channels?id=eq.{{ $json.body?.channel_id || $json.channel_id }}&select=*`,sendHeaders:true,headerParameters:{parameters:[{name:"apikey",value:serviceKey},{name:"Authorization",value:`Bearer ${serviceKey}`}]},options:{}},id:"a1234567-0001-0001-0001-000000000001",name:"Fetch Channel",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[1200,928]},
      {parameters:{jsCode:resolveCode},id:"36a82d05-75ba-4e5a-bff4-201382e2fd6e",name:"Resolve Channel",type:"n8n-nodes-base.code",typeVersion:2,position:[1440,928]},
      makeIfEquals("7ee5a4e9-db7b-4331-82dd-bf8b938158db","Which Provider?1",[1680,928],"={{ $json.provider }}","meta"),
      {parameters:{method:"POST",url:"=https://graph.facebook.com/v20.0/{{ $json.phone_id }}/messages",sendHeaders:true,headerParameters:{parameters:[{name:"Authorization",value:"Bearer {{ $json.access_token }}"},{name:"Content-Type",value:"application/json"}]},sendBody:true,specifyBody:"json",jsonBody:`={\n  "messaging_product":"whatsapp",\n  "to":"{{ $json.phone }}",\n  "type":"text",\n  "text":{"body":"{{ $json.content }}"}\n}`,options:{timeout:15000}},id:"3a5db98f-770f-4fbc-b4a2-dea74a35a623",name:"Send via Meta API1",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[1920,800]},
      {parameters:{method:"POST",url:"={{ $json.evo_url }}/message/sendText/{{ $json.evo_instance }}",sendHeaders:true,headerParameters:{parameters:[{name:"apikey",value:"={{ $json.evo_api_key }}"},{name:"Content-Type",value:"application/json"}]},sendBody:true,specifyBody:"json",jsonBody:`={\n  "number":"{{ $json.phone }}@s.whatsapp.net",\n  "text":"{{ $json.content }}"\n}`,options:{timeout:15000}},id:"3100315a-c6ec-45f0-8294-e4cc73047a34",name:"Send via Evolution API1",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[1920,1040]},
      {parameters:{method:"POST",url:`${supabaseUrl}/rest/v1/messages`,sendHeaders:true,headerParameters:{parameters:[{name:"apikey",value:serviceKey},{name:"Authorization",value:`Bearer ${serviceKey}`},{name:"Content-Type",value:"application/json"},{name:"Prefer",value:"return=representation"}]},sendBody:true,bodyParameters:{parameters:[{name:"channel_id",value:"={{ $json.channel_id || $input.first().json.channel_id }}"},{name:"contact_id",value:"={{ $json.contact_id || $input.first().json.contact_id }}"},{name:"direction",value:"out"},{name:"content",value:"={{ $json.content || $input.first().json.content }}"},{name:"content_type",value:"text"},{name:"timestamp",value:"={{ new Date().toISOString() }}"}]},options:{}},id:"8f054d66-7182-4dfb-bcb9-5c2b9617b361",name:"Log Outgoing Message1",type:"n8n-nodes-base.httpRequest",typeVersion:3,position:[2160,928]},
      {parameters:{jsCode:`return [{ json: { success: true, message: 'Mensagem enviada com sucesso' } }];`},id:"cf9b8f69-3960-4a69-a4de-214830b2d082",name:"Response OK1",type:"n8n-nodes-base.code",typeVersion:2,position:[2400,928]}
    ],
    connections:{"Send Message Trigger":{main:[[{node:"Fetch Channel",type:"main",index:0}]]},"Fetch Channel":{main:[[{node:"Resolve Channel",type:"main",index:0}]]},"Resolve Channel":{main:[[{node:"Which Provider?1",type:"main",index:0}]]},"Which Provider?1":{main:[[{node:"Send via Meta API1",type:"main",index:0}],[{node:"Send via Evolution API1",type:"main",index:0}]]},"Send via Meta API1":{main:[[{node:"Log Outgoing Message1",type:"main",index:0}]]},"Send via Evolution API1":{main:[[{node:"Log Outgoing Message1",type:"main",index:0}]]},"Log Outgoing Message1":{main:[[{node:"Response OK1",type:"main",index:0}]]}},
    settings:{}
  });
  console.log("Update:", r.statusCode);
  if(r.statusCode!==200){console.error(JSON.stringify(r.data));return;}
  r=await apiCall("POST","/workflows/NFkf4R8DDJ2o7Sqx/activate");
  console.log("Activate:", r.statusCode, r.statusCode===200?"OK":"FAIL");

  // ===== TEST =====
  console.log("\n=== FULL E2E TEST ===");
  await new Promise(r=>setTimeout(r,2000));

  console.log("\n1. Meta inbound...");
  let t = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/webhook/meta", {object:"whatsapp_business_account",entry:[{id:"t",changes:[{value:{messaging_product:"whatsapp",metadata:{display_phone_number:"5511999999999"},contacts:[{profile:{name:"TesteFinal"},wa_id:"5511999999999"}],messages:[{from:"5511999999999",id:"wamid.FINAL2_"+Date.now(),timestamp:String(Math.floor(Date.now()/1000)),text:{body:"Meta FINAL "+new Date().toLocaleTimeString()},type:"text"}]},field:"messages"}]}]});
  console.log(`   ${t.statusCode} ${t.body}`);

  console.log("\n2. Evolution inbound...");
  t = await sendPost("https://n8n-n8n.rh3fr2.easypanel.host/webhook/webhook/evolution", {event:"messages.upsert",instance:"EvoInst",data:{key:{remoteJid:"5511988888888@s.whatsapp.net",fromMe:false,id:"EVO_FINAL2_"+Date.now()},pushName:"TesteFinalEvo",message:{conversation:"Evo FINAL "+new Date().toLocaleTimeString()},messageTimestamp:Math.floor(Date.now()/1000)}});
  console.log(`   ${t.statusCode} ${t.body}`);

  console.log("\nWaiting 4s...");
  await new Promise(r=>setTimeout(r,4000));

  for (const wfId of ["88zOQbdJAT7DOaET","m5wmXXTYAqLiRM9c"]) {
    const res = await apiCall("GET",`/executions?workflowId=${wfId}&limit=1`);
    const ex = res.data?.data?.[0];
    if(ex) { 
      console.log(`\n${wfId}: exec ${ex.id} = ${ex.status}`);
      if(ex.status==='error'){ const d=await apiCall("GET",`/executions/${ex.id}?includeData=true`); const rd=d.data?.data?.resultData||{}; if(rd.error) console.log(`  ERR: ${rd.error.message}`); for(const[n,ne] of Object.entries(rd.runData||{})){for(const x of ne){if(x.error)console.log(`  Node "${n}": ${x.error.message}`);}} }
    }
  }

  const supaResp = await new Promise((resolve,reject) => {
    const ago = new Date(Date.now()-2*60000).toISOString();
    https.get(`${supabaseUrl}/rest/v1/messages?created_at=gte.${ago}&order=created_at.desc&limit=10&select=id,content,direction,channel_id`, {headers:{'apikey':serviceKey,'Authorization':`Bearer ${serviceKey}`}}, (res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve(JSON.parse(d||'[]')));}).on('error',reject);
  });
  console.log(`\nSupabase messages (last 2 min): ${supaResp.length}`);
  for(const msg of supaResp) console.log(`  - [${msg.direction}] ${msg.content} (ch:${msg.channel_id?.substring(0,8)})`);
}

fixAll();
