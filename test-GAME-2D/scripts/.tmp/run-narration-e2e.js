const { spawn } = require('child_process');

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function run(){
  const port = 5181;
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore','pipe','pipe']
  });

  let started = false;
  let logs = '';
  server.stdout.on('data', (d) => { logs += d.toString(); if (logs.includes('Serveur') || logs.includes('localhost')) started = true; });
  server.stderr.on('data', (d) => { logs += d.toString(); });

  await sleep(2500);

  const base = `http://localhost:${port}`;
  const profile = { id:'pj-gardefou', name:'Gardefou', race:'Elfe', classLabel:'Clerc', skills:['discretion','escamotage'] };

  const turns = [
    { message:'/reset', mode:'rp' },
    { message:'je me dirige vers une rue marchande', mode:'rp' },
    { message:"ok j'y vais", mode:'rp' },
    { message:'je cherche une boutique de vetement', mode:'rp' },
    { message:"je m'approche de la vendeuse et je la salue", mode:'rp' },
    { message:"je lui demande le prix d'une tenue", mode:'rp' },
    { message:"j'aimerais rentrer dans la boutique si possible", mode:'rp' },
    { message:'ok je rentre', mode:'rp' },
    { message:'quelle est ma classe et mes competences ?', mode:'hrp' }
  ];

  const out = [];
  try {
    for (const t of turns) {
      const res = await fetch(`${base}/api/narration/chat`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ message:t.message, conversationMode:t.mode, characterProfile:profile })
      });
      const json = await res.json();
      const dbg = (json && typeof json.debug === 'object') ? json.debug : json;
      const intent = dbg?.intent?.type ?? json?.intent?.type ?? 'n/a';
      const director = dbg?.director?.mode ?? json?.director?.mode ?? 'n/a';
      const applyRuntime = (dbg?.director?.applyRuntime ?? json?.director?.applyRuntime);
      const budget = json?.phase12?.aiCallBudget ?? dbg?.phase12?.aiCallBudget ?? null;
      let reply = String(json?.reply ?? '');
      if (reply.length > 220) reply = reply.slice(0,220) + '...';
      out.push({
        user: t.message,
        mode: t.mode,
        intent,
        director,
        applyRuntime: typeof applyRuntime === 'boolean' ? applyRuntime : null,
        reply,
        budget
      });
    }
  } finally {
    server.kill('SIGTERM');
    await sleep(300);
  }

  out.forEach((r, i) => {
    console.log(`TURN ${i+1} | mode=${r.mode} | intent=${r.intent} | director=${r.director} | runtime=${r.applyRuntime}`);
    console.log(`USER: ${r.user}`);
    console.log(`MJ: ${r.reply.replace(/\n/g, ' ')}`);
    if (r.budget) {
      console.log(`BUDGET: used=${r.budget.used}/${r.budget.max} primary=${r.budget.primaryUsed}/${r.budget.primaryMax} fallback=${r.budget.fallbackUsed}/${r.budget.fallbackMax} blocked=${r.budget.blocked}`);
    }
    console.log('---');
  });
}

run().catch((e)=>{ console.error(e); process.exit(1); });
