const { spawn } = require('child_process');
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const port=5181;
  const s=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  await sleep(2500);
  const base=`http://localhost:${port}`;
  const p={id:'pj',name:'Gardefou',race:'Elfe',classLabel:'Clerc',skills:['discretion','escamotage']};
  async function send(m){const r=await fetch(`${base}/api/narration/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,conversationMode:'rp',characterProfile:p})}); return await r.json();}
  try{
    await send('/reset');
    const a=await send('je me dirige vers une rue marchande');
    console.log(JSON.stringify({intent:a.intent,director:a.director,phase12:a.phase12,worldState:a.worldState?.travel,debug:a.debug?.phase12,reply:a.reply?.slice(0,180)},null,2));
  }finally{s.kill('SIGTERM');}
})();
