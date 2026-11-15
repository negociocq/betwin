import {createServer} from 'node:http';
import {resolve,basename} from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {openStore} from './store.mjs';
import {createVault} from '../youtube/vault.mjs';
import {createYouTube} from '../youtube/client.mjs';
import {createSocialAccounts} from '../social/accounts.mjs';
import {createLocalSocialBrowser} from '../social/local-browser.mjs';
import {createBrowserPublisher} from '../social/browser-publisher.mjs';
import {createBufferPublisher} from '../explainer/publisher.mjs';
import {createDirectYouTubePublisher} from '../explainer/youtube-direct.mjs';
import {createGta6Automation} from '../media/gta6-automation.mjs';
import {createGtaDeliveries} from '../media/gta6-deliveries.mjs';
import {createShopeeOfficialHttp} from '../shopee-official/http.mjs';
import {createShopeeAffiliate} from '../social/shopee-affiliate.mjs';
import {serveFile} from '../media/serve.mjs';
import {validateChannel} from '../explainer/schedule.mjs';
import {createAuth} from './auth.mjs';
export function createApi({directory=resolve('data'),workerEnabled=true}={}){
 const store=openStore(directory),vault=(folder,purpose)=>createVault(resolve(directory,folder),purpose);
 const auth=createAuth({db:store.db});
 const youtube=createYouTube({store,vault:vault('integrations','youtube'),clientVault:vault('integrations','youtube-client')});
 const browser=createLocalSocialBrowser({store,profileDirectory:resolve(directory,'local-publishing/profile')});
 const accounts=createSocialAccounts({directory:resolve(directory,'social-accounts'),vault:vault('integrations','buffer'),youtubeStatus:()=>youtube.status(),browserEnabled:()=>store.get('local-publishing-config','integrations')?.enabled===true,browserOverrides:()=>store.get('local-publishing-config','integrations')?.channelOverrides||{}});
 const shopeeAccounts=createSocialAccounts({directory:resolve(directory,'social-projects/shopee/accounts'),vault:vault('social-projects/shopee/integrations','buffer'),supportedPlatforms:['pinterest']});
 const publisher=createBrowserPublisher({store,accounts,browser,fallback:createDirectYouTubePublisher({youtube,store,buffer:createBufferPublisher({accounts,vault:vault('integrations','buffer')})})});
 const gta=createGta6Automation({store,timerEnabled:workerEnabled}),deliveries=createGtaDeliveries({store,publisher,timerEnabled:workerEnabled});
 const shopee=createShopeeOfficialHttp({store,directory,timerEnabled:workerEnabled});
 const affiliate=createShopeeAffiliate({store,vault:vault('social-projects/shopee/integrations','shopee-affiliate')});
 const status=async()=>({projects:['shopee','gta6'],shopeeBuffer:await shopeeAccounts.status(),gta:{...await gta.status(),connections:await accounts.status()},publicationRequiresApproval:true});
 const server=createServer(async(req,res)=>{
  const send=(code,b)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(b));};
  try{
   const allowedOrigins=new Set(['http://localhost:3001','http://127.0.0.1:3001','http://localhost:8100','http://127.0.0.1:8100',...(process.env.CORS_ORIGINS||'').split(',').filter(Boolean)]);
   if(req.headers.origin&&!allowedOrigins.has(req.headers.origin))return send(403,{error:'Origem não autorizada.'});
   const path=new URL(req.url,'http://localhost').pathname;
   if(req.method==='GET'&&path==='/api/liveness')return send(200,{ok:true,pid:process.pid});
   let input={};if(['POST','PATCH'].includes(req.method)){let body='';for await(const part of req){body+=part;if(body.length>65536)throw Error('Dados excedem o limite.');}input=body?JSON.parse(body):{};}
   if(await auth.handle(req,res,path,input))return;
   const publicMedia=['GET','HEAD'].includes(req.method)&&/^\/api\/explainers\/media\/[a-f0-9]{48}\.mp4$/.test(path);
   const oauthCallback=req.method==='GET'&&path==='/api/shopee-official/oauth/pinterest/callback';
   if(!publicMedia&&!oauthCallback&&!auth.user(req))return send(401,{error:'Entre na sua conta para acessar o Vynex.',code:'AUTH_REQUIRED'});
   if(await shopee.handle(req,res,path,input))return;
   if(req.method==='GET'&&['/api/status','/api/health'].includes(path))return send(200,await status());
   if(req.method==='GET'&&path==='/api/gta6/automation')return send(200,await gta.status());
   if(req.method==='GET'&&path==='/api/gta6/jobs')return send(200,{jobs:store.list('explainer-job').filter(j=>j.gta6Automation).map(({recipe,mediaToken,...j})=>j)});
   const file=path.match(/^\/api\/explainers\/(?:jobs\/([a-f0-9-]{36})\/(video|poster)|media\/([a-f0-9]{48})\.mp4)$/);
   if(file&&['GET','HEAD'].includes(req.method)){const job=store.list('explainer-job').find(j=>j.gta6Automation&&(file[1]?j.id===file[1]:j.mediaToken===file[3]&&j.approved));if(!job?.validation)throw Error('Vídeo GTA indisponível.');const type=file[2]||'video',p=resolve('storage/explainers',job.id,type==='video'?'video.mp4':'poster.jpg');const bytes=(await stat(p)).size;const {createHash}=await import('node:crypto');return serveFile(req,res,{file:p,bytes,mime:type==='video'?'video/mp4':'image/jpeg',sha256:type==='video'?job.validation.sha256:createHash('sha256').update(await readFile(p)).digest('hex')},basename(p),p);}
   if(req.method==='POST'&&path==='/api/shopee/buffer/connect'){await shopeeAccounts.connect(input);return send(200,await status());}
   if(req.method==='POST'&&path==='/api/shopee/buffer/sync'){await shopeeAccounts.sync();return send(200,await status());}
   if(req.method==='POST'&&path==='/api/shopee/buffer/bind'){await shopeeAccounts.bind(input);return send(200,await status());}
   if(req.method==='POST'&&path==='/api/shopee/credentials'){if(typeof input.appId!=='string'||typeof input.secret!=='string'||input.secret.length<8)throw Error('Informe App ID e Secret Shopee.');await vault('social-projects/shopee/integrations','shopee-affiliate').save({appId:input.appId,secret:input.secret});affiliate.reset();return send(200,{saved:true,verified:false});}
   if(req.method==='POST'&&path==='/api/gta6/pause'){if(typeof input.enabled!=='boolean')throw Error('Informe enabled.');const c=store.get('gta6-automation','integrations');if(!c)throw Error('GTA ainda não configurado.');store.put('integrations',{...c,enabled:input.enabled});return send(200,await gta.status());}
   if(req.method==='POST'&&path==='/api/gta6/buffer/sync'){await accounts.sync();return send(200,await status());}
   if(req.method==='POST'&&path==='/api/gta6/buffer/bind'){
    if(input.platform==='youtube'&&youtube.status().connected)throw Error('O YouTube usa a conexão direta existente. Troque a conta pela autorização oficial antes de selecionar outro canal.');
    await accounts.bind(input);const local=store.get('local-publishing-config','integrations');if(local?.channelOverrides?.[input.platform]){const channelOverrides={...local.channelOverrides};delete channelOverrides[input.platform];store.put('integrations',{...local,channelOverrides});}return send(200,await status());
   }
   if(req.method==='POST'&&path==='/api/gta6/configure'){
    if(Object.keys(input).some(k=>!['dailyVideos','times','enabled'].includes(k))||!Number.isInteger(input.dailyVideos)||input.dailyVideos<1||input.dailyVideos>3||typeof input.enabled!=='boolean')throw Error('Escolha de 1 a 3 vídeos e confirme o estado da preparação.');
    const before=store.get('gta6-automation','integrations');if(!before)throw Error('GTA ainda não configurado.');if((await gta.status()).running)throw Error('Aguarde a preparação atual terminar.');
    const old=store.get('explainer-config','explainer-config');const channels={...old?.channels};for(const p of ['youtube','instagram','tiktok'])channels[p]=validateChannel(p,{dailyLimit:input.dailyVideos,times:input.times,jitterMinutes:0},old?.channels?.[p]);
    store.db.exec('BEGIN IMMEDIATE');try{store.put('integrations',{...before,dailyVideos:input.dailyVideos,times:Object.fromEntries(['youtube','instagram','tiktok'].map(p=>[p,input.times])),enabled:input.enabled,synchronized:true});store.put('explainer-config',{...old,id:'explainer-config',channels});store.db.exec('COMMIT');}catch(e){store.db.exec('ROLLBACK');throw e;}return send(200,await status());
   }
   if(req.method==='POST'&&path==='/api/gta6/buffer/connect'){await accounts.connect(input);return send(200,await status());}
   return send(404,{error:'Este módulo não faz parte do Vynex Shopee + GTA 6.'});
  }catch(e){if(res.headersSent)return res.destroy();send(400,{error:e.message});}
 });
 let closing;return {server,store,auth,close(){return closing||=(async()=>{await shopee.close();await deliveries.close();await gta.close();await browser.close();await new Promise(r=>server.close(r));store.db.close();})();}};
}
