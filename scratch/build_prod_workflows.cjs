const fs = require('fs');

const filesToCopy = [
  { src: 'scratch/evolution_current.json', dest: 'scratch/prod_evolution_inbound.json', name: 'Produção - Evolution Inbound' },
  { src: 'scratch/outbound_current.json', dest: 'scratch/prod_outbound_send.json', name: 'Produção - Outbound Send Message' },
  { src: 'scratch/central_agent_current.json', dest: 'scratch/prod_central_ai_agent.json', name: 'Produção - Central AI Agent' },
  { src: 'n8n-workflows/followup-dispatcher.json', dest: 'scratch/prod_followup_dispatcher.json', name: 'Produção - Followup Dispatcher' }
];

filesToCopy.forEach(f => {
  if (fs.existsSync(f.src)) {
    console.log(`Processing ${f.src} -> ${f.dest}...`);
    const data = JSON.parse(fs.readFileSync(f.src, 'utf8'));
    
    // Update name to mark it as Production
    data.name = f.name;
    
    // We can also nullify or mark credentials for clean import if necessary,
    // but n8n handles missing credentials by prompting the user to select one on import.
    
    fs.writeFileSync(f.dest, JSON.stringify(data, null, 2));
    console.log(`Saved ${f.dest}`);
  } else {
    console.warn(`Source file not found: ${f.src}`);
  }
});
