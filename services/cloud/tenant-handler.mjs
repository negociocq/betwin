import {bufferCatalog,bufferConnectionStatus,selectBufferChannel,shopeePlatforms} from '../social/buffer-catalog.mjs';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {supabaseClients,createAccountWorkspace} from './supabase.mjs';
import {createAccountAuth} from './account-auth.mjs';
import {emptyWorkspace,accountSettings} from './empty-workspace.mjs';
export function createTenantHandler({clients=supabaseClients(),auth,workspace,sdkImpl,ownerId=process.env.VYNEX_OWNER_ID,agentHash=process.env.VYNEX_AGENT_HASH,allowed}={}){
 auth??=createAccountAuth(clients);workspace??=id=>createAccountWorkspace({admin:clients.admin,ownerId:id,initial:emptyWorkspace});
 return async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  try{
   const path=new URL(req.url,'https://betwin-three.vercel.app').pathname;
   if(path==='/api/liveness')return send(200,{ok:true,persistence:'supabase'});
   const origins=new Set([process.env.VYNEX_PUBLIC_URL||'https://betwin-three.vercel.app',...(process.env.VERCEL_URL?['https://'+process.env.VERCEL_URL]:[])]);if(req.headers.origin&&!origins.has(req.headers.origin))return send(403,{error:'Origem não autorizada.'});
   let body=req.body;if(req.method==='POST'&&body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1048576)return send(413,{error:'Dados excedem o limite.'});}body=raw?JSON.parse(raw):{};}if(typeof body==='string')body=JSON.parse(body);body??={};
   if(await auth.handle(req,res,path,body))return;
   if(path==='/api/cloud/agent'){
    const candidate=createHash('sha256').update(String(req.headers.authorization||'').replace(/^Bearer /,'')).digest('hex');if(!ownerId||agentHash?.length!==64||!timingSafeEqual(Buffer.from(candidate),Buffer.from(agentHash)))return send(401,{error:'Agente não autorizado.'});
    const store=workspace(ownerId);if(req.method==='GET'){const {data}=await store.read();return send(200,{commands:(data.commands||[]).filter(c=>c.status==='queued').map(({id,path,body})=>({id,path,body}))});}
    if(req.method!=='POST')return send(405,{error:'Método não permitido.'});
    return send(200,await store.transaction(async data=>{
     if(body.claim){const c=data.commands?.find(c=>c.id===body.claim);if(!c||c.status!=='queued')return {claimed:false};c.status='running';c.startedAt=new Date().toISOString();return {claimed:true,command:{id:c.id,path:c.path,body:c.body}};}
     if(body.agent)data.agent=body.agent;if(body.progress){const c=data.commands?.find(c=>c.id===body.progress.id&&c.status==='running');if(c)c.progress={step:String(body.progress.step||'preparando').slice(0,40),message:String(body.progress.message||'').slice(0,300),status:String(body.progress.status||'running').slice(0,30),updatedAt:new Date().toISOString()};}if(body.complete){const c=data.commands?.find(c=>c.id===body.complete);if(c?.status==='running'){c.status=body.ok?'completed':'failed';c.message=String(body.message||'').slice(0,1000);c.finishedAt=new Date().toISOString();c.progress={step:body.ok?'concluido':'erro',status:body.ok?'completed':'failed',message:c.message,updatedAt:c.finishedAt};delete c.body;}}
     if(body.snapshot){data.snapshots=body.snapshot;data.syncedAt=new Date().toISOString();}if(body.media)data.media={...data.media,...body.media};
     data.commands=(data.commands||[]).filter(c=>!c.finishedAt||Date.now()-Date.parse(c.finishedAt)<7*86400000);return {ok:true};
    }));
   }
   const user=await auth.user(req),capability=['GET','HEAD'].includes(req.method)&&/^\/api\/explainers\/media\/[a-f0-9]{48}\.mp4$/.test(path);
   if(!user&&!capability)return send(401,{error:'Entre na sua conta para acessar o Vynex.',code:'AUTH_REQUIRED'});
   const store=workspace(user?.id||ownerId),{data}=await store.read();if(!user&&data.media?.[path]?.public!==true)return send(401,{error:'Entre na sua conta para acessar o Vynex.',code:'AUTH_REQUIRED'});
   if(req.method==='POST'){
    if(path.startsWith('/api/shopee/buffer/')&&user.id!==ownerId){const operation=path.split('/').at(-1),saved=data.integrations?.buffer;if(!['connect','sync','bind'].includes(operation))return send(404,{error:'Operacao indisponivel.'});let catalog;if(operation!=='bind')catalog=await bufferCatalog(operation==='connect'?body.apiKey:saved?.apiKey);await store.transaction(async state=>{state.integrations??={};if(catalog){state.integrations.buffer={apiKey:operation==='connect'?body.apiKey:saved.apiKey};state.bufferCatalog={...catalog,bindings:operation==='connect'?{}:state.bufferCatalog?.bindings||{},configured:true,verification:'verified',verifiedAt:new Date().toISOString()};}else{if(!state.bufferCatalog?.configured)throw Object.assign(Error('Conecte o Buffer primeiro.'),{status:400});state.bufferCatalog.bindings=selectBufferChannel(state.bufferCatalog,body);}state.snapshots['/api/status'].shopeeBuffer=bufferConnectionStatus(state.bufferCatalog);});return send(200,{saved:true});}
    if(!allowed?.has(path.slice(5)))return send(404,{error:'Operação não disponível.'});
    if(user.id!==ownerId){let updated=false;await store.transaction(async state=>{updated=accountSettings(state,path,body);});if(updated)return send(200,{saved:true});return send(409,{error:'Esta conta ainda não possui agente de produção conectado. Suas configurações ficam salvas separadamente.'});}
    const id=randomUUID();await store.transaction(async state=>{state.commands??=[];if(path.includes('/production-')&&state.commands.some(c=>c.path?.includes('/production-')&&['queued','running'].includes(c.status)))throw Object.assign(Error('Ja existe uma geracao em andamento. Acompanhe as etapas.'),{status:409});if(state.commands.filter(c=>['queued','running'].includes(c.status)).length>=30)throw Object.assign(Error('Aguarde a fila atual.'),{status:409});state.commands.push({id,path,body,status:'queued',createdAt:new Date().toISOString()});});await clients.admin.from('vynex_agent_wakes').upsert({owner_id:user.id,nonce:randomUUID(),updated_at:new Date().toISOString()});let notified=false;try{await clients.admin.channel('vynex-agent-'+user.id,{config:{private:true}}).httpSend('wake',{commandId:id},{timeout:5000});notified=true;}catch{}return send(202,{queued:true,commandId:id,message:notified?'Solicitacao enviada ao computador conectado. Acompanhe as etapas no painel.':'Solicitação salva na sua conta. O computador executará na próxima sincronização (até 10 minutos).'});
   }
   if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Método não permitido.'});
   if(path==='/api/shopee-official/generation'){const command=(data.commands||[]).filter(c=>['/api/shopee-official/production-one','/api/shopee-official/production-run','/api/shopee-official/draft'].includes(c.path)).at(-1);return send(200,{command:command?{id:command.id,status:command.status,message:command.message,progress:command.progress,createdAt:command.createdAt}:null,progress:data.snapshots?.['/api/shopee-official/status']?.production?.progress,agent:data.agent||null});}
   if(path==='/api/cloud/status')return send(200,{mode:user.id===ownerId?'local-agent':'awaiting-agent',agent:data.agent||null,syncedAt:data.syncedAt,intervalMinutes:10,commands:(data.commands||[]).map(({body,...c})=>c)});
   if(data.snapshots?.[path]!==undefined)return send(200,data.snapshots[path]);
   const media=data.media?.[path];if(media){const lib=sdkImpl||await import('@vercel/blob'),validUntil=Date.now()+15*60000,signed=await lib.issueSignedToken({pathname:media.pathname,operations:['get','head'],validUntil,token:process.env.BLOB_READ_WRITE_TOKEN}),{presignedUrl}=await lib.presignUrl(signed,{pathname:media.pathname,access:'private',operation:req.method==='HEAD'?'head':'get',validUntil});res.writeHead(307,{Location:presignedUrl,'Cache-Control':'no-store'});return res.end();}
   if(path.includes('/oauth/pinterest/'))return send(409,{error:'Conclua a autorização no agente de produção desta conta.'});
   return send(404,{error:'Arquivo ou operação não encontrado.'});
  }catch(e){console.error('Vynex account API:',e.status||'internal');return send(e.status||503,{error:e.status?e.message:'Não foi possível concluir a operação. Tente novamente.'});}
 };
}
