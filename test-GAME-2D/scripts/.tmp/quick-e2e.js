const { spawn } = require('child_process');
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const port=5181;
  const server=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  await sleep(2500);
  const base=`http://localhost:${port}`;
  const profile={id:'pj-gardefou',name:'Gardefou',race:'Elfe',classLabel:'Clerc',skills:['discretion','escamotage']};
  const turns=['/reset','je me dirige vers une rue marchande',"ok j'y vais",'je cherche une boutique de vetement'];
  try{
    for(const m of turns){
      const res=await fetch(`${base}/api/narration/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,conversationMode:'rp',characterProfile:profile})});
      const j=await res.json();
      const d=(j.debug&&typeof j.debug==='object')?j.debug:j;
      console.log('MSG:',m);
      console.log('intent=',d?.intent?.type ?? j?.intent?.type,'semantic=',d?.intent?.semanticIntent ?? j?.intent?.semanticIntent,'director=',d?.director?.mode ?? j?.director?.mode,'runtime=',d?.director?.applyRuntime ?? j?.director?.applyRuntime,'commit=',d?.intent?.commitment ?? j?.intent?.commitment);
      console.log('reply=',String(j.reply||'').slice(0,160).replace(/\n/g,' '));
      console.log('---');
    }
  }finally{server.kill('SIGTERM');}
})();
