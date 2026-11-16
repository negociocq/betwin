import {dayAt} from '../explainer/schedule.mjs';
import {studioSettings,validateStudio,seasonalCampaigns} from './planning.mjs';
import {randomUUID} from 'node:crypto';
export function createShopeeProduction({state,center,clock=()=>new Date(),timerEnabled=true}){
 let running=false,closed=false;
 async function configure(input){if(running)throw Error('Aguarde o lote terminar para alterar a produção.');await state.change(s=>{s.studio=validateStudio(input,s.studio);s.criteria.keyword=s.studio.keyword;});return center.status();}
 async function campaign(input){if(running)throw Error('Aguarde o lote terminar.');await state.change(s=>{s.studio=studioSettings(s.studio);if(input.key===null){s.studio.activeCampaign=null;return;}const event=seasonalCampaigns(clock(),s.studio).find(e=>e.key===input.key);if(!event)throw Error('Campanha inválida ou encerrada.');s.studio.activeCampaign={key:event.key,name:event.name,date:event.date};});return center.status();}
 async function run({automatic=false,manualOne=false}={}){
  if(closed||running)throw Error('Uma geração já está em andamento.');running=true;let generated=0;const runId=randomUUID(),startedAt=clock().toISOString();
  const progress=async(step,message,status='running')=>state.change(x=>{x.production={...x.production,progress:{runId,step,message,status,generated,startedAt,updatedAt:clock().toISOString()}};});
  try{
   let s=await state.read();const c=studioSettings(s.studio);if(automatic&&!c.generationEnabled)return;
   await progress('preparando','Preparando a geração.');const today=dayAt(clock()),count=s.drafts.filter(d=>dayAt(new Date(d.createdAt))===today).length,remaining=manualOne?1:Math.max(0,c.dailyVideos-count);
   if(!remaining){await progress('concluido','A meta de vídeos de hoje já foi atingida.','completed');await state.change(x=>{x.production={...x.production,lastRunAt:clock().toISOString(),message:'A meta de vídeos de hoje já foi atingida.',generated:0,error:null};});return center.status();}
   await progress('buscando','Buscando ofertas reais na Shopee.');await center.discover();s=await state.read();await progress('selecionando','Selecionando produtos elegíveis e inéditos.');
   const options=s.products.filter(p=>p.eligible&&!s.drafts.some(d=>d.product.itemId===p.itemId&&!d.archived)).slice(0,remaining);
   for(const p of options){if(closed)break;await progress('renderizando','Criando o vídeo de '+p.name+'.');await center.createDraft({itemId:p.itemId},{progress});generated++;}
   const message=generated?`${generated} vídeo(s) gerado(s), aguardando revisão.`:'Nenhum produto inédito passou pelos filtros. Ajuste a busca ou o nicho.';
   await progress(generated?'concluido':'sem_produtos',message,generated?'completed':'blocked');await state.change(x=>{x.production={...x.production,lastRunAt:clock().toISOString(),lastDay:today,generated,message,error:null};});return center.status();
  }catch(e){await progress('erro',String(e.message).slice(0,300),'failed');await state.change(x=>{x.production={...x.production,lastRunAt:clock().toISOString(),generated,error:String(e.message).slice(0,300),message:'Não foi possível concluir a geração. Os vídeos já criados foram preservados.'};});throw e;}finally{running=false;}
 }
 async function tick(){if(closed||running)return;const s=await state.read();if(!studioSettings(s.studio).generationEnabled)return;if(s.production?.lastRunAt&&+clock()-Date.parse(s.production.lastRunAt)<3600000)return;await run({automatic:true});}
 const timer=timerEnabled?setInterval(()=>tick().catch(()=>{}),60000):null;timer?.unref();
 return {configure,campaign,run,isRunning:()=>running,async close(){closed=true;clearInterval(timer);while(running)await new Promise(r=>setTimeout(r,100));}};
}
