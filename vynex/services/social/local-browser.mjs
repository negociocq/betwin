import {spawn} from 'node:child_process';
import {access,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';

// Private CDP pipe and an isolated persistent profile; never read personal cookies.
export async function launchLocalSocialBrowser(profileDirectory){
 let executable;
 for(const file of ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe']){try{await access(file);executable=file;break;}catch{}}
 if(!executable)throw Error('Microsoft Edge não encontrado.');
 await mkdir(profileDirectory,{recursive:true});
 const child=spawn(executable,['--remote-debugging-pipe','--user-data-dir='+resolve(profileDirectory),'--no-first-run','--no-default-browser-check','--new-window','https://publish.buffer.com/'],{windowsHide:false,stdio:['ignore','ignore','ignore','pipe','pipe']});
 let sequence=0,buffer='',closed=false;const pending=new Map();
 function end(){closed=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Navegador de publicação fechado.'));}pending.clear();}
 child.once('error',end);child.once('exit',end);child.stdio[4].setEncoding('utf8');
 child.stdio[4].on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\0'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);let m;try{m=JSON.parse(line);}catch{continue;}const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error('Comando do navegador recusado.')):p.resolve(m.result);}}});
 child.stdio[3].on('error',end);child.stdio[4].on('error',end);
 function request(method,params={},sessionId){if(closed)return Promise.reject(Error('Abra o navegador de publicação.'));return new Promise((accept,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('O navegador não respondeu.'));},15000);pending.set(id,{resolve:accept,reject,timer});child.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});}
 await request('Browser.getVersion');
 return {request,get closed(){return closed;},async close(){if(!closed)await request('Browser.close');}};
}

