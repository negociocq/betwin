import {createShopeeProduction} from './production.mjs';
import {createAffiliateCenter} from './engine.mjs';
import {createShopeeAffiliate} from '../social/shopee-affiliate.mjs';
import {createVault} from '../youtube/vault.mjs';
import {resolve} from 'node:path';
import {createAffiliateState} from './state.mjs';
import {serveFile} from '../media/serve.mjs';
export function createShopeeOfficialHttp({store,directory=resolve('data'),timerEnabled=true}={}){
 const api=createShopeeAffiliate({store,vault:createVault(resolve(directory,'social-projects/shopee/integrations'),'shopee-affiliate')});
 // Reuse the query already validated on this account; do not presume optional sorting permissions.
 const shopee={status:api.status,verify:api.verify,offers:async keyword=>(await api.search({keyword})).results};
 const state=createAffiliateState(resolve(directory,'shopee-official'));
 const center=createAffiliateCenter({shopee,state,timerEnabled});
 const production=createShopeeProduction({state,center,timerEnabled});
 async function handle(req,res,path,input={}){
  if(!path.startsWith('/api/shopee-official/'))return false;
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));return true;};
  try{
   const route=path.slice('/api/shopee-official/'.length),oauth=route.match(/^oauth\/pinterest\/(start|callback)$/);
   if(req.method==='GET'&&oauth){if((await center.status()).busy)throw Error('Aguarde o envio antes de alterar a conexão.');if(oauth[1]==='start'){res.writeHead(302,{Location:await center.provider.start(),'Cache-Control':'no-store'});res.end();return true;}await center.provider.callback(new URL(req.url,'http://localhost').searchParams);res.writeHead(302,{Location:'/shopee-afiliados.html?connected=pinterest','Cache-Control':'no-store'});res.end();return true;}
   const file=route.match(/^artifacts\/([a-f0-9-]{36})\/(pin|video)$/);if(['GET','HEAD'].includes(req.method)&&file){const a=await center.artifact(file[1],file[2]);await serveFile(req,res,a,file[2]+(file[2]==='pin'?'.png':'.mp4'),a.file);return true;}
   if(req.method==='GET'&&route==='status')return send(200,{...await center.status(),productionRunning:production.isRunning()});
   if(req.method!=='POST')return send(405,{error:'Método não permitido.'});
   if(['pinterest-client','verify-pinterest'].includes(route)&&(await center.status()).busy)throw Error('Aguarde a operação em andamento antes de alterar a conexão.');
   const actions={'studio-configure':()=>production.configure(input),'campaign':()=>production.campaign(input),'production-run':()=>production.run(),configure:()=>center.configure(input),'verify-shopee':()=>center.verifyShopee(),discover:()=>center.discover(),draft:()=>center.createDraft(input),approve:()=>center.approve(input),plan:()=>center.plan(input),'test-pinterest':()=>{if(input.confirm!==true)throw Error('Confirme o teste deste conteúdo e pasta.');return center.publish(input.id,{test:true});},'pinterest-client':async()=>{await center.provider.saveClient(input);return center.status();},'verify-pinterest':async()=>{await center.provider.verify();return center.status();},reports:()=>center.refreshReports(),cancel:()=>center.cancel(input.id)};
   if(!actions[route])return send(404,{error:'Operação Shopee não encontrada.'});return send(200,await actions[route]());
  }catch(e){return send(400,{error:e.message});}
 }
 return {handle,center,close:async()=>{await production.close();await center.close();}};
}
