import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonalCampaigns,searchKeyword,validateStudio} from '../services/shopee-official/planning.mjs';
import {createShopeeProduction} from '../services/shopee-official/production.mjs';
const now=new Date('2026-11-15T15:00:00Z');
test('manual generation creates exactly one new video even after the daily batch quota, with observable stages',async()=>{
 const f=fixture(),seen=[];const original=f.state.change;f.state.change=async fn=>original(s=>{const result=fn(s);if(s.production?.progress)seen.push(s.production.progress.step);return result;});
 try{await f.service.run();await f.state.change(s=>s.products.push({itemId:'4',name:'Novo produto',eligible:true}));await f.service.run({manualOne:true});const s=await f.state.read();assert.equal(s.drafts.length,4);assert.equal(s.drafts[3].product.itemId,'4');assert.equal(s.production.generated,1);assert.equal(s.production.progress.status,'completed');assert.ok(seen.includes('buscando'));assert.ok(seen.includes('selecionando'));assert.ok(seen.includes('renderizando'));assert.ok(s.drafts.every(d=>!d.approval));}finally{await f.service.close();}
});
function fixture(){let data={criteria:{keyword:'cozinha'},drafts:[],products:[1,2,3].map(n=>({itemId:String(n),eligible:true}))};let calls=0;const state={read:async()=>structuredClone(data),change:async f=>f(data)};const center={status:async()=>state.read(),discover:async()=>{calls++;},createDraft:async({itemId})=>{data.drafts.push({id:itemId,product:{itemId},createdAt:now.toISOString(),approval:null,status:'awaiting_approval'});}};return {state,service:createShopeeProduction({state,center,clock:()=>now,timerEnabled:false}),calls:()=>calls};}
test('seasonal suggestions respect Brazilian dates, configurable lead times, and local midnight',()=>{
 const list=seasonalCampaigns(now),christmas=list.find(c=>c.id==='natal'),blackFriday=list.find(c=>c.id==='blackfriday');assert.equal(christmas.startsAt,'2026-11-10');assert.equal(christmas.recommended,true);assert.equal(blackFriday.date,'2026-11-27');assert.equal(seasonalCampaigns(new Date('2026-11-10T01:00:00Z')).find(c=>c.id==='natal').recommended,false);assert.equal(seasonalCampaigns(now,{leadDays:{natal:7}}).find(c=>c.id==='natal').recommended,false);assert.equal(seasonalCampaigns(now,{seasonalEnabled:false}).some(c=>c.recommended),false);
});
test('campaign activation changes discovery only after an explicit action, and expires after the event',async()=>{
 const f=fixture();try{await f.service.configure({keyword:'cozinha'});let s=await f.state.read();assert.equal(searchKeyword(s,now),'cozinha');await f.service.campaign({key:'natal-2026-12-25'});s=await f.state.read();assert.equal(searchKeyword(s,now),'natal cozinha');assert.equal(searchKeyword(s,new Date('2026-12-26T15:00:00Z')),'cozinha');await f.service.campaign({key:null});assert.equal(searchKeyword(await f.state.read(),now),'cozinha');await assert.rejects(f.service.campaign({key:'not-a-campaign'}));}finally{await f.service.close();}
});
test('daily production respects the configured quota and never approves or publishes generated drafts',async()=>{
 const f=fixture();try{await f.service.configure({dailyVideos:2,times:['10:00','16:00']});await f.service.run();await f.service.run();const s=await f.state.read();assert.equal(s.drafts.length,2);assert.ok(s.drafts.every(d=>d.approval===null&&d.status==='awaiting_approval'));assert.equal(f.calls(),1);assert.match(s.production.message,/meta/);}finally{await f.service.close();}
});
test('production excludes existing products and reports when no new offer is eligible',async()=>{
 const f=fixture();try{await f.state.change(s=>{s.drafts=s.products.map(p=>({id:p.itemId,product:p,createdAt:'2026-11-14T15:00:00Z'}));});await f.service.run();const s=await f.state.read();assert.equal(s.drafts.length,3);assert.match(s.production.message,/Nenhum produto inédito/);}finally{await f.service.close();}
});
test('invalid quotas, times, niches and lead times are rejected without mutating settings',()=>{
 for(const input of [{dailyVideos:20},{times:['10:00','10:00','19:00']},{niche:'invalid'},{leadDays:{natal:1}},{generationEnabled:'yes'}])assert.throws(()=>validateStudio(input));
});
test('automatic generation remains inactive until explicitly enabled',async()=>{
 const f=fixture();try{await f.service.run({automatic:true});assert.equal(f.calls(),0);assert.equal((await f.state.read()).drafts.length,0);}finally{await f.service.close();}
});
