const phases=[['preparando','Preparar'],['buscando','Buscar produtos'],['selecionando','Selecionar oferta'],['renderizando','Criar vídeo'],['validando','Validar arquivo'],['salvando','Salvar prévia'],['sincronizando','Enviar ao painel'],['concluido','Pronto para revisão']];
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let timer,version=0,starting=false,lastId,notified;
export const generationPanel=()=>'<section id="generation-progress" class="panel generation-progress" role="status" aria-live="polite" hidden></section>';
export function mountGeneration(){clearTimeout(timer);const generation=++version;if(!document.querySelector('#generation-progress'))return;
 async function poll(){if(generation!==version)return;try{const r=await fetch('/api/shopee-official/generation',{cache:'no-store'});if(!r.ok)return;const data=await r.json(),c=data.command,p=c?c.progress:data.progress,box=document.querySelector('#generation-progress');if(!box||generation!==version)return;
  if(lastId&&c?.id!==lastId&&starting){timer=setTimeout(poll,800);return;}
  const active=starting||c&&['queued','running'].includes(c.status)||p?.status==='running';if(!c&&!p&&!starting){box.hidden=true;return;}box.hidden=false;
  const queued=c?.status==='queued'||starting&&!p,failed=c?.status==='failed'||['failed','blocked'].includes(p?.status),done=!active&&!failed,step=p?.step||'preparando',index=phases.findIndex(([id])=>id===step);
  box.innerHTML=`<div class="panel-head"><h2>${failed?'Geração interrompida':done?'Vídeo pronto para revisão':queued?'Solicitação enviada':'Gerando seu vídeo'}</h2><span class="badge ${done?'good':''}">${queued?'Aguardando computador':failed?'Requer atenção':done?'Concluído':'Em andamento'}</span></div><p>${esc(p?.message||c?.message||(queued?'Aguardando o computador conectado iniciar. Se estiver desligado, abra o Vynex.':'Preparando a geração.'))}</p><ol class="generation-steps">${phases.map(([id,label],i)=>`<li class="${done||index>i?'done':index===i&&!failed?'current':''}"><span>${done||index>i?'✓':i+1}</span>${label}</li>`).join('')}</ol>${done?'<a class="button secondary" href="#shopee/videos">Ver vídeo na biblioteca</a>':''}`;
  if(c||p)starting=false;if(active){timer=setTimeout(poll,document.hidden||queued&&(!data.agent?.seenAt||Date.now()-Date.parse(data.agent.seenAt)>1200000)?10000:1000);}else if((c?.id||p?.runId)!==notified){notified=c?.id||p?.runId;if(done)dispatchEvent(new CustomEvent('vynex:generation-finished'));}
 }catch{timer=setTimeout(poll,2500);}}
 poll();
}
addEventListener('vynex:generation-start',()=>{starting=true;lastId=null;mountGeneration();});
addEventListener('vynex:generation-queued',e=>{starting=false;lastId=e.detail.commandId;mountGeneration();});
