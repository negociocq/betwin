import {DeliveryError} from '../explainer/publisher.mjs';
const supported=['instagram','tiktok'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const day=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
export function browserUploadReady(snapshot){
 const controls=snapshot.controls||[],has=label=>controls.some(c=>c.text===label)||(snapshot.text||'').includes(label);
 return has('Remove video')&&!has('Cancel upload');
}
export function browserDueAt(dueAt,jobs,platform,jobId,synchronizePlatforms=false){
 const original=Date.parse(dueAt);let at=Math.ceil(original/900000)*900000;
 const reservations=jobs.flatMap(j=>Object.entries(j.deliveries||{}).filter(([p,d])=>(!synchronizePlatforms||p===platform)&&(j.id!==jobId||p!==platform)&&!(d.status==='rejected'&&!d.remoteId)).map(([,d])=>Date.parse(d.status==='published'?(d.publishedAt||d.dueAt||d.plannedAt):(d.dueAt||d.plannedAt)))).filter(Number.isFinite);
 for(let n=0;n<96;n++,at+=900000){if(day(at)!==day(original))throw new DeliveryError('Não há janela segura neste dia para o navegador.',false);if(reservations.every(r=>Math.abs(r-at)>=1800000))return new Date(at).toISOString();}
 throw new DeliveryError('Não há horário livre para o navegador.',false);
}
export function createBrowserPublisher({store,accounts,browser,fallback}){
 let tail=Promise.resolve();const serial=fn=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;};
 const enabled=()=>store.get('local-publishing-config','integrations')?.enabled===true;
 const override=platform=>store.get('local-publishing-config','integrations')?.channelOverrides?.[platform];
 const usesBrowser=platform=>supported.includes(platform)||platform==='youtube'&&!!override(platform)?.channelId;
 const work=(step,extra={})=>browser.action({action:'workflow',step,...extra});
 async function waitFor(fn,timeout=120000){const until=Date.now()+timeout;let last;while(Date.now()<until){try{const result=await fn();if(result)return result;}catch(e){last=e;}await sleep(500);}throw Error(last?.message||'A interface Buffer não confirmou a etapa no prazo.');}
 async function openChannel(channelId,jobId){await browser.start();await waitFor(async()=>{const s=await browser.snapshot();return s.controls?.length;},30000);const s=await browser.snapshot();if(s.text?.includes('Post Composer'))throw Error('Há uma publicação aberta no navegador. Conclua ou feche antes de automatizar.');await work('open-channel-page',{channelId,jobId});await waitFor(async()=>{const s=await browser.snapshot();return s.url==='https://publish.buffer.com/channels/'+channelId+'/schedule'&&s.controls?.some(c=>c.href==='/channels/'+channelId+'/settings')&&s.controls?.some(c=>c.testid==='queue-header-create-post');},20000);}
 async function publishNow(job,platform,d){
  if((platform==='youtube'&&d?.remoteId?.startsWith('youtube-direct:'))||!enabled()||!usesBrowser(platform)){
   if(typeof fallback.publishNow!=='function')throw Error('Publicação imediata não está disponível para este tipo de envio.');
   return fallback.publishNow(job,platform,d);
  }
  return serial(async()=>{
   if(d?.provider!=='buffer-browser'||!d.bufferPostId||!d.channelId||d.status!=='scheduled')throw Error('Somente um agendamento confirmado pelo Buffer pode ser antecipado.');
   if(!/^[a-f0-9]{24}$/.test(d.channelId))throw Error('Canal Buffer inválido.');
   await openChannel(d.channelId,job.id);
   try{await work('publish-existing-now',{jobId:job.id,platform});}
   catch(e){if(e.uncertain===true)throw e;throw new DeliveryError('Não foi possível confirmar a solicitação. Confira o post no Buffer antes de tentar novamente.',true);}
   return {id:d.remoteId,status:'sending',dueAt:d.dueAt,externalLink:null,message:'A rede recebeu o pedido de publicação imediata; aguardando confirmação pública.'};
  });
 }
 return {
  async connection(platform){if(usesBrowser(platform)&&store.get('local-publishing-config','integrations')?.enabled===false)throw Error('Envio local pausado em Contas.');if(!enabled()||!usesBrowser(platform))return fallback.connection(platform);const s=await accounts.status(),c=s.platforms.find(x=>x.platform===platform),selected=override(platform)||c;if(!selected?.channelId&&!selected?.selectedChannelId)throw Error('Selecione o canal '+platform+' em Contas.');return {channelId:selected.channelId||selected.selectedChannelId,channelName:selected.channelName,localUpload:true,provider:'buffer-browser'};},
  verifyMedia:(...args)=>fallback.verifyMedia(...args),
  audience:()=>serial(async()=>{
   const result={},connections=await accounts.status();
   for(const platform of supported){
    const channel=connections.platforms.find(c=>c.platform===platform);
    try{
     if(!channel?.connected||!channel.selectedChannelId)throw Error('Conecte a conta para consultar seguidores.');
     await browser.start();if((await browser.snapshot()).text?.includes('Post Composer'))throw Error('Feche o editor do Buffer para consultar seguidores.');await work('open-insights',{channelId:channel.selectedChannelId});
     const snapshot=await waitFor(async()=>{const s=await browser.snapshot();return s.url==='https://publish.buffer.com/insights/'+channel.selectedChannelId&&s.text?.includes('Summary')?s:null;},20000);
     const match=snapshot.text.match(/Total Followers\s+About Total Followers\s+([\d.,\s]+?)(?=\n\n|\nPosts)/);
     if(!match)throw Error('O Buffer não disponibilizou o total de seguidores nesta conta.');
     const count=match[1].replace(/[\s.,]/g,'');if(!/^\d+$/.test(count))throw Error('Total de seguidores indisponível.');
     result[platform]={channelId:channel.selectedChannelId,count,source:'Buffer Insights',checkedAt:new Date().toISOString(),error:null};
    }catch(e){result[platform]={channelId:channel?.selectedChannelId||null,error:e.message};}
   }
   return result;
  }),
  submit:input=>!usesBrowser(input.platform)||!input.localUpload?fallback.submit(input):serial(async()=>{
   if(!enabled())throw new DeliveryError('Envio local pausado em Contas.',false);
   let submitted=false,stage='abrir canal';
   try{
    const dueAt=browserDueAt(input.dueAt,store.list('explainer-job'),input.platform,input.jobId,store.get('gta6-automation','integrations')?.synchronized===true&&store.get(input.jobId,'explainer-job')?.gta6Automation===true);
    await browser.start();const before=await browser.snapshot(),owner=store.get('local-publishing-composer-owner','integrations'),job=store.get(input.jobId,'explainer-job');
    const resume=before.text?.includes('Post Composer')&&owner?.jobId===input.jobId&&owner.platform===input.platform&&owner.channelId===input.channelId&&owner.sha256===job?.validation?.sha256&&owner.stage!=='submitted';
    if(!resume)await openChannel(input.channelId,input.jobId);stage='abrir editor';await work('dismiss-intro');if(!resume)await work('open-composer');await work('dismiss-intro');
    await waitFor(async()=>{const snapshot=await browser.snapshot();return browserUploadReady(snapshot)||snapshot.controls?.some(c=>c.type==='file')||snapshot.text?.includes('Post Composer')&&(await work('inspect')).inputs?.some(c=>c.type==='file');},20000);
    await waitFor(()=>work('assert-channel',{platform:input.platform,channelId:input.channelId}),15000);
    stage='carregar vídeo';store.put?.('integrations',{id:'local-publishing-composer-owner',jobId:input.jobId,platform:input.platform,channelId:input.channelId,sha256:job?.validation?.sha256,stage:'uploading',startedAt:owner?.startedAt||new Date().toISOString()});
    const current=await browser.snapshot();if(!resume||!current.text?.includes('Remove video')&&!current.text?.includes('Cancel upload'))await work('upload-verified-memory',{jobId:input.jobId});
    await waitFor(async()=>browserUploadReady(await browser.snapshot()),600000);
    stage='definir legenda e horário';
    if(input.platform==='youtube')await work('configure-youtube-short',{jobId:input.jobId});
    await work('caption',{text:input.description});await work('ai-label',{jobId:input.jobId});await work('schedule-menu');await sleep(300);await work('choose-date');await sleep(300);
    await work('select-day',{dueAt});await sleep(700);await work('set-time',{dueAt});
    const time=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(dueAt));
    await work('pick-time',{time});await work('done-date');
    stage='enviar agendamento';submitted=true;store.put?.('integrations',{...store.get('local-publishing-composer-owner','integrations'),id:'local-publishing-composer-owner',jobId:input.jobId,stage:'submitted'});await work('finalize',{platform:input.platform,channelId:input.channelId,jobId:input.jobId,dueAt});
    stage='conferir recibo na fila';
    const receipt=await waitFor(async()=>{try{return await work('confirm-queue',{platform:input.platform,jobId:input.jobId});}catch{return null;}},180000);
    if(store.get('local-publishing-composer-owner','integrations')?.jobId===input.jobId)store.remove?.('local-publishing-composer-owner','integrations');
    return {id:receipt.remoteId,status:'scheduled',dueAt:receipt.dueAt,externalLink:null};
   }catch(e){throw new DeliveryError('Buffer · '+stage+': '+e.message,typeof e.uncertain==='boolean'?e.uncertain:submitted);}
  }),
  publishNow,
  reconcileDelivery:(job,platform,d)=>serial(async()=>{
   if(!enabled()||!usesBrowser(platform)||!d.channelId)return null;
   await browser.start();const audit=await work('audit-channel-preserve-editor',{channelId:d.channelId});
   const expected=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(d.dueAt||d.plannedAt));
   const cards=[...(audit.queue?.cards||[]),...(audit.sent?.cards||[])].filter(c=>c.text.includes(job.title)&&c.label?.includes(' '+platform+' channel on '+expected));
   const unique=[...new Map(cards.map(c=>[c.id,c])).values()];if(unique.length!==1)return null;
   const card=unique[0],link=card.links?.find(h=>platform==='youtube'?/^https:\/\/(www\.)?youtube.com\/(watch\?|shorts\/)/.test(h):platform==='instagram'?/^https:\/\/(www\.)?instagram.com\/(reel|p)\//.test(h):/^https:\/\/(www\.)?tiktok.com\/@[^/]+\/video\//.test(h));
   if(store.get('local-publishing-composer-owner','integrations')?.jobId===job.id){await work('open-channel-page',{channelId:d.channelId});store.remove?.('local-publishing-composer-owner','integrations');}
   return {remoteId:'buffer-browser:'+card.id,bufferPostId:card.id,provider:'buffer-browser',status:link?'published':/^Post scheduled/.test(card.label)?'scheduled':'sending',...(link?{externalLink:link,publishedAt:new Date().toISOString()}:{}),message:'Recibo recuperado automaticamente no Buffer; nenhum reenvio.',checkedAt:new Date().toISOString()};
  }),
  retryRemote:(job,platform,d)=>serial(async()=>{if(!d.remoteId?.startsWith('buffer-browser:'))throw Error('Este provedor não permite repetir o mesmo post automaticamente.');await openChannel(d.channelId,job.id);return work('retry-existing-failed',{jobId:job.id,platform});}),
  poll:id=>!id.startsWith('buffer-browser:')?fallback.poll(id):serial(async()=>{
   const job=store.list('explainer-job').find(j=>Object.values(j.deliveries||{}).some(d=>d.remoteId===id));const entry=Object.entries(job?.deliveries||{}).find(([,d])=>d.remoteId===id);if(!entry)throw Error('Recibo local não encontrado.');const [platform,d]=entry;
   // Pending schedules need no API calls; inspect near/after their actual due time.
   if(d.status==='scheduled'&&Date.parse(d.dueAt)>Date.now())return {id,status:'scheduled',dueAt:d.dueAt};
   await openChannel(d.channelId,job.id);const result=await work('read-receipt',{postId:d.bufferPostId||id.slice(15),platform});return {id,status:result.status,dueAt:d.dueAt,externalLink:result.externalLink||null,...(result.metrics?{metrics:result.metrics}:{}),...(result.metricsStatus?{metricsStatus:result.metricsStatus,metricsCheckedAt:result.metricsCheckedAt,metricsSourceRefresh:result.metricsSourceRefresh}:{})};
  })
 };
}
