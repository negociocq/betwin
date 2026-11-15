import {channelsFor,chooseSlot} from '../explainer/schedule.mjs';
import {socialMetricsState} from '../explainer/social-metrics-state.mjs';
export function createGtaDeliveries({store,publisher,clock=()=>new Date(),timerEnabled=true}){
 let closed=false,running=false;const mediaStorage=null,reliability={enabled:()=>false};
 const config=()=>{const c={enabled:false,platforms:['youtube','instagram','tiktok'],...store.get('explainer-config','explainer-config')};return {...c,channels:channelsFor(c)};};
 const jobs=()=>store.list('explainer-job').filter(j=>j.gta6Automation===true);const fresh=id=>{const j=store.get(id,'explainer-job');if(!j?.gta6Automation)throw Error('GTA job not found');return j;};const save=j=>store.put('explainer-job',j);
 const dayOverrides=()=>Object.fromEntries(store.list('explainer-publication-day').map(r=>[r.day,r.channels]));
 const safeLink=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
 function receipt(post,previous={}){const link=safeLink(post.externalLink),states={sent:link?'published':'sent_unconfirmed',sending:'sending',error:'remote_error',draft:'remote_review',needs_approval:'remote_review',scheduled:'scheduled'};return {...socialMetricsState(post,previous),...(post.metrics?{metrics:post.metrics,metricsError:null}:{}),...(post.status==='sent'?{publishedAt:post.publishedAt||previous.publishedAt||clock().toISOString()}:{}),remoteId:post.id,status:states[post.status]||'remote_unknown',remoteStatus:post.status,dueAt:post.dueAt||null,externalLink:link,message:post.status==='scheduled'?'Agendamento confirmado; aguardando publicação.':post.status==='sent'&&link?'Publicação confirmada.':post.status==='error'?'Erro informado pela plataforma. Confira a publicação.':'Aguardando confirmação da plataforma.',checkedAt:clock().toISOString()};}
 async function publish(job,c){
  if(store.get('gta6-automation','integrations')?.enabled&&!job.gta6Automation)return;
  if(job.gta6Automation&&store.get('gta6-automation','integrations')?.requireDubbing&&(job.language!=='pt-BR'||!job.validation?.dubbingVerified))return;
  if(Date.parse(store.get('local-publishing-manual-lease','integrations')?.until)>Date.now())return;
  if(!job.approved||!job.validation)return;
  for(const platform of job.targets){
   if(Date.parse(store.get('local-publishing-manual-lease','integrations')?.until)>Date.now())return;
   if(closed)return;let j=fresh(job.id),d=j.deliveries[platform];
   if(d?.remoteId){
    if(d.status==='published')continue;
    try{const p=await publisher.poll(d.remoteId);j=fresh(j.id);save({...j,deliveries:{...j.deliveries,[platform]:{...d,...receipt(p,d)}}});}catch(e){j=fresh(j.id);save({...j,deliveries:{...j.deliveries,[platform]:{...d,message:'Não foi possível atualizar o recibo. O envio não será repetido.'}}});}
    continue;
   }
   if(d&&['submitting','uncertain','rejected'].includes(d.status))continue;
   if(!config().channels[platform]?.enabled)continue;
   let channel,url;
   try{channel=await publisher.connection(platform);if(!channel.localUpload){if(mediaStorage&&(await mediaStorage.status()).configured)url=await mediaStorage.upload(j);else{if(!c.publicBaseUrl)throw Error('Configure o armazenamento público dos vídeos para Instagram/TikTok.');url=c.publicBaseUrl+`/api/explainers/media/${j.mediaToken}.mp4`;}await publisher.verifyMedia(url,j.validation.sha256);}}
   catch(e){j=fresh(j.id);save({...j,deliveries:{...j.deliveries,[platform]:{status:'waiting_setup',message:String(e.message).slice(0,500)}}});continue;}
   if(closed||!config().channels[platform]?.enabled)continue;
   j=fresh(j.id);if(!j.approved||j.artifactsRemovedAt)return;
   const settings=config().channels[platform],schedule=chooseSlot({platform,settings,jobId:j.id,jobs:jobs(),now:clock(),notBefore:j.publicationNotBefore||null,synchronizePlatforms:j.gta6Automation===true&&store.get('gta6-automation','integrations')?.synchronized===true,dayOverrides:dayOverrides(),catchUpMissed:reliability.enabled()});if(!schedule)continue;
   // This durable write happens BEFORE sending. Unknown outcomes are never retried.
   j=fresh(j.id);save({...j,deliveries:{...j.deliveries,[platform]:{status:'submitting',channelId:channel.channelId,channelName:channel.channelName,mediaUrl:url,plannedAt:schedule.dueAt,schedule,comment:{text:settings.commentText,mode:settings.commentMode,status:settings.commentMode==='first_comment'?'requested_with_post':'manual',pinStatus:'manual_only'},attemptedAt:clock().toISOString()}}});
   try{
    const description=j.publicationDescription||j.title;
    const p=await publisher.submit({jobId:j.id,localUpload:channel.localUpload===true,platform,channelId:channel.channelId,title:j.title,description,url,madeForKids:j.madeForKids,dueAt:schedule.dueAt,firstComment:platform==='instagram'&&settings.commentMode==='first_comment'?settings.commentText:undefined});j=fresh(j.id);save({...j,deliveries:{...j.deliveries,[platform]:{...j.deliveries[platform],...receipt(p,j.deliveries[platform])}}});
   }catch(e){j=fresh(j.id);save({...j,deliveries:{...j.deliveries,[platform]:{...j.deliveries[platform],status:e.uncertain===false?'rejected':'uncertain',message:String(e.message).slice(0,500)}}});}
  }
  const j=fresh(job.id);if(j.targets.every(p=>j.deliveries[p]?.status==='published'))save({...j,status:'published',message:'Publicação confirmada nas plataformas selecionadas'});
 }

 async function tick(){if(closed||running)return;running=true;try{for(const j of jobs().filter(j=>['ready','published'].includes(j.status)&&j.approved&&!j.artifactsRemovedAt))await publish(j,config());}finally{running=false;}}
 for(const j of jobs()){let changed=false;for(const d of Object.values(j.deliveries||{}))if(d.status==='submitting'){d.status='uncertain';changed=true;}if(changed)save(j);}
 const timer=timerEnabled?setInterval(()=>tick().catch(()=>{}),60000):null;timer?.unref();
 return {tick,async close(){closed=true;clearInterval(timer);while(running)await new Promise(r=>setTimeout(r,100));}};
}
