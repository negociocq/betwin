import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {dayAt,localSlot} from '../explainer/schedule.mjs';
import {dubGta6Clip} from './gta6-dubbing.mjs';

export const GTA6_CONFIG='gta6-automation';
const sourcePage='https://www.rockstargames.com/VI/an-extended-look';
const sourceUrl='https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_An_Extended_Look/GTAVI_An_Extended_Look.mp4';
const seeds=[
 {key:'official-jason-lucia',name:'gta6-01-jason-lucia',title:'Jason e Lucia: uma dupla, muita tensão',duration:28,sourcePage},
 {key:'official-vice-city',name:'gta6-02-vice-city',title:'Um passeio por Vice City em GTA VI',duration:18,sourcePage},
 {key:'official-launch-action',name:'gta6-melhores-momentos-vertical',title:'GTA VI: o caos de Vice City',duration:28,sourcePage:'https://www.rockstargames.com/VI/media/videos'},
];
export const gta6Sources=[...seeds,...Array.from({length:48},(_,i)=>90+i*30).filter(start=>![300,600,900].includes(start)).map(start=>({key:'official-extended-'+start,start,duration:24,sourceUrl,sourcePage,title:'GTA VI: momentos de Vice City #'+(start/30)}))];
function command(file,args){return new Promise((accept,reject)=>{const child=spawn(file,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let error='';const timer=setTimeout(()=>child.kill(),240000);child.stderr.on('data',c=>{error=(error+c).slice(-2500);});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);code===0?accept():reject(Error(error||'Tempo esgotado ao preparar vídeo'));});});}
async function json(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
export async function produceGta6Clip(source,{day,index,root=resolve('.'),requireDubbing=false}){
 const folder=resolve(root,'output/gta6-corte');await mkdir(folder,{recursive:true});
 const name=source.name||`gta6-auto-${day}-${index+1}-${source.start}`,file=resolve(folder,name+'.mp4'),poster=resolve(folder,name+'.jpg');
 const ffmpeg=resolve(root,'.tools/ffmpeg/bin/ffmpeg.exe');
 if(!source.name){
  const template=await readFile(resolve(folder,'vertical.filter'),'utf8');
  const filter=template.replace('O CAOS DE VICE CITY','VIELA GTA').replace('Carros, planos e confusao.','Qual detalhe voce percebeu?').replace('A tensao so aumenta.','Vice City em cada detalhe.').replace('Trecho do trailer oficial - Rockstar Games','Imagens oficiais - Rockstar Games');
  const filterFile=resolve(folder,name+'.filter');await writeFile(filterFile,filter);
  await command(ffmpeg,['-hide_banner','-loglevel','error','-rw_timeout','30000000','-ss',String(source.start),'-i',source.sourceUrl,'-t',String(source.duration),'-/filter_complex',filterFile,'-map','[v]','-map','0:a:0','-c:v','libx264','-preset','veryfast','-crf','21','-threads','4','-c:a','aac','-b:a','192k','-movflags','+faststart','-y',file]);
 }
 await command(ffmpeg,['-hide_banner','-loglevel','error','-i',file,'-t',String(source.duration),'-f','null','-']);
 // Verify duration and dimensions from the actual encoded stream before approval.
 const probe=await new Promise((accept,reject)=>{const p=spawn(resolve(root,'.tools/ffmpeg/bin/ffprobe.exe'),['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',file],{windowsHide:true});let out='';p.stdout.on('data',c=>out+=c);p.once('error',reject);p.once('exit',code=>{try{if(code)throw Error('Falha no ffprobe');accept(JSON.parse(out));}catch(e){reject(e);}});});
 if(Math.abs(Number(probe.format.duration)-source.duration)>.15||!probe.streams.some(s=>s.codec_type==='video'&&s.width===1080&&s.height===1920)||!probe.streams.some(s=>s.codec_type==='audio'))throw Error('O vídeo não passou pela validação de duração, imagem e áudio.');
 let finalFile=file,finalName=name,finalPoster=poster,dubbing=null;
 if(requireDubbing){const dubbed=await dubGta6Clip({file,folder:resolve(folder,name+'-dubbing'),duration:source.duration});finalName=name+'-ptbr';finalFile=resolve(folder,finalName+'.mp4');finalPoster=resolve(folder,finalName+'.jpg');await copyFile(dubbed.file,finalFile);dubbing=dubbed.report;}
 await command(ffmpeg,['-hide_banner','-loglevel','error','-ss','3','-i',finalFile,'-frames:v','1','-vf','scale=540:960','-y',finalPoster]);
 const sha256=createHash('sha256').update(await readFile(finalFile)).digest('hex');
 return {file:finalFile,poster:finalPoster,name:finalName,duration:source.duration,bytes:(await stat(finalFile)).size,sha256,title:source.title,sourcePage:source.sourcePage,language:dubbing?'pt-BR':'en',dubbingVerified:dubbing?.verified===true,dubbing};
}
export function createGta6Automation({store,produce=produceGta6Clip,clock=()=>new Date(),timerEnabled=true,root=resolve('.')}={}){
 let running=false,closed=false,timer,attemptedSource=null;
 const config=()=>store.get(GTA6_CONFIG,'integrations');
 const jobs=()=>store.list('explainer-job').filter(j=>j.gta6Automation===true);
 async function status(){const c=config();return {enabled:c?.enabled===true,dailyVideos:c?.dailyVideos||3,timezone:'America/Sao_Paulo',times:c?.times||{},synchronized:c?.synchronized===true,language:c?.language||null,requireDubbing:c?.requireDubbing===true,sourceMode:'official-footage',streamerDiscoveryEnabled:false,computerMustStayOn:true,running,prepared:jobs().length,remainingSources:gta6Sources.filter(s=>!jobs().some(j=>j.sourceKey===s.key)).length,lastError:c?.lastError||null,lastPreparedDay:c?.lastPreparedDay||null};}
 async function snapshot(){await mkdir(resolve(root,'output/gta6-corte'),{recursive:true});await writeFile(resolve(root,'output/gta6-corte/automation-status.json'),JSON.stringify(await status(),null,2));}
 async function tick(){
  if(running||closed||!config()?.enabled)return;running=true;
  try{
   await mkdir(resolve(root,'output/gta6-corte'),{recursive:true});
   const c=config(),now=clock();if(Date.parse(c.retryAt)>+now)return;
   const today=dayAt(now),tomorrow=dayAt(new Date(localSlot(today,'12:00')+86400000));
   // Keep one day prepared ahead. Never replay missed days or recycle a published source.
   const target=c.firstDay>tomorrow?c.firstDay:tomorrow;
   const prepared=jobs().filter(j=>j.gta6Day===target);
   for(let index=prepared.length;index<c.dailyVideos&&!closed;index++){
    const source=gta6Sources.find(s=>!config().skippedSources?.includes(s.key)&&!jobs().some(j=>j.sourceKey===s.key));attemptedSource=source;
    if(!source)throw Error('Estoque de trechos oficiais esgotado. Adicione novas fontes antes das próximas publicações.');
    const artifact=await produce(source,{day:target,index,root,requireDubbing:c.requireDubbing===true});
    if(c.requireDubbing&&(artifact.language!=='pt-BR'||artifact.dubbingVerified!==true))throw Error('Dublagem em português não validada; nenhum vídeo será liberado.');
    if(jobs().some(j=>j.validation?.sha256===artifact.sha256))throw Error('Vídeo repetido detectado; publicação bloqueada.');
    const id=randomUUID(),folder=resolve(root,'storage/explainers',id);await mkdir(folder,{recursive:true});
    await copyFile(artifact.file,resolve(folder,'video.mp4'));await copyFile(artifact.poster,resolve(folder,'poster.jpg'));
    const validation={passed:true,sha256:artifact.sha256,bytes:artifact.bytes,duration:artifact.duration,width:1080,height:1920,language:artifact.language,dubbingVerified:artifact.dubbingVerified===true,checkedAt:clock().toISOString()};
    const recipe={id:source.key,title:artifact.title,renderer:'external-gameplay',sources:[artifact.sourcePage]};
    const description=`${artifact.title}\n\n${artifact.dubbingVerified?'Versão dublada em português brasileiro.\n':''}Qual momento você quer ver por aqui? Siga @vielagta para acompanhar os próximos cortes.\n\nImagens oficiais da Rockstar Games. Fonte: ${artifact.sourcePage}\n#GTA6 #GTAVI #VielaGTA #ViceCity`;
    await writeFile(resolve(folder,'validation.json'),JSON.stringify(validation));await writeFile(resolve(folder,'recipe.json'),JSON.stringify(recipe));
    store.put('explainer-job',{id,title:artifact.title,topicId:source.key,recipe,validation,status:'ready',stage:'ready',progress:100,day:target,gta6Day:target,gta6Automation:true,sourceKey:source.key,generationOrigin:'manual',approved:true,approvalSource:'user-authorized-three-daily-vielagta',approvedAt:clock().toISOString(),reviewBeforePublish:false,madeForKids:false,isAiGenerated:artifact.dubbingVerified===true,language:artifact.language,dubbingStatus:artifact.dubbingVerified?'verified':'not_required',targets:['youtube','instagram','tiktok'],deliveries:{},publicationDescription:description,publicationNotBefore:new Date(localSlot(target,'00:00')).toISOString(),mediaToken:randomBytes(24).toString('hex'),provenance:'vielagta-daily',message:'Corte GTA validado para a programação diária.'});
    const manifestFile=resolve(root,'output/gta6-corte/gta6-automation-clips.json');const manifest=await json(manifestFile,{clips:[]});
    if(!source.name||artifact.dubbingVerified)manifest.clips.push({id:artifact.name,title:artifact.title,duration:artifact.duration,file:artifact.file,sourcePage:artifact.sourcePage,day:target,jobId:id,language:artifact.language});await writeFile(manifestFile,JSON.stringify(manifest,null,2));
   }
   store.put('integrations',{...config(),id:GTA6_CONFIG,lastPreparedDay:[config().lastPreparedDay,target].filter(Boolean).sort().at(-1),lastError:null,retryAt:null,checkedAt:clock().toISOString()});
   // Retry only proven refusals without a remote receipt, with bounded backoff.
   for(const job of jobs())for(const [platform,d]of Object.entries(job.deliveries||{}))if(d.status==='rejected'&&!d.remoteId&&(job.gta6RetryCounts?.[platform]||0)<3&&Date.parse(d.attemptedAt||job.updatedAt)<+now-15*60000){const fresh=store.get(job.id,'explainer-job');store.put('explainer-job',{...fresh,gta6RetryCounts:{...fresh.gta6RetryCounts,[platform]:(fresh.gta6RetryCounts?.[platform]||0)+1},deliveries:{...fresh.deliveries,[platform]:{...d,status:'waiting_setup'}}});}
  }catch(e){const skipped=e.code==='SOURCE_UNCLEAR'&&attemptedSource?{skippedSources:[...new Set([...(config().skippedSources||[]),attemptedSource.key])]}:{};store.put('integrations',{...config(),...skipped,id:GTA6_CONFIG,lastError:String(e.message).slice(0,500),retryAt:new Date(+clock()+15*60000).toISOString()});}
  finally{running=false;await snapshot();}
 }
 if(timerEnabled){timer=setInterval(()=>tick().catch(()=>{}),60000);timer.unref();}
 return {tick,status,async close(){closed=true;clearInterval(timer);while(running)await new Promise(r=>setTimeout(r,100));}};
}
