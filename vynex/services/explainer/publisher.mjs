import {createHash} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createVault} from '../youtube/vault.mjs';
export class DeliveryError extends Error{constructor(message,uncertain=false){super(message);this.uncertain=uncertain;}}
export function mediaBase(value){
 if(!value)return '';
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port&&u.port!=='443')throw Error('Use um endereço público HTTPS, sem senha, parâmetros ou porta personalizada.');
 if(u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local'))throw Error('As redes não conseguem buscar vídeos em localhost. Use um domínio público HTTPS.');
 return u.href.replace(/\/$/,'');
}
const privateIp=ip=>{
 if(isIP(ip)===6)return !/^2[0-9a-f]{3}:/i.test(ip)||/^2001:(?:0:|db8:)/i.test(ip); // conservative global-unicast only
 const a=ip.split('.').map(Number);return a.length!==4||a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&(a[1]===168||a[1]===0)||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===198&&[18,19,51].includes(a[1])||a[0]===203&&a[1]===0;
};
export async function verifyPublicMedia(url,sha256,{fetchImpl=fetch,lookupImpl=lookup,maxBytes=250*1024*1024}={}){
 const u=new URL(url);mediaBase(u.origin);const addresses=await lookupImpl(u.hostname,{all:true});if(!addresses.length||addresses.some(a=>privateIp(a.address)))throw Error('O endereço de mídia precisa apontar para um servidor público.');
 const r=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!r.ok||!r.body||!/^video\/mp4\b/i.test(r.headers.get('content-type')||''))throw Error('O endereço público não entregou um MP4. Configure o acesso externo aos arquivos do Vynex.');
 const h=createHash('sha256');let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>maxBytes)throw Error('Mídia pública excede 250 MB.');h.update(chunk);}if(h.digest('hex')!==sha256)throw Error('O vídeo público é diferente do MP4 validado. Nenhuma publicação foi enviada.');return {verified:true,size};
}
export function createBufferPublisher({accounts,vault=createVault(undefined,'buffer'),fetchImpl=fetch,verify=verifyPublicMedia}={}){
 async function query(query,variables,mutating=false){
  const saved=await vault.load();if(!saved?.apiKey)throw new DeliveryError('Conecte o Buffer em Conectar contas.');let response;
  try{response=await fetchImpl('https://api.buffer.com',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+saved.apiKey},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(45000)});}catch{throw new DeliveryError('Resposta do Buffer não recebida. Confira o envio antes de tentar novamente.',mutating);}
  let body;try{body=await response.json();}catch{throw new DeliveryError('Resposta inválida do Buffer. Consulte o painel antes de repetir o envio.',mutating);}
  if(!response.ok||body.errors?.length||!body.data)throw new DeliveryError('Buffer recusou a operação ou retornou dados incompletos. Verifique permissões e limites.',mutating&&(response.status>=500||response.ok));
  return body.data;
 }
 async function connection(platform){
  const current=await accounts.status();if(!current.buffer.configured)throw Error('Conecte o Buffer e escolha os canais.');
  if(!current.buffer.verified||Date.now()-Date.parse(current.buffer.verifiedAt)>=15*60000)await accounts.sync();const s=await accounts.status();const p=s.platforms.find(p=>p.platform===platform);if(!p?.connected)throw Error('Conecte e selecione o canal '+platform+'.');if(p.queuePaused)throw Error('A fila desse canal está pausada no Buffer.');return {channelId:p.selectedChannelId,channelName:p.channelName};
 }
 return {connection,verifyMedia:verify,
  async submit({platform,channelId,title,description,url,madeForKids,dueAt,firstComment}){
   if(typeof dueAt!=='string'||!Number.isFinite(Date.parse(dueAt)))throw new DeliveryError('Defina uma data de publicação antes de enviar.');
   const metadata=platform==='youtube'?{youtube:{title:title.slice(0,100),categoryId:'27',privacy:'public',madeForKids,isAiGenerated:true}}:platform==='instagram'?{instagram:{type:'reel',shouldShareToFeed:true,isAiGenerated:true}}:{tiktok:{isAiGenerated:true}};
   if(platform==='instagram'&&typeof firstComment==='string'&&firstComment.trim())metadata.instagram.firstComment=firstComment.trim();
   const data=await query('mutation VynexVideo($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id status dueAt externalLink } } ... on MutationError { message } } }',{input:{channelId,text:description,assets:[{video:{url}}],metadata,aiAssisted:true,schedulingType:'automatic',mode:'customScheduled',dueAt,needsApproval:false,saveToDraft:false}},true);
   if(data.createPost?.message)throw new DeliveryError('Buffer: '+String(data.createPost.message).slice(0,400));
   const p=data.createPost?.post;if(!p?.id||!p.status)throw new DeliveryError('O Buffer não confirmou um identificador de envio. Confira o painel antes de repetir.',true);return p;
  },
  async poll(id){const data=await query('query VynexPost($input: PostInput!) { post(input: $input) { id channelId status dueAt externalLink assets { source } } }',{input:{id}});if(data.post?.id!==id)throw Error('Recibo do Buffer não corresponde à publicação.');return data.post;}
 };
}
