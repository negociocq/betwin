import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DeliveryError} from '../explainer/publisher.mjs';
export function assertComposerTarget(rows,channelId,platform){
 if(rows.length!==1||rows[0].channelId!==channelId||rows[0].platform!==platform)throw Error('O editor está em outra rede ou conta. Nenhum envio permitido.');
 return true;
}
export function assertDubbedReplacement(job,platform,proof){
 const d=job?.deliveries?.[platform];
 if(!job?.approved||job.language!=='pt-BR'||job.validation?.dubbingVerified!==true||!d?.bufferPostId||d.status!=='scheduled')throw Error('Somente uma dublagem validada pode substituir este post.');
 if(proof.path!=='/channels/'+d.channelId+'/schedule'||proof.at!==Date.parse(d.dueAt)||!proof.caption?.includes(job.title)||!proof.video||!proof.ai)throw Error('Vídeo, conta, legenda, idioma ou horário não conferem.');
 return true;
}
export function parseBufferPostMetrics(text){
 const lines=text.split(/\n/).map(x=>x.trim()).filter(Boolean);
 const count=labels=>{for(const label of labels){const i=lines.indexOf(label),v=lines[i+1];if(i>=0&&/^\d+(?:[.,]\d{3})*$/.test(v||''))return v.replace(/[.,]/g,'');}return null;};
 const decimal=label=>{const i=lines.indexOf(label),v=lines[i+1];if(i<0||!/^\d+(?:[.,]\d+)?$/.test(v||''))return null;const n=Number(v.replace(',','.'));return Number.isFinite(n)?n:null;};
 const metrics={views:count(['Views','Video Views']),likes:count(['Reactions','Likes']),comments:count(['Comments']),shares:count(['Shares']),saves:count(['Saves']),reach:count(['Reach']),averageWatchSeconds:decimal('Avg. Watch Time (sec)')};
 return Object.values(metrics).some(v=>v!==null)?{...metrics,source:'Buffer',likesLabel:'Curtidas / reações',updatedAt:new Date().toISOString(),sourceRefresh:text.match(/Refreshed [^\n]+/)?.[0]||null}:null;
}
export async function bufferUiAction({input,browser,target,evaluate,store}){
 if(['open-insights','audit-channel','audit-channel-preserve-editor'].includes(input.step)&&Date.parse(store.get('local-publishing-manual-lease','integrations')?.until)>Date.now())throw Error('Consulta de métricas adiada durante a atualização dos vídeos.');
 if(input.step==='configure-youtube-short'){
  const job=store.get(input.jobId,'explainer-job');if(!job?.approved||typeof job.madeForKids!=='boolean')throw Error('Público do vídeo não declarado.');
  await evaluate(`(()=>{const e=document.querySelector('input[name=youtubepostType][value=short]');if(!e)throw Error('Formato Shorts indisponível');if(!e.checked)e.click();return true;})()`);
  await evaluate(`(()=>{const e=document.querySelector('input[aria-label="Video title"]');if(!e)throw Error('Título indisponível');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(job.title.slice(0,100))});e.dispatchEvent(new Event('input',{bubbles:true}));const label=[...document.querySelectorAll('label')].find(e=>e.innerText.trim()==='Made for Kids');const box=label&&document.getElementById(label.htmlFor);if(!box)throw Error('Público indisponível');if((box.getAttribute('aria-checked')==='true')!==${job.madeForKids})box.click();return true;})()`);
  return evaluate(`(()=>({title:document.querySelector('input[aria-label="Video title"]').value,visibility:[...document.querySelectorAll('button[role=combobox]')].some(e=>e.innerText.trim()==='Public'),kids:[...document.querySelectorAll('label')].filter(e=>e.innerText.trim()==='Made for Kids').map(e=>document.getElementById(e.htmlFor)?.getAttribute('aria-checked'))}))()`);
 }
 if(input.step==='inspect-youtube-options')return evaluate(`(()=>({inputs:[...document.querySelectorAll('[role=dialog] input')].map(e=>e.outerHTML),buttons:[...document.querySelectorAll('[role=dialog] button')].filter(e=>/Public|Autos|Kids|AI-Generated|Visibility|Category/.test(e.innerText+' '+e.getAttribute('aria-label'))||e.getAttribute('role')==='switch'||e.getAttribute('role')==='combobox').map(e=>e.outerHTML)}))()`);
 if(input.step==='youtube-studio-access'){
  const j=store.get(input.jobId,'explainer-job'),remote=j?.deliveries?.youtube?.remoteId;if(!remote?.startsWith('youtube-direct:'))throw Error('Vídeo não encontrado.');
  const {targetId}=await browser.request('Target.createTarget',{url:'https://studio.youtube.com/video/'+encodeURIComponent(remote.slice(15))+'/edit'});
  await new Promise(r=>setTimeout(r,4000));const {sessionId}=await browser.request('Target.attachToTarget',{targetId,flatten:true});
  try{const r=await browser.request('Runtime.evaluate',{expression:"JSON.stringify({url:location.origin+location.pathname,signIn:document.body.innerText.includes('Sign in')||document.body.innerText.includes('Fazer login'),text:document.body.innerText.slice(0,1200)})",returnByValue:true},sessionId);return JSON.parse(r.result.value);}finally{await browser.request('Target.detachFromTarget',{sessionId});}
 }
 if(input.step==='recover-buffer-tab'&&!await target())return browser.request('Target.createTarget',{url:'https://publish.buffer.com/'});
 const page=await target();if(!page)throw Error('Abra a sessão Buffer.');
 if(input.step==='release-browser-for-restart'){
  if(await evaluate(`document.body.innerText.includes('Post Composer')`))throw Error('Há um editor aberto; o navegador foi preservado.');
  if(store.list('explainer-job').some(j=>Object.values(j.deliveries||{}).some(d=>['submitting','sending'].includes(d.status))))throw Error('Há um envio em andamento; aguarde a confirmação.');
  await browser.close();return {closed:true};
 }
 if(input.step==='browser-diagnostics'){
  const targets=await browser.request('Target.getTargets');
  return {window:await browser.request('Browser.getWindowForTarget',{targetId:page.targetId}),targets:targets.targetInfos.filter(t=>t.type==='page'&&/buffer\.com/.test(t.url)).map(t=>({id:t.targetId,url:t.url,title:t.title})),page:await evaluate(`(()=>({ready:document.readyState,visible:document.visibilityState,button:document.querySelector('[data-testid=queue-header-create-post]')?.outerHTML,text:document.body.innerText.slice(-800)}))()`)};
 }
 async function session(task){const {sessionId}=await browser.request('Target.attachToTarget',{targetId:page.targetId,flatten:true});try{return await task(sessionId);}finally{await browser.request('Target.detachFromTarget',{sessionId}).catch(()=>{});}}
 if(input.step==='open-channel-page'){
  const lease=store.get('local-publishing-manual-lease','integrations');
  if(Date.parse(lease?.until)>Date.now()&&input.jobId!==lease.jobId)throw Error('Publicação manual em andamento; consulta de outro post adiada.');
  if(!/^[a-f0-9]{24}$/.test(input.channelId))throw Error('Canal inválido.');
  await session(id=>browser.request('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},id));
  return session(id=>browser.request('Page.navigate',{url:'https://publish.buffer.com/channels/'+input.channelId+'/schedule'},id));
 }
 if(input.step==='close-empty-composer')return evaluate(`(()=>{const editor=document.querySelector('[data-testid=composer-text-area]');if((editor?.innerText||'').replace(/[\\s\\uFEFF\\u200B]/g,'')||[...document.querySelectorAll('input[type=file]')].some(e=>e.files?.length))throw Error('Editor contém conteúdo; não foi fechado.');const b=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')==='Close Composer'||e.innerText.trim()==='Close Composer');if(!b)throw Error('Editor não encontrado');b.click();return true;})()`);
 if(input.step==='prepare-interaction')return session(async id=>{const w=await browser.request('Browser.getWindowForTarget',{targetId:page.targetId});await browser.request('Browser.setWindowBounds',{windowId:w.windowId,bounds:{windowState:'normal'}});await browser.request('Page.setWebLifecycleState',{state:'active'},id);await browser.request('Page.bringToFront',{},id);await browser.request('Emulation.setFocusEmulationEnabled',{enabled:true},id);return true;});
 if(input.step==='upload-diagnostics')return evaluate(`(()=>({visible:document.visibilityState,online:navigator.onLine,files:[...document.querySelectorAll('input[type=file]')].flatMap(e=>[...e.files].map(f=>({name:f.name,bytes:f.size,type:f.type}))),progress:[...document.querySelectorAll('[role=progressbar],progress')].map(e=>({text:e.innerText,value:e.getAttribute('aria-valuenow')||e.value})),requests:performance.getEntriesByType('resource').filter(e=>['fetch','xmlhttprequest'].includes(e.initiatorType)).slice(-16).map(e=>({url:new URL(e.name).origin+new URL(e.name).pathname,status:e.responseStatus,duration:Math.round(e.duration),bytes:e.transferSize})),alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText)}))()`);
 if(input.step==='inspect-submit-state')return evaluate(`(()=>({buttons:[...document.querySelectorAll('button')].filter(e=>e.innerText.trim()==='Schedule Post').map(e=>({html:e.outerHTML,form:e.form?.id,valid:e.form?.checkValidity()})),invalid:[...document.querySelectorAll(':invalid')].map(e=>({tag:e.tagName,name:e.name,type:e.type,message:e.validationMessage})),alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText),visible:document.visibilityState}))()`);
 if(input.step==='audit-channel'){
  if(!/^[a-f0-9]{24}$/.test(input.channelId))throw Error('Canal inválido.');
  if(await evaluate(`document.body.innerText.includes('Post Composer')`))throw Error('Há um editor aberto; auditoria não mudou a página.');
  const result={channelId:input.channelId};
  for(const tab of ['queue','sent']){
   await session(id=>browser.request('Page.navigate',{url:'https://publish.buffer.com/channels/'+input.channelId+'/schedule'+(tab==='sent'?'?tab=sent':'')},id));
   const until=Date.now()+20000;let ready=false;
   while(Date.now()<until){try{if(await evaluate(`!!document.querySelector('[data-testid=queue-header-create-post]')`)){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,400));}
   if(!ready)throw Error('Canal não carregou para auditoria.');
   await new Promise(r=>setTimeout(r,1500));
   const loadedUntil=Date.now()+20000;
   while(Date.now()<loadedUntil){if(await evaluate(`!document.body.innerText.includes('Loading posts')`))break;await new Promise(r=>setTimeout(r,500));}
   result[tab]=await evaluate(`(()=>({url:location.href,text:document.body.innerText.slice(0,1600),cards:[...document.querySelectorAll('article[data-post-id]')].map(e=>({id:e.getAttribute('data-post-id'),label:e.getAttribute('aria-label'),text:e.innerText,links:[...e.querySelectorAll('a[href]')].map(a=>a.href)}))}))()`);
  }
  return result;
 }
 if(input.step==='audit-channel-preserve-editor'){
  if(!/^[a-f0-9]{24}$/.test(input.channelId))throw Error('Canal inválido.');
  const {targetId}=await browser.request('Target.createTarget',{url:'https://publish.buffer.com/channels/'+input.channelId+'/schedule',background:true});
  const {sessionId}=await browser.request('Target.attachToTarget',{targetId,flatten:true});
  const read=async expression=>{const r=await browser.request('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error('Aba de conferência ainda não está pronta.');return r.result.value;};
  try{
   const result={channelId:input.channelId};
   for(const tab of ['queue','sent']){
    if(tab==='sent')await browser.request('Page.navigate',{url:'https://publish.buffer.com/channels/'+input.channelId+'/schedule?tab=sent'},sessionId);
    const deadline=Date.now()+30000;let ready=false;
    while(Date.now()<deadline){try{if(await read(`!!document.querySelector('[data-testid=queue-header-create-post]')&&!document.body.innerText.includes('Loading posts')`)){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
    if(!ready)throw Error('Canal não carregou na aba de conferência.');
    await new Promise(r=>setTimeout(r,2000));
    result[tab]=await read(`(()=>({cards:[...document.querySelectorAll('article[data-post-id]')].map(e=>({id:e.getAttribute('data-post-id'),label:e.getAttribute('aria-label'),text:e.innerText,links:[...e.querySelectorAll('a[href]')].map(a=>a.href)}))}))()`);
   }
   return result;
  }finally{await browser.request('Target.detachFromTarget',{sessionId}).catch(()=>{});await browser.request('Target.closeTarget',{targetId}).catch(()=>{});}
 }
 async function click(selector){const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Controle não disponível');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);return session(async id=>{for(const type of ['mousePressed','mouseReleased'])await browser.request('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point},id);return true;});}
 if(input.step==='upload-verified-memory'){
  const job=store.get(input.jobId,'explainer-job');if(!job?.approved||!job.validation||job.artifactsRemovedAt||!/^[-a-f0-9]{36}$/.test(input.jobId))throw Error('Vídeo aprovado indisponível.');
  const bytes=await readFile(resolve('storage/explainers',job.id,'video.mp4'));if(createHash('sha256').update(bytes).digest('hex')!==job.validation.sha256)throw Error('Arquivo alterado.');
  const cancel=await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.innerText.trim()==='Cancel upload'||e.getAttribute('aria-label')==='Cancel upload');if(!b)return false;b.setAttribute('data-vynex-cancel-upload','true');return true;})()`);if(cancel)await click('[data-vynex-cancel-upload]');
  await evaluate('window.__vynexUploadChunks=[]');
  try{
   for(let i=0;i<bytes.length;i+=262144){const chunk=bytes.subarray(i,i+262144).toString('base64');await evaluate(`window.__vynexUploadChunks.push(Uint8Array.from(atob(${JSON.stringify(chunk)}),c=>c.charCodeAt(0)))`);}
   return await evaluate(`(()=>{const f=new File(window.__vynexUploadChunks,'ventilador.mp4',{type:'video/mp4'}),d=new DataTransfer();d.items.add(f);const e=document.querySelector('input[type=file]');if(!e)throw Error('Abra o editor');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));return {bytes:f.size};})()`);
  }finally{await evaluate('delete window.__vynexUploadChunks');}
 }
 if(input.step==='inspect')return evaluate(`(()=>({text:document.body.innerText,inputs:[...document.querySelectorAll('input,textarea,button[role=switch],[role=menuitem],[role=option],[role=checkbox]')].filter(e=>e.type!=='password'&&(e.type==='file'||e.getBoundingClientRect().width>0)).map(e=>({tag:e.tagName,type:e.type,name:e.name,value:e.type==='password'?null:e.value,text:(e.innerText||e.getAttribute('aria-label')||'').slice(0,160),html:e.outerHTML.slice(0,1500)})),editor:document.querySelector('[data-testid=composer-text-area]')?.outerHTML,links:[...document.querySelectorAll('main a[href]')].map(e=>({text:e.innerText,href:e.getAttribute('href')}))}))()`);
 if(input.step==='open-insights'){
  if(!/^[a-f0-9]{24}$/.test(input.channelId))throw Error('Canal inválido.');
  await session(id=>browser.request('Page.navigate',{url:'https://publish.buffer.com/insights/'+input.channelId},id));
  const until=Date.now()+20000;
  while(Date.now()<until){
   try{if(await evaluate(`location.pathname==='/insights/${input.channelId}'&&/Total Followers\\s+About Total Followers\\s+\\d/.test(document.body.innerText)`))return true;}catch{}
   await new Promise(r=>setTimeout(r,500));
  }
  throw Error('O Buffer não disponibilizou o total de seguidores nesta conta.');
 }
 if(input.step==='schedule-menu')return evaluate(`(()=>{document.querySelector('[data-testid=schedule-selector-trigger]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}));return true;})()`);
 if(input.step==='refresh-channel')return session(async id=>{await browser.request('Page.reload',{ignoreCache:true},id);return true;});
 if(input.step==='schedule-inspect')return evaluate(`(async()=>{const b=document.querySelector('[data-testid=schedule-selector-trigger]');b.click();await new Promise(r=>setTimeout(r,300));return {expanded:b.outerHTML,text:document.body.innerText.slice(-5000),popups:[...document.querySelectorAll('[role=menu],[role=dialog],[data-radix-popper-content-wrapper]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.outerHTML.slice(-18000))};})()`);
 if(input.step==='ai-label'){
  const expected=store.get(input.jobId,'explainer-job')?.isAiGenerated!==false;
  return evaluate(`(()=>{const switches=[...document.querySelectorAll('button[role=switch]')].filter(e=>{const id=e.getAttribute('aria-labelledby');return id&&document.getElementById(id)?.innerText.includes('AI-Generated');});if(switches.length!==1)throw Error('Rótulo IA ausente ou ambíguo');if((switches[0].getAttribute('aria-checked')==='true')!==${expected})switches[0].click();return true;})()`);
 }
 if(input.step==='choose-date')return evaluate(`(()=>{const e=[...document.querySelectorAll('[role=menuitem]')].find(e=>e.innerText.startsWith('Set Date and Time'));if(!e)throw Error('Abra o menu de agendamento');e.click();return true;})()`);
 if(input.step==='set-time'){
  const when=new Date(input.dueAt);if(!Number.isFinite(+when)||+when<Date.now()+60000)throw Error('Agendamento precisa ser futuro.');
  const time=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'numeric',minute:'2-digit',hour12:true}).format(when);
  await evaluate(`(()=>{const e=document.querySelector('input[id^=schedule-time-input-]');if(!e)throw Error('Abra o calendário');e.focus();e.select();return true;})()`);await session(async id=>{await browser.request('Input.insertText',{text:time},id);await browser.request('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},id);await browser.request('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},id);});return {time};
 }
 if(input.step==='done-date')return evaluate(`(()=>{const e=[...document.querySelectorAll('button')].filter(e=>e.innerText.trim()==='Done'&&e.getBoundingClientRect().width>0);if(e.length!==1)throw Error('Calendário indisponível');e[0].click();return true;})()`);
 if(input.step==='commit-time'){await evaluate(`(()=>{document.querySelector('input[id^=schedule-time-input-]').focus();return true;})()`);return session(async id=>{await browser.request('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},id);await browser.request('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},id);return true;});}
 if(input.step==='pick-time'){
  if(!/^\d{1,2}:\d{2} [AP]M$/.test(input.time))throw Error('Horário inválido.');
  return evaluate(`(()=>{const time=${JSON.stringify(input.time)},e=[...document.querySelectorAll('[role=option]')].find(e=>e.innerText.trim()===time);if(e){e.click();return true;}const field=document.querySelector('input[id^=schedule-time-input-]');if(field?.value===time)return true;throw Error('Horário não disponível na lista');})()`);
 }
 if(input.step==='select-day'){
  const when=new Date(input.dueAt);if(!Number.isFinite(+when))throw Error('Data inválida.');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',month:'2-digit',day:'2-digit',year:'numeric'}).format(when);
  return evaluate(`(async()=>{for(let n=0;n<12;n++){const e=document.querySelector('[data-day="'+${JSON.stringify(date)}+'"] button');if(e){if(e.disabled)throw Error('Data bloqueada');e.click();return true;}const next=document.querySelector('button[aria-label*="next month" i],button[name=next-month]');if(!next||next.disabled)break;next.click();await new Promise(r=>setTimeout(r,150));}throw Error('Data não encontrada no calendário');})()`);
 }
 if(input.step==='read-receipt'){
  if(!/^[a-f0-9]{24}$/.test(input.postId)||!['instagram','tiktok','youtube'].includes(input.platform))throw Error('Recibo inválido.');
  const queued=await evaluate(`(()=>{const e=document.querySelector('article[data-post-id="${input.postId}"]');return e?{label:e.getAttribute('aria-label'),text:e.innerText}:null;})()`);
  if(queued&&/failed|error|not published/i.test(queued.label+' '+queued.text))return {status:'error'};
  const activeDelivery=store.list('explainer-job').flatMap(j=>Object.entries(j.deliveries||{}).map(([platform,d])=>({platform,d}))).find(x=>x.platform===input.platform&&x.d.bufferPostId===input.postId);
  if(queued&&/^Post scheduled/.test(queued.label||'')&&activeDelivery?.d.status!=='sending')return {status:'scheduled'};
  const channelPath=await evaluate(`location.pathname.startsWith('/channels/')&&location.pathname.endsWith('/schedule')?location.pathname:null`);
  if(!channelPath)throw Error('Abra o canal correto para consultar enviados.');
  await session(id=>browser.request('Page.navigate',{url:'https://publish.buffer.com'+channelPath+'?tab=sent'},id));
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){try{if(await evaluate(`!!document.querySelector('article[data-post-id="${input.postId}"]')`))break;}catch{}await new Promise(r=>setTimeout(r,500));}
  const sent=await evaluate(`(()=>{const e=document.querySelector('article[data-post-id="${input.postId}"]');return e?{label:e.getAttribute('aria-label'),text:e.innerText,links:[...e.querySelectorAll('a[href]')].map(a=>a.href)}:null;})()`);
  if(!sent)throw Error('Post não confirmado na fila ou enviados. Confira o Buffer.');
  if(/Sending\.\.\.|post is being processed|will go live soon/i.test(sent.text))return {status:'sending'};
  const link=sent.links.find(h=>{try{const u=new URL(h);if(input.platform==='youtube')return u.protocol==='https:'&&['youtube.com','www.youtube.com'].includes(u.hostname)&&(/^\/shorts\/[\w-]+$/.test(u.pathname)||u.pathname==='/watch'&&/^[\w-]+$/.test(u.searchParams.get('v')||''));return u.protocol==='https:'&&(input.platform==='instagram'?['instagram.com','www.instagram.com'].includes(u.hostname):['tiktok.com','www.tiktok.com'].includes(u.hostname))&&/\/(p|reel|@[^/]+\/video)\//.test(u.pathname);}catch{return false;}});
  if(link&&/sent|published/i.test(sent.label||'')){
   const metrics=parseBufferPostMetrics(sent.text);
   return {status:'sent',externalLink:link,metrics,metricsStatus:metrics?'available':'pending_provider',metricsCheckedAt:new Date().toISOString(),metricsSourceRefresh:sent.text.match(/Refreshed [^\n]+/)?.[0]||null};
  }
  if(/failed|error|not published/i.test(sent.label+' '+sent.text))return {status:'error'};
  throw Error('Falta confirmação pública do vídeo.');
 }
 if(input.step==='finalize'){
  if(!['instagram','tiktok','youtube'].includes(input.platform)||!/^[a-f0-9]{24}$/.test(input.channelId)||!/^[a-f0-9-]{36}$/.test(input.jobId))throw Error('Destino inválido.');
  const job=store.get(input.jobId,'explainer-job'),existing=job?.deliveries?.[input.platform];if(!job?.approved||!job.validation||job.artifactsRemovedAt)throw Error('Vídeo não aprovado.');
  if(existing?.remoteId||existing?.status==='uncertain'||existing?.status==='submitting'&&existing?.provider==='buffer-browser')throw Error('Envio anterior exige conferência; não repetir.');
  const expected=Date.parse(input.dueAt);if(!Number.isFinite(expected)||expected<Date.now()+60000)throw Error('Agendamento inválido.');
  const check=await evaluate(`(()=>({path:location.pathname,scheduledAt:Number(document.querySelector('[data-testid=schedule-selector-trigger]')?.getAttribute('data-scheduled-at'))*1000,selected:[...document.querySelectorAll('button')].filter(e=>e.innerText?.trim().startsWith('Deselect ')).length,caption:document.querySelector('[data-testid=composer-text-area]')?.innerText,video:document.body.innerText.includes('Remove video'),ai:[...document.querySelectorAll('button[role=switch]')].some(e=>document.getElementById(e.getAttribute('aria-labelledby'))?.innerText.includes('AI-Generated')&&e.getAttribute('aria-checked')==='true')}))()`);
  if(check.path!=='/channels/'+input.channelId+'/schedule'||check.selected!==1||check.scheduledAt!==expected||!check.video||!check.caption?.includes(job.title)||check.ai!==(job.isAiGenerated!==false))throw new DeliveryError('Canal, legenda, arquivo, rótulo IA ou horário não conferem. Nenhum envio executado.',false);
  const identity=await evaluate(`(()=>{const rows=[...document.querySelectorAll('[data-channel-row] [data-channel-id]')];return rows.length===1&&rows[0].getAttribute('data-channel-id')===${JSON.stringify(input.channelId)}&&!!rows[0].querySelector('[data-channel="'+${JSON.stringify(input.platform)}+'"]');})()`);
  if(!identity)throw new DeliveryError('O editor esta em outra rede ou conta. Nenhum envio permitido.',false);
  if(input.platform==='youtube'){
   const valid=await evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.innerText.trim()==='Made for Kids');return document.querySelector('input[aria-label="Video title"]')?.value===${JSON.stringify(job.title.slice(0,100))}&&document.querySelector('input[name=youtubepostType]:checked')?.value==='short'&&[...document.querySelectorAll('button[role=combobox]')].some(e=>e.innerText.trim()==='Public')&&!!l&&(document.getElementById(l.htmlFor)?.getAttribute('aria-checked')==='true')===${job.madeForKids};})()`);
   if(!valid)throw new DeliveryError('Título, visibilidade ou público do YouTube não conferem.',false);
  }
  const receipt={...existing,status:'submitting',provider:'buffer-browser',channelId:input.channelId,plannedAt:input.dueAt,dueAt:input.dueAt,...(existing?.schedule?{schedule:{...existing.schedule,localDay:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(input.dueAt)),dueAt:input.dueAt,uiResolutionMinutes:15}}:{}),attemptedAt:new Date().toISOString(),caption:check.caption,message:'Enviando arquivo local pelo navegador Buffer'};
  store.put('explainer-job',{...job,deliveries:{...job.deliveries,[input.platform]:receipt}});
  try{await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(e=>e.innerText?.trim()==='Schedule Post'&&e.getBoundingClientRect().width>0);if(b.length!==1||b[0].disabled)throw Error('Agendamento indisponível');b[0].click();return true;})()`);return {submitted:true,message:'Aguardando recibo visível na fila. Não repetir o envio.'};}
  catch(e){const fresh=store.get(job.id,'explainer-job');store.put('explainer-job',{...fresh,deliveries:{...fresh.deliveries,[input.platform]:{...receipt,status:'uncertain',message:e.message}}});throw e;}
 }
 if(input.step==='inspect-confirmation')return evaluate(`(()=>({scheduledAt:document.querySelector('[data-testid=schedule-selector-trigger]')?.getAttribute('data-scheduled-at'),url:location.origin+location.pathname,buttons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width>0&&(/Deselect|Schedule Post|Done|Send Now/.test(e.innerText+' '+e.getAttribute('aria-label'))||e.hasAttribute('data-day'))).map(e=>e.outerHTML.slice(0,1700)),video:document.querySelector('video')?.getAttribute('src'),editor:document.querySelector('[data-testid=composer-text-area]')?.innerText}))()`);
 if(input.step==='queue-proof')return evaluate(`(()=>({items:[...document.querySelectorAll('[data-testid]')].filter(e=>/post|update|card/.test(e.getAttribute('data-testid'))).map(e=>({id:e.getAttribute('data-testid'),html:e.outerHTML.slice(0,1200)})),articles:[...document.querySelectorAll('article')].map(e=>e.outerHTML.slice(0,3000)),links:[...document.querySelectorAll('a[href]')].filter(e=>/post|update/.test(e.getAttribute('href'))).map(e=>({text:e.innerText,href:e.getAttribute('href')}))}))()`);
 if(input.step==='calendar-probe')return evaluate(`(()=>({text:document.body.innerText.slice(-2000),buttons:[...document.querySelectorAll('button')].filter(e=>/^[0-9]{1,2}$/.test(e.innerText?.trim())).slice(0,5).map(e=>e.outerHTML),selected:[...document.querySelectorAll('[aria-selected=true]')].map(e=>e.outerHTML.slice(0,1300))}))()`);
 if(input.step==='composer-identity')return evaluate(`(()=>{const selected=[...document.querySelectorAll('button')].filter(e=>e.innerText?.trim().startsWith('Deselect '));return {selected:selected.map(e=>({parent:e.parentElement.outerHTML.slice(0,5500),grandparent:e.parentElement.parentElement.outerHTML.slice(0,7000)}))};})()`);
 if(input.step==='edit-scheduled-post'){
  await session(id=>browser.request('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},id));await new Promise(r=>setTimeout(r,300));
  const j=store.get(input.jobId,'explainer-job'),d=j?.deliveries?.[input.platform];
  if(!d?.bufferPostId||d.status!=='scheduled')throw Error('Agendamento existente não encontrado.');
  const selector=`article[data-post-id="${d.bufferPostId}"]`;
  const found=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||!e.innerText.includes(${JSON.stringify(j.title)}))return false;const b=[...e.querySelectorAll('button')].find(b=>b.innerText.trim()==='Edit post'||b.getAttribute('aria-label')==='Edit post');if(!b)return false;b.setAttribute('data-vynex-edit-existing','true');return true;})()`);
  if(!found)throw Error('Post correto não encontrado para editar.');store.put('integrations',{id:'buffer-edit-owner',jobId:j.id,platform:input.platform,postId:d.bufferPostId,channelId:d.channelId});return evaluate(`(()=>{document.querySelector('[data-vynex-edit-existing]').click();return true;})()`);
 }
 if(input.step==='remove-current-video'){
  const owner=store.get('buffer-edit-owner','integrations'),j=store.get(input.jobId,'explainer-job'),d=j?.deliveries?.[input.platform];
  if(owner?.jobId!==j?.id||owner?.platform!==input.platform||owner?.postId!==d?.bufferPostId||j?.validation?.dubbingVerified!==true)throw Error('Editor não corresponde ao vídeo dublado.');
  return evaluate(`(()=>{if(location.pathname!=='/channels/${d.channelId}/schedule')throw Error('Canal incorreto');const b=[...document.querySelectorAll('button')].filter(e=>(e.getAttribute('aria-label')==='Remove video'||e.innerText.trim()==='Remove video')&&e.getBoundingClientRect().width>0);if(b.length!==1)throw Error('Vídeo ausente ou ambíguo');b[0].click();return true;})()`);
 }
 if(input.step==='save-replaced-media'){
  const j=store.get(input.jobId,'explainer-job'),d=j?.deliveries?.[input.platform],owner=store.get('buffer-edit-owner','integrations');
  if(owner?.jobId!==j?.id||owner?.platform!==input.platform||owner?.postId!==d?.bufferPostId)throw Error('Editor não corresponde ao post existente.');
  const proof=await evaluate(`(()=>({path:location.pathname,at:Number(document.querySelector('[data-testid=schedule-selector-trigger]')?.getAttribute('data-scheduled-at'))*1000,caption:document.querySelector('[data-testid=composer-text-area]')?.innerText,video:document.body.innerText.includes('Remove video')&&!document.body.innerText.includes('Cancel upload'),ai:[...document.querySelectorAll('button[role=switch]')].some(e=>document.getElementById(e.getAttribute('aria-labelledby'))?.innerText.includes('AI-Generated')&&e.getAttribute('aria-checked')==='true')}))()`);
  assertDubbedReplacement(j,input.platform,proof);
  const ready=await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(e=>e.innerText.trim()==='Save'&&e.getBoundingClientRect().width>0);return b.length===1&&!b[0].disabled;})()`);if(!ready)throw Error('Aguarde o processamento do vídeo antes de salvar.');
  store.put('explainer-job',{...j,deliveries:{...j.deliveries,[input.platform]:{...d,mediaReplacement:{sha256:j.validation.sha256,language:'pt-BR',status:'saving',attemptedAt:new Date().toISOString()}}}});
  return evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(e=>e.innerText.trim()==='Save'&&e.getBoundingClientRect().width>0);if(b.length!==1||b[0].disabled)throw Error('Salvar indisponível');b[0].click();return true;})()`);
 }
 if(input.step==='replacement-ready')return evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(e=>e.innerText.trim()==='Save'&&e.getBoundingClientRect().width>0);return b.length===1&&!b[0].disabled;})()`);
 if(input.step==='publish-existing-now'){
  const j=store.get(input.jobId,'explainer-job'),d=j?.deliveries?.[input.platform];if(!d?.bufferPostId||d.status!=='sending'||!d.publishNowRequestedAt)throw Error('Post agendado não encontrado.');
  await session(id=>browser.request('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},id));
  const expected=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(d.dueAt||d.plannedAt));
  await evaluate(`(()=>{const e=document.querySelector('article[data-post-id="${d.bufferPostId}"]'),label=e?.getAttribute('aria-label')||'';if(location.pathname!=='/channels/${d.channelId}/schedule'||!e||!e.innerText.includes(${JSON.stringify(j.title)})||!label.startsWith('Post scheduled')||!label.includes(' ${input.platform} channel on ${expected}'))throw Error('O post, canal ou horário não corresponde ao agendamento confirmado');const b=[...e.querySelectorAll('button')].find(b=>(b.innerText.trim()==='Publish Now'||b.getAttribute('aria-label')==='Publish Now')&&b.getBoundingClientRect().width>0);if(!b||b.disabled)throw Error('Publicar agora indisponível');b.setAttribute('data-vynex-publish-existing','true');return true;})()`);
  return evaluate(`(()=>{const b=document.querySelector('[data-vynex-publish-existing]');if(!b||b.disabled)throw Error('Envio já solicitado ou indisponível');b.click();return true;})()`);
 }
 if(input.step==='retry-existing-failed'){
  if(store.get('explainer-config','explainer-config')?.channels?.[input.platform]?.enabled===false)throw Error('Este canal foi desligado.');
  const j=store.get(input.jobId,'explainer-job'),d=j?.deliveries?.[input.platform];
  if(!d?.bufferPostId||d.status!=='remote_error')throw Error('O post não tem uma falha remota confirmada.');
  return evaluate(`(()=>{const e=document.querySelector('article[data-post-id="${d.bufferPostId}"]');if(!e||!e.innerText.includes(${JSON.stringify(j.title)})||!/failed|error|not published/i.test((e.getAttribute('aria-label')||'')+' '+e.innerText))throw Error('Falha não confirmada na interface');const b=[...e.querySelectorAll('button')].find(b=>/^Retry(?: Now| Post)?$/i.test(b.innerText.trim()));if(!b||b.disabled)throw Error('Repetir o mesmo post não está disponível');b.click();return true;})()`);
 }
 if(input.step==='save-rescheduled-post'){
  const j=store.get(input.jobId,'explainer-job'),d=j?.deliveries?.[input.platform];if(!d?.bufferPostId||!Number.isFinite(Date.parse(input.dueAt))||Date.parse(input.dueAt)<Date.now()+60000)throw Error('Agendamento inválido.');
  const proof=await evaluate(`(()=>({path:location.pathname,at:Number(document.querySelector('[data-testid=schedule-selector-trigger]')?.getAttribute('data-scheduled-at'))*1000,caption:document.querySelector('[data-testid=composer-text-area]')?.innerText}))()`);
  if(proof.path!=='/channels/'+d.channelId+'/schedule'||proof.at!==Date.parse(input.dueAt)||!proof.caption?.includes(j.title))throw Error('Edição não confirmou vídeo, canal e horário.');
  store.put('explainer-job',{...j,deliveries:{...j.deliveries,[input.platform]:{...d,rescheduling:{dueAt:input.dueAt,attemptedAt:new Date().toISOString()}}}});
  return evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(e=>e.innerText.trim()==='Save'&&e.getBoundingClientRect().width>0);if(b.length!==1||b[0].disabled)throw Error('Salvar indisponível');b[0].click();return true;})()`);
 }
 if(input.step==='assert-channel'){
  if(!/^[a-f0-9]{24}$/.test(input.channelId)||!['instagram','tiktok','youtube'].includes(input.platform))throw Error('Destino inválido.');
  const rows=await evaluate(`(()=>[...document.querySelectorAll('[data-channel-row] [data-channel-id]')].map(e=>({channelId:e.getAttribute('data-channel-id'),platform:e.querySelector('[data-channel]')?.getAttribute('data-channel')})))()`);
  return assertComposerTarget(rows,input.channelId,input.platform);
 }
 if(input.step==='close-composer')return evaluate(`(()=>{const e=document.querySelector('[aria-label="Close Composer"]')||[...document.querySelectorAll('button')].find(e=>e.innerText?.trim()==='Close Composer');if(!e)throw Error('Editor não encontrado');e.click();return true;})()`);
 if(input.step==='confirm-queue'){
  const job=store?.get(input.jobId,'explainer-job'),delivery=job?.deliveries?.[input.platform];if(!delivery||delivery.provider!=='buffer-browser')throw Error('Recibo local ausente.');
  const dueAt=input.dueAt||delivery.dueAt,expected=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(dueAt));
  const cards=await evaluate(`(()=>({path:location.pathname,cards:[...document.querySelectorAll('article[data-post-id]')].map(e=>({id:e.getAttribute('data-post-id'),label:e.getAttribute('aria-label'),text:e.innerText,channels:[...e.querySelectorAll('a[href*="/channels/"]')].map(a=>a.getAttribute('href'))}))}))()`);
  const matches=cards.cards.filter(c=>(!delivery.bufferPostId||c.id===delivery.bufferPostId)&&c.text.includes(job.title)&&c.channels.some(h=>h.startsWith('/channels/'+delivery.channelId))&&c.label?.includes(' '+input.platform+' channel on '+expected));
  if(cards.path!=='/channels/'+delivery.channelId+'/schedule'||matches.length!==1||!/^Post scheduled/.test(matches[0].label))throw Error('Fila não confirmou canal, horário e legenda. Não reenviar.');
  const post=matches[0],receipt={...delivery,status:'scheduled',dueAt,plannedAt:dueAt,rescheduling:null,schedule:{...delivery.schedule,dueAt,localDay:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(dueAt))},remoteId:'buffer-browser:'+post.id,bufferPostId:post.id,bufferUrl:'https://publish.buffer.com/channels/'+delivery.channelId+'/schedule',checkedAt:new Date().toISOString(),message:'Arquivo local recebido e agendado na fila Buffer. Publicação ainda não confirmada.'};
  store.put('explainer-job',{...job,deliveries:{...job.deliveries,[input.platform]:receipt}});return receipt;
 }
 if(input.step==='open-composer'){
  await session(id=>browser.request('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},id));
  await session(async id=>{await browser.request('Page.bringToFront',{},id);await browser.request('Emulation.setFocusEmulationEnabled',{enabled:true},id);});
  await new Promise(r=>setTimeout(r,1200));return evaluate(`(()=>{const e=document.querySelector('[data-testid=queue-header-create-post]');if(!e||e.disabled)throw Error('Novo post indisponível');e.click();return true;})()`);
 }
 if(input.step==='dismiss-intro'){
  const rejected=store?.list('explainer-job').filter(j=>j.artifactsRemovedAt||j.status==='rejected').map(j=>j.title)||[];
  const recovery=await evaluate(`(()=>{const d=[...document.querySelectorAll('[role=dialog]')].find(e=>e.innerText.includes('Resume Unfinished Post?')&&${JSON.stringify(rejected)}.some(t=>e.innerText.includes(t)));if(!d)return false;const b=[...d.querySelectorAll('button')].find(e=>e.innerText.trim()==='Discard');if(!b)return false;b.setAttribute('data-vynex-discard-rejected','true');return true;})()`);
  if(recovery)await click('[data-vynex-discard-rejected]');
  await evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.innerText==='Got It');if(e)e.click();return true;})()`);return true;
 }
 if(input.step==='caption'){
  if(typeof input.text!=='string'||input.text.length>4000)throw Error('Legenda inválida.');
  await evaluate(`(()=>{const e=document.querySelector('[data-testid=composer-text-area]');if(!e)throw Error('Editor indisponível');e.focus();document.execCommand('selectAll',false,null);return true;})()`);return session(async id=>{await browser.request('Input.insertText',{text:input.text},id);return true;});
 }
 throw Error('Etapa de publicação local não reconhecida.');
}
