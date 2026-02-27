const { spawn } = require('child_process');
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const port=5181; const s=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 await sleep(2500); const base=`http://localhost:${port}`; const p={id:'pj',name:'Gardefou',race:'Elfe',classLabel:'Clerc',skills:['discretion','escamotage']};
 async function send(m){const r=await fetch(`${base}/api/narration/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,conversationMode:'rp',characterProfile:p})}); return await r.json();}
 try{
  const seq=['/reset','je me dirige vers une rue marchande','je me dirige vers une rue marchande',"ok j'y vais"];
  for(const m of seq){const j=await send(m);const d=j.debug||{};console.log('MSG',m);console.log('intent',d.intent?.type,'sem',d.intent?.semanticIntent,'dir',d.director?.mode,'reason',d.worldDelta?.reason,'travelPending',d.worldState?.travel?.pending?.to?.label||d.worldState?.conversation?.pendingTravel?.placeLabel||'none');console.log('reply',String(j.reply||'').slice(0,140).replace(/\n/g,' '));console.log('---');}
 } finally {s.kill('SIGTERM');}
})();
