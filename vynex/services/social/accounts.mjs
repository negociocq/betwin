import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createVault} from '../youtube/vault.mjs';
export const platforms=['youtube','instagram','tiktok'];
const clean=value=>typeof value==='string'?value.replace(/[\x00-\x1f]/g,'').slice(0,200):'';
const messageFor=status=>status===401||status===403?'A chave não foi aceita ou não tem permissão. Confira o acesso à API no Buffer.':status===429?'Limite de consultas do Buffer atingido. Aguarde antes de sincronizar novamente.':'O Buffer não respondeu corretamente. Tente novamente mais tarde.';
export function createSocialAccounts({directory=resolve('data/social-accounts'),vault=createVault(resolve('data/integrations'),'buffer'),fetchImpl=fetch,youtubeStatus=()=>({connected:false,configured:false}),browserEnabled=()=>false,browserOverrides=()=>({}),supportedPlatforms=platforms}={}){
 const selectedPlatforms=[...supportedPlatforms];if(!selectedPlatforms.length||selectedPlatforms.some(p=>![...platforms,'pinterest'].includes(p)))throw Error('Invalid platform selection');
 const file=resolve(directory,'accounts.json');let tail=Promise.resolve();
 const serial=fn=>{const pending=tail.then(fn);tail=pending.catch(()=>{});return pending;};
 async function read(){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return {channels:[],bindings:{},verifiedAt:null,verification:'not_connected'};throw e;}}
 async function write(state){await mkdir(directory,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(state,null,2));await rename(temp,file);}
 async function query(key,query,variables={}){
  let response;try{response=await fetchImpl('https://api.buffer.com',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(15000)});}catch{throw Error('Não foi possível acessar o Buffer. Confira a internet e tente novamente.');}
  if(!response.ok){const error=Error(messageFor(response.status));error.status=response.status;if(response.status===429){const retry=response.headers?.get?.('retry-after');const seconds=Number(retry);error.retryAt=new Date(Date.now()+Math.max(15*60*1000,Number.isFinite(seconds)&&seconds>0?seconds*1000:Date.parse(retry)-Date.now()||0)).toISOString();}throw error;}
  let body;try{body=await response.json();}catch{throw Error('O Buffer retornou uma resposta inválida.');}
  if(body.errors?.length||!body.data)throw Error('O Buffer não autorizou a consulta completa. Confira as permissões de leitura de organizações e canais.');
  return body.data;
 }
 async function discover(key){
  const data=await query(key,'query VynexOrganizations { account { organizations { id } } }');
  const organizations=data.account?.organizations;
  if(!Array.isArray(organizations)||organizations.length>20||organizations.some(o=>!o||typeof o.id!=='string'||!o.id))throw Error('Não foi possível identificar as organizações do Buffer.');
  const channels=[];
  for(const o of organizations){
   const result=await query(key,'query VynexChannels($input: ChannelsInput!) { channels(input: $input) { id name displayName service isDisconnected isLocked isQueuePaused } }',{input:{organizationId:o.id}});
   if(!Array.isArray(result.channels)||result.channels.length>300)throw Error('O catálogo de canais do Buffer está incompleto.');
   for(const c of result.channels){
    if(!c||typeof c.id!=='string'||typeof c.service!=='string'||typeof c.name!=='string'||typeof c.isDisconnected!=='boolean'||typeof c.isLocked!=='boolean'||typeof c.isQueuePaused!=='boolean')throw Error('Um canal retornou dados incompletos. Nenhuma conexão foi presumida.');
    if(selectedPlatforms.includes(c.service))channels.push({id:c.id,organizationId:o.id,name:clean(c.displayName||c.name),handle:clean(c.name),platform:c.service,disconnected:c.isDisconnected,locked:c.isLocked,queuePaused:c.isQueuePaused});
   }
  }
  if(new Set(channels.map(c=>c.id)).size!==channels.length)throw Error('O catálogo retornou identificadores duplicados.');
  return channels;
 }
 async function status(){
  const state=await read(),configured=await vault.exists(),verified=configured&&state.verification==='verified',yt=youtubeStatus();
  return {focus:selectedPlatforms,pausedPlatforms:['shopee'],buffer:{configured,verified,verifiedAt:state.verifiedAt,message:state.message||null,channels:configured?state.channels.filter(c=>selectedPlatforms.includes(c.platform)):[],connectUrl:'https://publish.buffer.com/',apiDocsUrl:'https://developers.buffer.com/guides/getting-started.html'},platforms:selectedPlatforms.map(platform=>{
    const preferred=browserOverrides()[platform];if(browserEnabled()&&preferred?.channelId)return {platform,selectedChannelId:preferred.channelId,connected:true,channelName:preferred.channelName,queuePaused:false,connectionState:'connected',provider:'buffer-browser',publicationTested:!!preferred.verifiedAt,automaticPublication:true};
    if(platform==='youtube'&&yt.connected&&yt.channelId)return {platform,selectedChannelId:yt.channelId,connected:true,channelName:yt.channelTitle,queuePaused:false,connectionState:'connected',provider:'youtube-direct',publicationTested:yt.liveIntegrationValidated===true,automaticPublication:true};
   const channel=state.channels.find(c=>c.id===state.bindings[platform]&&c.platform===platform);
   return {platform,provider:browserEnabled()&&platform!=='youtube'?'buffer-browser':'buffer',selectedChannelId:channel?.id||null,connected:!!(verified&&channel&&!channel.disconnected&&!channel.locked),channelName:channel?.name||null,queuePaused:channel?.queuePaused||false,connectionState:!configured?'not_connected':!verified?'verification_required':!channel?'choose_channel':channel.disconnected?'reauthorization_required':channel.locked?'locked':'connected',publicationTested:false,automaticPublication:false};
  }),youtubeDirect:{clientFileName:clean(yt.clientFileName)||null,channelId:yt.channelId||null,configured:yt.configured===true,connected:yt.connected===true,channelTitle:clean(yt.channelTitle)||null,liveIntegrationValidated:yt.liveIntegrationValidated===true,automaticPublication:false},workflow:{approvalRequired:true,automaticPublication:false,status:'connection_and_real_upload_test_required',message:'Conectar contas não publica vídeos. Após a conexão, ainda é necessário validar o envio do MP4 e o agendamento.'}};
 }
 const validateKey=key=>{if(typeof key!=='string'||key.length<16||key.length>4096||/[\r\n\s]/.test(key))throw Error('Informe somente a chave de API do Buffer, sem espaços. Não informe senhas das redes.');return key;};
 async function connect(input){return serial(async()=>{
  if(!input||Object.keys(input).some(k=>k!=='apiKey'))throw Error('A conexão aceita somente a chave de API do Buffer.');
  const apiKey=validateKey(input.apiKey),channels=await discover(apiKey),previous=await read();
  await vault.save({apiKey});
  // Replacing an account always requires selecting its returned channels again.
  await write({...previous,channels,bindings:{},verification:'verified',verifiedAt:new Date().toISOString(),message:null});return status();
 });}
 async function sync(){return serial(async()=>{
  const state=await read();
  if(Date.parse(state.retryAt)>Date.now())throw Error('Limite do Buffer atingido. A chave e os canais continuam salvos. Nova tentativa após '+new Date(state.retryAt).toLocaleString('pt-BR')+'.');
  let saved;
  try{saved=await vault.load();}catch{throw Error('Não foi possível acessar a chave protegida no Windows. Reconecte o Buffer.');}
  if(!saved?.apiKey)throw Error('Conecte o Buffer antes de sincronizar os canais.');
  try{const channels=await discover(saved.apiKey);const bindings=Object.fromEntries(Object.entries(state.bindings).filter(([p,id])=>channels.some(c=>c.id===id&&c.platform===p)));await write({...state,channels,bindings,verification:'verified',verifiedAt:new Date().toISOString(),message:null,retryAt:null});}
  catch(e){await write({...state,verification:'failed',message:e.message,retryAt:e.retryAt||new Date(Date.now()+60000).toISOString()});throw e;}
  return status();
 });}
 async function bind(input){return serial(async()=>{
  if(!input||Object.keys(input).some(k=>!['platform','channelId'].includes(k))||!selectedPlatforms.includes(input.platform)||typeof input.channelId!=='string')throw Error('Seleção de canal inválida.');
  const state=await read();if(!await vault.exists()||state.verification!=='verified'||!Number.isFinite(Date.parse(state.verifiedAt))||Date.now()-Date.parse(state.verifiedAt)>15*60*1000)throw Error('Sincronize os canais antes de selecionar.');
  const channel=state.channels.find(c=>c.id===input.channelId&&c.platform===input.platform);if(!channel||channel.disconnected||channel.locked)throw Error('Canal não disponível para esta plataforma. Reconecte-o no Buffer.');
  await write({...state,bindings:{...state.bindings,[input.platform]:channel.id}});return status();
 });}
 async function disconnect(){return serial(async()=>{await vault.clear();await write({channels:[],bindings:{},verifiedAt:null,verification:'not_connected',message:null});return status();});}
 return {status,connect,sync,bind,disconnect};
}
