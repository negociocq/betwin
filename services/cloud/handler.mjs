import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {createWorkspaceStore} from './workspace.mjs';
import {createRuntime} from './runtime.mjs';
const digest=v=>createHash('sha256').update(v).digest('hex');
const allowed=new Set(['shopee/buffer/connect','shopee/buffer/sync','shopee/buffer/bind','shopee/credentials','gta6/pause','gta6/configure','gta6/buffer/connect','gta6/buffer/sync','gta6/buffer/bind',...['studio-configure','campaign','production-run','configure','verify-shopee','discover','draft','approve','plan','test-pinterest','pinterest-client','verify-pinterest','reports','cancel'].map(p=>'shopee-official/'+p)]);
export function createCloudHandler({store=createWorkspaceStore({token:process.env.BLOB_READ_WRITE_TOKEN,key:process.env.VYNEX_CLOUD_SECRET}),sdkImpl}={}){
 return async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  try{
   const url=new URL(req.url,'https://betwin-three.vercel.app'),path=url.pathname;
   if(path==='/api/liveness')return send(200,{ok:true});
   if(!['GET','HEAD','POST'].includes(req.method))return send(405,{error:'Método não permitido.'});
   const origins=new Set([new URL(process.env.VYNEX_PUBLIC_URL||'https://betwin-three.vercel.app').origin,...(process.env.VERCEL_URL?['https://'+process.env.VERCEL_URL]:[])]);
   if(req.headers.origin&&!origins.has(req.headers.origin))return send(403,{error:'Origem não autorizada.'});
   let body=req.body;if(req.method==='POST'&&body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1048576)return send(413,{error:'Dados excedem o limite.'});}body=raw?JSON.parse(raw):{};}if(typeof body==='string')body=JSON.parse(body);body??={};
   if(path==='/api/cloud/agent'){
    const supplied=digest(String(req.headers.authorization||'').replace(/^Bearer /,'')),expected=process.env.VYNEX_AGENT_HASH||'';
    if(expected.length!==64||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return send(401,{error:'Agente não autorizado.'});
    if(req.method==='GET'){const {data}=await store.read();return send(200,{commands:(data.commands||[]).filter(c=>c.status==='queued').map(({id,path,body})=>({id,path,body}))});}
    const result=await store.transaction(async data=>{
     if(body.claim){const c=data.commands?.find(c=>c.id===body.claim);if(!c||c.status!=='queued')return {claimed:false};c.status='running';c.startedAt=new Date().toISOString();return {claimed:true,command:{id:c.id,path:c.path,body:c.body}};}
     if(body.complete){const c=data.commands?.find(c=>c.id===body.complete);if(c?.status==='running'){c.status=body.ok?'completed':'failed';c.message=String(body.message||'').slice(0,1000);c.finishedAt=new Date().toISOString();delete c.body;}}
     if(body.snapshot){data.snapshots=body.snapshot;data.syncedAt=new Date().toISOString();}
     if(body.media)data.media={...data.media,...body.media};
     data.commands=(data.commands||[]).filter(c=>!c.finishedAt||Date.now()-Date.parse(c.finishedAt)<7*86400000);
     return {ok:true};
    });return send(200,result);
   }
   if(path.startsWith('/api/auth/')&&req.method==='POST'){
    const result=await store.transaction(async data=>{const runtime=await createRuntime(data);try{const result=await runtime.invoke({path,method:req.method,headers:req.headers,body,ip:req.headers['x-forwarded-for']?.split(',')[0]||'cloud'});await runtime.capture();return result;}finally{await runtime.close();}});
    res.writeHead(result.status,result.headers);return res.end(result.body);
   }
   const {data}=await store.read(),runtime=await createRuntime(data);
   try{
    if(path==='/api/auth/status'){const result=await runtime.invoke({path,headers:req.headers});res.writeHead(result.status,result.headers);return res.end(result.body);}
    const user=runtime.api.auth.user(req),publicMedia=/^\/api\/explainers\/media\/[a-f0-9]{48}\.mp4$/.test(path)&&data.media?.[path]?.public===true;
    if(!user&&!publicMedia)return send(401,{error:'Entre na sua conta para acessar o Vynex.',code:'AUTH_REQUIRED'});
    if(req.method==='POST'){
     if(!allowed.has(path.slice(5)))return send(404,{error:'Operação não disponível.'});
     const id=randomUUID();await store.transaction(async fresh=>{fresh.commands??=[];if(fresh.commands.filter(c=>['queued','running'].includes(c.status)).length>=30)throw Object.assign(Error('Aguarde a fila de operações atual.'),{status:409});fresh.commands.push({id,path,body,status:'queued',createdAt:new Date().toISOString()});});
     return send(202,{queued:true,commandId:id,message:'Solicitação salva. O agente do computador executará na próxima sincronização (até 10 minutos com o Vynex aberto).'});
    }
    if(path==='/api/cloud/status')return send(200,{syncedAt:data.syncedAt,commands:(data.commands||[]).map(({body,...c})=>c),mode:'local-agent',intervalMinutes:10});
    if(data.snapshots?.[path]!==undefined)return send(200,data.snapshots[path]);
    const media=data.media?.[path];if(media){const lib=sdkImpl||await import('@vercel/blob'),validUntil=Date.now()+15*60000,signed=await lib.issueSignedToken({pathname:media.pathname,operations:['get','head'],validUntil,token:process.env.BLOB_READ_WRITE_TOKEN});const {presignedUrl}=await lib.presignUrl(signed,{pathname:media.pathname,access:'private',operation:req.method==='HEAD'?'head':'get',validUntil});res.writeHead(307,{Location:presignedUrl,'Cache-Control':'no-store'});return res.end();}
    if(path.includes('/oauth/pinterest/'))return send(409,{error:'Conclua o OAuth no Vynex do computador. A conexão será exibida aqui após sincronizar.'});
    return send(404,{error:'Arquivo ou operação não encontrado.'});
   }finally{await runtime.close();}
  }catch(e){console.error('Betwin API:',e.name,e.status||'');return send(e.status||503,{error:e.status?e.message:'Não foi possível concluir a operação. Atualize o painel antes de tentar novamente.'});}
 };
}
export default createCloudHandler();
