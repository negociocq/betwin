import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DeliveryError} from './publisher.mjs';

// This adapter receives a validated local artifact; no public hosting or Buffer key.
export function createDirectYouTubePublisher({youtube,store,buffer}){
 const direct=()=>youtube.status().connected;
 async function remote(id){
  const r=await youtube.authorizedRequest('https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id='+encodeURIComponent(id));
  if(!r.ok)throw Error('Não foi possível confirmar o vídeo no YouTube.');
  const video=(await r.json()).items?.find(x=>x.id===id);
  if(!video||video.snippet?.channelId!==youtube.status().channelId)throw Error('O YouTube não confirmou o vídeo no canal autorizado.');
  return {id:'youtube-direct:'+id,status:video.status?.privacyStatus==='public'?'sent':video.status?.publishAt?'scheduled':'needs_approval',dueAt:video.status?.publishAt||null,externalLink:'https://www.youtube.com/watch?v='+encodeURIComponent(id)};
 }
 return {
  async connection(platform){return platform==='youtube'&&direct()?{channelId:youtube.status().channelId,channelName:youtube.status().channelTitle,localUpload:true}:buffer.connection(platform);},
  verifyMedia:(...args)=>buffer.verifyMedia(...args),
  async submit(input){
   if(input.platform!=='youtube'||!input.localUpload)return buffer.submit(input);
   if(!direct()||input.channelId!==youtube.status().channelId)throw Error('Reconecte o canal YouTube correto.');
   if(!/^[a-f0-9-]{36}$/.test(input.jobId))throw Error('Vídeo local inválido.');
   const job=store.get(input.jobId,'explainer-job');
   if(!job?.approved||!job.validation||typeof input.madeForKids!=='boolean')throw Error('Aprove um vídeo validado e declare o público antes de enviar.');
   if(input.publishNow!==true&&(!Number.isFinite(Date.parse(input.dueAt))||Date.parse(input.dueAt)<Date.now()+60000))throw Error('Defina uma publicação futura.');
   const file=resolve('storage/explainers',job.id,'video.mp4'),info=await stat(file);
   const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
   if(hash.digest('hex')!==job.validation.sha256)throw Error('O MP4 mudou após a validação. Nenhum envio iniciado.');
   const receiptId='direct-youtube-'+input.channelId+'-'+job.validation.sha256,previous=store.get(receiptId,'direct-delivery');
   if(previous?.videoId)return remote(previous.videoId);
   if(previous)throw new DeliveryError('Há um envio direto anterior sem confirmação. Confira o YouTube Studio antes de repetir.',true);
   const receipt={id:receiptId,jobId:job.id,channelId:input.channelId,status:'initiating',createdAt:new Date().toISOString()};store.put('direct-delivery',receipt);
   try{
    const metadata={snippet:{title:input.title.slice(0,100),description:input.description,categoryId:'27',defaultLanguage:'pt-BR'},status:{privacyStatus:input.publishNow===true?'public':'private',...(input.publishNow===true?{}:{publishAt:input.dueAt}),selfDeclaredMadeForKids:input.madeForKids,containsSyntheticMedia:true}};
    const started=await youtube.authorizedRequest('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Length':String(info.size),'X-Upload-Content-Type':'video/mp4'},body:JSON.stringify(metadata)});
    if(!started.ok)throw Error('YouTube recusou iniciar o envio (HTTP '+started.status+'). Confira permissões e quota no Google Cloud.');
    const location=started.headers.get('location'),target=new URL(location);
    if(target.origin!=='https://www.googleapis.com'||!target.pathname.startsWith('/upload/'))throw Error('Sessão de upload inválida.');
    const r=await youtube.authorizedRequest(location,{method:'PUT',duplex:'half',headers:{'Content-Type':'video/mp4','Content-Length':String(info.size)},body:createReadStream(file)});
    if(!r.ok)throw Error('O YouTube não confirmou a transferência.');
    const video=await r.json();if(typeof video.id!=='string'||!video.id)throw Error('O YouTube não retornou o ID do vídeo.');
    store.put('direct-delivery',{...receipt,videoId:video.id,status:'verifying'});
    const confirmed=await remote(video.id);store.put('direct-delivery',{...receipt,videoId:video.id,status:confirmed.status});return confirmed;
   }catch(e){store.put('direct-delivery',{...store.get(receiptId,'direct-delivery'),status:'needs_reconciliation'});throw new DeliveryError(e.message,true);}
  },
  async publishNow(job,platform,d){
   if(platform!=='youtube'||!d?.remoteId?.startsWith('youtube-direct:'))throw Error('Publicação imediata não está disponível para este tipo de envio.');
   if(!direct())throw new DeliveryError('Reconecte o canal YouTube correto.',false);
   const videoId=d.remoteId.slice(15),before=await remote(videoId);
   if(before.status==='sent')return before;
   if(before.status!=='scheduled')throw new DeliveryError('O vídeo não está agendado como privado no YouTube.',false);
   const receiptId='direct-youtube-'+d.channelId+'-'+job.validation?.sha256,receipt=store.get(receiptId,'direct-delivery');
   if(!receipt?.videoId||receipt.videoId!==videoId||receipt.jobId!==job.id)throw new DeliveryError('O recibo local não corresponde a este vídeo. Nenhuma alteração foi feita.',false);
   const requestedAt=new Date().toISOString();
   store.put('direct-delivery',{...receipt,status:'publishing_now',publishNowRequestedAt:requestedAt});
   try{
    const response=await youtube.authorizedRequest('https://www.googleapis.com/youtube/v3/videos?part=status',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:videoId,status:{privacyStatus:'public'}})});
    if(!response.ok){const uncertain=response.status>=500;store.put('direct-delivery',{...receipt,status:uncertain?'needs_reconciliation':receipt.status,...(uncertain?{publishNowRequestedAt:requestedAt}:{})});throw new DeliveryError('YouTube não confirmou a publicação imediata (HTTP '+response.status+'). Confira o YouTube Studio antes de tentar novamente.',uncertain);}
    const confirmed=await remote(videoId);
    if(confirmed.status==='sent'){store.put('direct-delivery',{...receipt,status:'published',publishNowRequestedAt:requestedAt});return confirmed;}
    store.put('direct-delivery',{...receipt,status:'needs_reconciliation',publishNowRequestedAt:requestedAt});
    return {id:d.remoteId,status:'sending',dueAt:before.dueAt,externalLink:null};
   }catch(e){
    if(e instanceof DeliveryError)throw e;
    store.put('direct-delivery',{...receipt,status:'needs_reconciliation',publishNowRequestedAt:requestedAt});
    throw new DeliveryError('Não foi possível confirmar a publicação imediata. Confira o YouTube Studio antes de tentar novamente.',true);
   }
  },
  async poll(id){
   if(!id.startsWith('youtube-direct:'))return buffer.poll(id);
   const videoId=id.slice(15),result=await remote(videoId),receipt=store.list('direct-delivery').find(x=>x.videoId===videoId);
   if(result.status==='sent'&&receipt&&receipt.status!=='published')store.put('direct-delivery',{...receipt,status:'published'});
   if(result.status==='scheduled'&&['publishing_now','needs_reconciliation'].includes(receipt?.status))return {...result,status:'sending',externalLink:null};
   return result;
  }
 };
}
