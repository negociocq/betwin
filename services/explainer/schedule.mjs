import {createHash} from 'node:crypto';
export const PLATFORMS=['youtube','tiktok','instagram'];
export const ZONE='America/Sao_Paulo';
export const dayAt=d=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const clocks={youtube:['10:20','18:30'],tiktok:['11:35','19:45'],instagram:['12:50','20:55']};
export function channelDefaults(platform,enabled=false){return {enabled,dailyLimit:2,times:[...clocks[platform]],jitterMinutes:8,commentText:platform==='youtube'?'Gostou? Deixe o like e inscreva-se para descobrir como as coisas funcionam!':'Gostou? Curta e siga para descobrir como as coisas funcionam!',commentMode:'manual'};}
export function channelsFor(config){return Object.fromEntries(PLATFORMS.map(p=>[p,{...channelDefaults(p,config.enabled&&config.platforms.includes(p)),...config.channels?.[p]}]));}
export function validateChannel(platform,input,current=channelDefaults(platform)){
 if(!PLATFORMS.includes(platform)||!input||Array.isArray(input)||Object.keys(input).some(k=>!['enabled','dailyLimit','times','jitterMinutes','commentText','commentMode'].includes(k)))throw Error('Configuração do canal inválida.');
 const c={...current,...input};
 if(typeof c.enabled!=='boolean'||!Number.isInteger(c.dailyLimit)||c.dailyLimit<1||c.dailyLimit>4)throw Error('Defina de 1 a 4 publicações por dia.');
 if(!Array.isArray(c.times)||c.times.length<c.dailyLimit||c.times.length>4||new Set(c.times).size!==c.times.length||c.times.some(t=>typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('Informe um horário HH:MM diferente para cada publicação diária.');
 if(!Number.isInteger(c.jitterMinutes)||c.jitterMinutes<0||c.jitterMinutes>15)throw Error('A variação de horário deve ficar entre 0 e 15 minutos.');
 if(typeof c.commentText!=='string'||c.commentText.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(c.commentText))throw Error('O comentário deve ter até 500 caracteres.');
 if(!['manual','first_comment'].includes(c.commentMode)||c.commentMode==='first_comment'&&platform!=='instagram')throw Error('Primeiro comentário automático está disponível somente para Instagram nesta integração.');
 if(c.commentMode==='first_comment'&&!c.commentText.trim())throw Error('Escreva o primeiro comentário antes de ativá-lo.');
 c.times=[...c.times].sort();c.commentText=c.commentText.trim();return c;
}
// Convert wall-clock time with IANA timezone data, rather than assuming UTC-3 forever.
export function localSlot(day,time){
 const [year,month,date]=day.split('-').map(Number),[hour,minute]=time.split(':').map(Number);const target=Date.UTC(year,month-1,date,hour,minute);let guess=target;
 for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));const represented=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);guess+=target-represented;}
 return guess;
}
export function settingsForDay(platform,settings,day,dayOverrides={}){
 const override=dayOverrides[day]?.[platform];
 return override?validateChannel(platform,override,settings):settings;
}
export function chooseSlot({platform,settings,jobId,jobs,now,gapMinutes=30,notBefore=null,dayOverrides={},catchUpMissed=false,synchronizePlatforms=false}){
 const reservations=[];
 for(const j of jobs)for(const [p,d]of Object.entries(j.deliveries||{})){if(synchronizePlatforms&&p!==platform)continue;if(d.status==='cancelled'||d.status==='rejected'&&!d.remoteId)continue;const at=Date.parse(d.status==='published'?(d.publishedAt||d.dueAt||d.plannedAt||d.attemptedAt):(d.dueAt||d.plannedAt));if(Number.isFinite(at))reservations.push({platform:p,at,eligible:!catchUpMissed||j.approved!==false,baseTime:d.schedule?.baseTime,localDay:d.status==='published'?dayAt(new Date(at)):d.schedule?.localDay});}
 const first=dayAt(now),base=Date.parse(first+'T12:00:00Z'),requested=notBefore===null?0:Date.parse(notBefore);if(!Number.isFinite(requested))throw Error('Data de publicação inválida.');const minimum=Math.max(now.getTime()+5*60000,requested);
 for(let offset=0;offset<14;offset++){
  const day=dayAt(new Date(base+offset*86400000)),daySettings=settingsForDay(platform,settings,day,dayOverrides),rows=reservations.filter(r=>r.eligible&&r.platform===platform&&dayAt(new Date(r.at))===day);if(rows.length>=daySettings.dailyLimit)continue;
  const occupied=new Set(rows.filter(r=>r.baseTime&&r.localDay===day).map(r=>r.baseTime));
  if(catchUpMissed)for(const row of rows.filter(r=>!r.baseTime).sort((a,b)=>a.at-b.at)){const time=daySettings.times.find(t=>!occupied.has(t));if(time)occupied.add(time);}
  for(const time of daySettings.times.slice(0,daySettings.dailyLimit)){
   if(occupied.has(time))continue;
   const jitter=createHash('sha256').update(jobId+'|'+platform+'|'+day+'|'+time).digest().readUInt32BE(0)%(daySettings.jitterMinutes+1);let at=localSlot(day,time)+jitter*60000;if(at<minimum){if(catchUpMissed&&offset===0&&minimum<=localSlot(day,'23:59'))at=minimum;else continue;}
   // Keep a real gap even if users choose overlapping windows for different networks.
   for(let i=0;i<reservations.length+1;i++){const conflict=reservations.find(r=>Math.abs(r.at-at)<gapMinutes*60000);if(!conflict)break;at=conflict.at+gapMinutes*60000;}
   if(dayAt(new Date(at))!==day)continue;
   if(reservations.some(r=>Math.abs(r.at-at)<gapMinutes*60000))continue;
   return {dueAt:new Date(at).toISOString(),localDay:day,baseTime:time,jitterMinutes:jitter,minimumGapMinutes:gapMinutes};
  }
 }
 return null;
}
