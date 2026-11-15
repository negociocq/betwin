// Owns only the Vynex child it starts. Never terminates unrelated applications.
import {fork,execFile} from 'node:child_process';import {createServer} from 'node:net';
import {mkdir,appendFile,writeFile} from 'node:fs/promises';import {createWriteStream} from 'node:fs';
import {fileURLToPath} from 'node:url';import {dirname,resolve} from 'node:path';import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),runtime=resolve(root,'data/runtime');await mkdir(runtime,{recursive:true});
try{process.loadEnvFile(resolve(root,'.env'))}catch(e){if(e.code!=='ENOENT')throw e}
let child=null,starting=false,stopping=false,failures=0,timer;
const record=()=>writeFile(resolve(runtime,'supervisor-status.json'),JSON.stringify({pid:process.pid,serverPid:child?.pid||null,failures,stopping,at:new Date().toISOString()},null,2));
const log=message=>appendFile(resolve(runtime,'supervisor.log'),new Date().toISOString()+' '+message+'\n');
const pipe=process.platform==='win32'?'\\\\.\\pipe\\vynex-'+createHash('sha256').update(root).digest('hex').slice(0,16):resolve(runtime,'supervisor.sock');
const singleton=createServer(socket=>socket.end(JSON.stringify({pid:process.pid,serverPid:child?.pid||null})));
singleton.on('error',async e=>{await log('Supervisor not started: '+e.code);process.exit(e.code==='EADDRINUSE'?0:1)});
await new Promise(r=>singleton.listen(pipe,r));
async function alive(){try{const r=await fetch('http://127.0.0.1:'+(process.env.API_PORT||8100)+'/api/liveness',{signal:AbortSignal.timeout(5000)});return r.ok&&(await r.json()).ok===true}catch{return false}}
async function start(){
 if(stopping||starting||child)return;starting=true;
 try{
  if(await alive()){failures=0;return;}
  if(stopping)return;
  child=fork(resolve(root,'scripts/start.mjs'),[],{cwd:root,execArgv:['--env-file-if-exists='+resolve(root,'.env')],windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
  const owned=child,out=createWriteStream(resolve(runtime,'server.log'),{flags:'a'});owned.stdout.pipe(out,{end:false});owned.stderr.pipe(out,{end:false});
  await log('Started Vynex PID '+owned.pid);await record();
  owned.on('exit',async(code,signal)=>{out.end();if(child===owned)child=null;failures=0;await log('Vynex exited: '+code+' '+signal);await record();if(!stopping)setTimeout(()=>start().catch(e=>log(e.message)),10000)});
  owned.on('error',e=>log('Vynex process error: '+e.message));
 }finally{starting=false;}
}
async function stopChild(){
 const owned=child;if(!owned||owned.exitCode!==null)return;
 try{owned.send('shutdown')}catch{}
 await Promise.race([new Promise(r=>owned.once('exit',r)),new Promise(r=>setTimeout(r,30000))]);
 if(owned.exitCode===null){if(process.platform==='win32')await new Promise(r=>execFile('taskkill.exe',['/PID',String(owned.pid),'/T','/F'],{windowsHide:true},r));else owned.kill('SIGTERM');}
}
async function stop(){if(stopping)return;stopping=true;clearInterval(timer);await stopChild();await record();singleton.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
await start();
timer=setInterval(async()=>{
 if(stopping||starting)return;
 if(await alive()){failures=0;await record();return;}
 failures++;await record();if(child&&failures>=3){await log('Liveness failed three times; restarting owned Vynex child');await stopChild();}
 if(!child)await start();
},30000);
