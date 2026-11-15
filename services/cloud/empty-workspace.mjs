import {studioSettings,seasonalCampaigns,niches,validateStudio} from '../shopee-official/planning.mjs';
export function emptyWorkspace(){
 const connections=platforms=>({focus:platforms,buffer:{configured:false,verified:false,channels:[],message:null},platforms:platforms.map(platform=>({platform,connected:false,selectedChannelId:null,channelName:null,provider:'buffer',connectionState:'not_connected',automaticPublication:false})),youtubeDirect:{connected:false}});
 const gta={enabled:false,dailyVideos:3,times:{youtube:['09:00','13:00','19:00'],instagram:['09:00','13:00','19:00'],tiktok:['09:00','13:00','19:00']},language:'pt-BR',requireDubbing:true,running:false,prepared:0,remainingSources:0,lastError:null,computerMustStayOn:true,connections:connections(['youtube','instagram','tiktok'])};
 const studio=studioSettings(),shopee={version:1,criteria:{keyword:studio.keyword,minPrice:0,maxPrice:500,minCommissionPercent:1,minRating:4.5,onlyAvailable:false,category:''},config:{enabled:false,dailyLimit:3,times:studio.times,timezone:'America/Sao_Paulo'},connections:{},products:[],drafts:[],queue:[],tests:{},reports:[],audit:[],studio,campaigns:seasonalCampaigns(new Date(),studio),niches,shopee:{credentialsSaved:false,verified:false},busy:false,productionRunning:false,testGatePassed:false,capabilities:{shopeeVideoPublishing:false,pinterestOAuth:false},commissions:{approved:null,paid:null,status:'not_available_from_validated_offer_api'}};
 return {snapshots:{'/api/status':{projects:['shopee','gta6'],shopeeBuffer:connections(['pinterest']),gta,publicationRequiresApproval:true},'/api/shopee-official/status':shopee,'/api/gta6/automation':gta,'/api/gta6/jobs':{jobs:[]},'/gta6/catalog.json':{clips:[],automation:gta,publicationStatus:'not_configured'}},media:{},commands:[],syncedAt:null};
}
export function accountSettings(data,path,input){
 const s=data.snapshots['/api/shopee-official/status'],g=data.snapshots['/api/status'].gta;
 if(path==='/api/shopee-official/studio-configure'){if(input.generationEnabled===true)throw Object.assign(Error('Conecte um agente de produção desta conta antes de ativar a geração.'),{status:409});try{s.studio=validateStudio(input,s.studio);}catch(e){throw Object.assign(e,{status:400});}s.criteria.keyword=s.studio.keyword;s.campaigns=seasonalCampaigns(new Date(),s.studio);return true;}
 if(path==='/api/gta6/configure'){
  if(!Number.isInteger(input.dailyVideos)||input.dailyVideos<1||input.dailyVideos>3||!Array.isArray(input.times)||input.times.length!==input.dailyVideos||new Set(input.times).size!==input.times.length||input.times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||typeof input.enabled!=='boolean')throw Object.assign(Error('Escolha de 1 a 3 vídeos e horários válidos.'),{status:400});
  if(input.enabled)throw Object.assign(Error('Conecte um agente de produção desta conta antes de ativar a geração.'),{status:409});
  g.dailyVideos=input.dailyVideos;g.times=Object.fromEntries(['youtube','instagram','tiktok'].map(p=>[p,[...input.times]]));data.snapshots['/api/gta6/automation']=g;return true;
 }
 if(path==='/api/shopee-official/campaign'){const event=seasonalCampaigns(new Date(),s.studio).find(e=>e.key===input.key);if(input.key!==null&&!event)throw Object.assign(Error('Campanha inválida.'),{status:400});s.studio.activeCampaign=event?{key:event.key,name:event.name,date:event.date}:null;s.campaigns=seasonalCampaigns(new Date(),s.studio);return true;}
 return false;
}
