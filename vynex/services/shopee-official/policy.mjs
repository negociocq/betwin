import {createHash} from 'node:crypto';
import {localSlot,dayAt} from '../explainer/schedule.mjs';
export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const number=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
export function criteria(input){
 const c={...input};if(Object.keys(c).some(k=>!['keyword','category','minPrice','maxPrice','minCommissionPercent','minRating','onlyAvailable'].includes(k)))throw Error('Critério desconhecido');
 if(typeof c.keyword!=='string'||c.keyword.length>100||typeof c.category!=='string'||c.category.length>100||typeof c.onlyAvailable!=='boolean')throw Error('Filtros inválidos.');
 for(const k of ['minPrice','maxPrice','minCommissionPercent','minRating'])if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<0)throw Error('Filtros numéricos inválidos.');
 if(c.maxPrice<c.minPrice||c.minCommissionPercent>100||c.minRating>5)throw Error('Intervalo de filtros inválido.');return c;
}
export function normalizeOffer(p){return {...p,itemId:String(p.itemId),priceMin:number(p.priceMin),priceMax:number(p.priceMax),commissionPercent:number(p.commissionRate)===null?null:Number(p.commissionRate)*100,rating:number(p.rating),available:typeof p.available==='boolean'?p.available:null,category:p.category||null,source:'Shopee Affiliate Open API'};}
export function eligible(p,c){return p.affiliateUrl&&p.commissionPercent!==null&&p.commissionPercent>0&&p.commissionPercent>=c.minCommissionPercent&&p.priceMin!==null&&p.priceMin>=c.minPrice&&p.priceMin<=c.maxPrice&&(c.minRating===0||p.rating!==null&&p.rating>=c.minRating)&&(!c.onlyAvailable||p.available===true)&&(!c.category||p.category?.toLocaleLowerCase('pt-BR')===c.category.toLocaleLowerCase('pt-BR'));}
export function affiliateLink(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!['shopee.com.br','www.shopee.com.br','s.shopee.com.br','shope.ee'].includes(u.hostname))throw Error('Link de afiliado fora da Shopee.');return u.href;}
export function schedulePlan({drafts,ids,startDay,times,dailyLimit,now=new Date(),existing=[]}){
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>3||!Array.isArray(times)||times.length!==dailyLimit||new Set(times).size!==times.length||times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('Defina de 1 a 3 horários por dia e selecione conteúdos distintos.');
 const start=new Date(startDay+'T12:00:00-03:00');if(!Number.isFinite(+start)||start.toISOString().slice(0,10)!==startDay||startDay<dayAt(now)||+start>+now+7*86400000)throw Error('Data inválida. Selecione o início da próxima semana de conteúdos.');const days=[];for(let n=0;n<7;n++)days.push(new Date(+start+n*86400000).toISOString().slice(0,10));
 const plan=[];for(const id of ids){const draft=drafts.find(d=>d.id===id);if(!draft?.approval||draft.status==='published')throw Error('A fila aceita somente conteúdos inéditos, selecionados e aprovados.');
  if(existing.some(q=>q.draftId===id&&!['cancelled','rejected'].includes(q.status)))throw Error('Este conteúdo já está na fila.');
  const slot=days.flatMap(day=>[...times].sort().map(time=>({day,time,at:new Date(localSlot(day,time))}))).find(s=>+s.at>+now+60000&&!plan.some(p=>p.dueAt===s.at.toISOString())&&!existing.some(p=>p.dueAt===s.at.toISOString()&&p.status!=='cancelled'));
  if(!slot)throw Error('Os selecionados não cabem na janela de sete dias.');plan.push({draftId:id,dueAt:slot.at.toISOString(),day:slot.day,time:slot.time});
 }return plan;
}
export function assertPublishable(draft,targets){
 if(!draft?.approval||draft.approval.contentHash!==draft.contentHash||!draft.rights?.confirmed||!draft.disclosure||!draft.accuracyConfirmed)throw Error('Conteúdo sem aprovação válida de fatos, direitos e publicidade.');
 if(digest(targets)!==draft.approval.targetsHash)throw Error('Conta ou pasta mudou depois da aprovação. Revise novamente.');return true;
}