export function createLocalSocialBrowser({profileDirectory=resolve('data/local-publishing/profile'),launch=launchLocalSocialBrowser,store}={}){
 let browser,opening,actionTail=Promise.resolve();
 async function target(){if(!browser||browser.closed)return null;const r=await browser.request('Target.getTargets');return r.targetInfos.find(t=>t.type==='page'&&/^https:\/\/([a-z]+\.)?buffer\.com\//.test(t.url));}
 async function evaluate(expression){const page=await target();if(!page)throw Error('Abra o navegador dedicado e entre no Buffer.');const {sessionId}=await browser.request('Target.attachToTarget',{targetId:page.targetId,flatten:true});try{const r=await browser.request('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error('A página não está pronta.');return r.result?.value;}finally{await browser.request('Target.detachFromTarget',{sessionId}).catch(()=>{});}}
 async function status(){if(!browser||browser.closed)return {state:opening?'opening':'closed',ready:false,message:'Abra o navegador de publicação e faça login no Buffer uma vez.'};const page=await target();if(!page)return {state:'page-required',ready:false,message:'Abra o Buffer no navegador dedicado.'};const evidence=await evaluate(`(()=>{const text=document.body?.innerText||'';return {login:!!document.querySelector('input[type=password]'),challenge:/verify you are human|security check|captcha/i.test(text),dashboard:!!document.querySelector('a[href^="/channels/"]')};})()`);return {state:evidence.challenge?'verification-required':evidence.login?'login-required':evidence.dashboard?'ready':'login-required',ready:!!evidence.dashboard&&!evidence.login&&!evidence.challenge,message:evidence.dashboard?'Sessão Buffer aberta. Envio local ainda requer validação do fluxo de upload.':'Conclua login/verificações diretamente na janela do Buffer.'};}
 async function start(){if(!browser||browser.closed){opening||=(async()=>{browser=await launch(profileDirectory);})().finally(()=>opening=null);await opening;}let page=await target();if(!page){await browser.request('Target.createTarget',{url:'https://publish.buffer.com/'});page=await target();}if(page)await browser.request('Target.activateTarget',{targetId:page.targetId});return status();}
 async function snapshot(){return evaluate(`(()=>({url:location.origin+location.pathname,text:(document.body?.innerText||'').slice(0,18000),dialogs:[...document.querySelectorAll('[role=dialog]')].map(e=>e.outerHTML.slice(0,26000)),controls:[...document.querySelectorAll('button,a,input,textarea,[role=button],[contenteditable=true]')].filter(e=>e.type==='file'||e.getBoundingClientRect().width>0).slice(0,180).map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||'').slice(0,120),type:e.type,href:e.getAttribute('href'),testid:e.getAttribute('data-testid'),role:e.getAttribute('role'),editable:e.getAttribute('contenteditable'),name:e.getAttribute('name'),accept:e.getAttribute('accept')}))}))()`);}
 async function action(input){
  if(input?.action==='workflow')return (await import('./buffer-ui-driver.mjs?revision='+Date.now())).bufferUiAction({input,browser,target,evaluate,store});
  if(!['navigate-channel','click','upload','caption'].includes(input?.action))throw Error('Ação local inválida.');
  if(input.action==='navigate-channel'){
   if(!/^[a-f0-9]{24}$/.test(input.channelId))throw Error('Canal inválido.');
   const known=await evaluate(`!!document.querySelector('a[href^="/channels/${input.channelId}/schedule"]')`);if(!known)throw Error('Canal não encontrado na sessão');
   const page=await target(),{sessionId}=await browser.request('Target.attachToTarget',{targetId:page.targetId,flatten:true});
   try{await browser.request('Page.navigate',{url:'https://publish.buffer.com/channels/'+input.channelId+'/schedule'},sessionId);return true;}finally{await browser.request('Target.detachFromTarget',{sessionId});}
  }
  if(input.action==='click'){
   const allowed=['Create Post','New Post','New post','Create new','Post','Next','Continue','Share','Schedule Post','Schedule','Add to Queue','Save Draft','Save as Draft','Close','Customize for each network','Select Date and Time','Set Date and Time'];
   if(!allowed.includes(input.label))throw Error('Controle não permitido.');
   if(['Post','Share','Schedule Post','Schedule','Add to Queue'].includes(input.label)&&input.confirm!==true)throw Error('Confirme a publicação.');
   const point=await evaluate(`(()=>{const name=${JSON.stringify(input.label)};const buttons=[...document.querySelectorAll('button,[role=button]')].filter(e=>e.getBoundingClientRect().width>0&&(e.innerText?.trim()===name||e.getAttribute('aria-label')===name));if(buttons.length!==1)throw Error('Controle ausente ou ambíguo');if(buttons[0].disabled)throw Error('Controle indisponível');buttons[0].scrollIntoView({block:'center'});const r=buttons[0].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
   const page=await target(),{sessionId}=await browser.request('Target.attachToTarget',{targetId:page.targetId,flatten:true});try{await browser.request('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},sessionId);await browser.request('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point},sessionId);return true;}finally{await browser.request('Target.detachFromTarget',{sessionId}).catch(()=>{});}
  }
  if(input.action==='caption'){
   if(typeof input.text!=='string'||input.text.length>4000)throw Error('Legenda inválida.');
   return evaluate(`(()=>{const fields=[...document.querySelectorAll('[contenteditable=true],[role=textbox]')].filter(e=>e.getBoundingClientRect().width>0);if(fields.length!==1)throw Error('Editor ausente ou ambíguo');fields[0].focus();document.execCommand('selectAll',false,null);document.execCommand('insertText',false,${JSON.stringify(input.text)});return fields[0].innerText;})()`);
  }
  if(!/^[a-f0-9-]{36}$/.test(input.jobId))throw Error('Vídeo inválido.');
  const job=store?.get(input.jobId,'explainer-job');if(!job?.approved||!job.validation||job.artifactsRemovedAt)throw Error('Selecione um MP4 aprovado e validado.');
  const file=resolve('storage/explainers',job.id,'video.mp4'),hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);if(hash.digest('hex')!==job.validation.sha256)throw Error('Arquivo alterado após validação.');
  const page=await target();if(!page)throw Error('Abra o Buffer.');const {sessionId}=await browser.request('Target.attachToTarget',{targetId:page.targetId,flatten:true});
  try{const {root}=await browser.request('DOM.getDocument',{},sessionId);const {nodeIds}=await browser.request('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'input[type=file]'},sessionId);if(!nodeIds?.length)throw Error('Abra o editor de publicação para enviar o arquivo.');await browser.request('DOM.setFileInputFiles',{nodeId:nodeIds[0],files:[file]},sessionId);return true;}finally{await browser.request('Target.detachFromTarget',{sessionId}).catch(()=>{});}
 }
 return {status,start,snapshot,action(input){const p=actionTail.then(()=>action(input));actionTail=p.catch(()=>{});return p;},async close(){await actionTail;if(opening)await opening;if(browser&&!browser.closed)await browser.close();}};
}
