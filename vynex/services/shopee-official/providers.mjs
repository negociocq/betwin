import {randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {affiliateVault} from './vault.mjs';
const specs={
 pinterest:{auth:'https://www.pinterest.com/oauth/',token:'https://api.pinterest.com/v5/oauth/token',api:'https://api.pinterest.com/v5',scopes:['boards:read','boards:write','pins:read','pins:write']},
};
export class OfficialApiError extends Error{constructor(message,{uncertain=false,status=0}={}){super(message);this.uncertain=uncertain;this.status=status;}}
export function createOfficialProvider(provider,{state,vault=affiliateVault(provider),fetchImpl=fetch,clock=()=>new Date()}={}){
 const spec=specs[provider];if(!spec)throw Error('Provedor inválido');
 async function jsonRequest(url,options={},mutating=false){
  let r;try{r=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(90000),...options});}catch{throw new OfficialApiError(provider+': resposta não recebida. Confira o envio existente antes de repetir.',{uncertain:mutating});}
  const body=await r.json().catch(()=>null);
  if(!r.ok)throw new OfficialApiError(provider+': HTTP '+r.status+'. '+({401:'Reconecte pelo OAuth oficial.',403:'Verifique permissões, acesso do aplicativo e a conta selecionada.',429:'Limite da API atingido; tente novamente depois.'}[r.status]||'A API recusou a operação.'),{uncertain:mutating&&r.status>=500,status:r.status});
  if(!body)throw new OfficialApiError('Resposta incompleta da API.',{uncertain:mutating});return body;
 }
 function tokenOptions(c,values){return {method:'POST',headers:{Authorization:'Basic '+Buffer.from(c.clientId+':'+c.clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)};}
 async function credentials(){const c=await vault.load();if(!c.token?.access_token)throw Error('Conecte '+provider+' pelo OAuth oficial do módulo Shopee.');
  if(c.token.expiresAt<+clock()+60000){if(!c.token.refresh_token)throw Error('Autorização expirada; reconecte '+provider+'.');const token=await jsonRequest(spec.token,tokenOptions(c,{grant_type:'refresh_token',refresh_token:c.token.refresh_token}));if(!token.access_token||!(token.expires_in>0))throw Error('Renovação OAuth incompleta.');c.token={...c.token,...token,expiresAt:+clock()+token.expires_in*1000};await vault.save(c);}return c;}
 async function request(path,options={},mutating=false){if(!path.startsWith('/')||path.includes('://'))throw Error('Caminho de API inválido.');const c=await credentials();return jsonRequest(spec.api+path,{...options,headers:{'Content-Type':'application/json',...options.headers,Authorization:'Bearer '+c.token.access_token}},mutating);}
 async function saveClient(input){
  if(Object.keys(input).some(k=>!['clientId','clientSecret','redirectUri'].includes(k))||typeof input.clientId!=='string'||!input.clientId.trim()||typeof input.clientSecret!=='string'||input.clientSecret.length<6||input.clientSecret.length>4096)throw Error('Informe App ID/Client ID e Secret do aplicativo.');
  const redirectUri=input.redirectUri||'http://127.0.0.1:3001/api/shopee-official/oauth/'+provider+'/callback';const u=new URL(redirectUri);if(u.username||u.password||u.search||u.hash||u.pathname!=='/api/shopee-official/oauth/'+provider+'/callback'||!(u.protocol==='https:'||u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))throw Error('Callback OAuth inválido. Cadastre o endereço exato no aplicativo.');
  await vault.save({clientId:input.clientId.trim(),clientSecret:input.clientSecret,redirectUri});await state.change(s=>{s.connections[provider]={configured:true,connected:false,redirectUri,message:'Aplicativo configurado. Falta autorizar a conta.'};delete s.tests[provider];s.config.enabled=false;});return {configured:true,redirectUri};
 }
 async function start(){const c=await vault.load();if(!c.clientId)throw Error('Configure o aplicativo '+provider+' nesta área.');const nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');c.pending={state:nonce,verifier,expiresAt:+clock()+600000};await vault.save(c);
  const params=new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirectUri,response_type:'code',scope:spec.scopes.join(' '),state:nonce,...(provider==='youtube'?{access_type:'offline',prompt:'consent select_account',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}:{})});return spec.auth+'?'+params;
 }
 async function callback(query){const c=await vault.load(),pending=c.pending;c.pending=null;await vault.save(c);if(!pending||pending.expiresAt<+clock()||query.get('state')!==pending.state||!query.get('code')||query.has('error'))throw Error('OAuth não autorizado, inválido ou expirado. Reinicie a conexão.');
  const token=await jsonRequest(spec.token,tokenOptions(c,{grant_type:'authorization_code',code:query.get('code'),redirect_uri:c.redirectUri,...(provider==='youtube'?{code_verifier:pending.verifier}:{})}));if(!token.access_token||!(token.expires_in>0)||!spec.scopes.every(scope=>(token.scope||'').split(/[ ,]+/).includes(scope)))throw Error('As permissões necessárias não foram concedidas.');
  c.token={...token,expiresAt:+clock()+token.expires_in*1000};await vault.save(c);return verify();
 }
 async function verify(){
  const c=await credentials();let account,boards=[];
  if(provider==='pinterest'){const a=await request('/user_account');if(!a.username)throw Error('Conta Pinterest não confirmada.');account={id:a.id||a.username,name:a.username,accountType:a.account_type||null};let bookmark;for(let n=0;n<5;n++){const b=await request('/boards?page_size=100'+(bookmark?'&bookmark='+encodeURIComponent(bookmark):''));boards.push(...(b.items||[]).map(x=>({id:x.id,name:x.name,privacy:x.privacy,owner:x.owner?.username||null})));bookmark=b.bookmark;if(!bookmark)break;}}
  await state.change(s=>{const previous=s.connections[provider];if(previous?.account?.id&&previous.account.id!==account.id)delete s.tests[provider];s.connections[provider]={configured:true,connected:true,verifiedAt:clock().toISOString(),account,boards,grantedScopes:c.token.scope,redirectUri:c.redirectUri};});return account;
 }
 async function pin(draft,boardId){
  if(provider!=='pinterest')throw Error('Provedor inválido');const image=await readFile(draft.assets.pin.file);const p=await request('/pins',{method:'POST',body:JSON.stringify({board_id:boardId,title:draft.title.slice(0,100),description:draft.description.slice(0,800),alt_text:draft.altText.slice(0,500),link:draft.affiliateUrl,media_source:{source_type:'image_base64',content_type:'image/png',data:image.toString('base64')}})},true);
  if(!p.id)throw new OfficialApiError('Pinterest não confirmou um ID de Pin.',{uncertain:true});return {remoteId:p.id,url:'https://www.pinterest.com/pin/'+p.id+'/',status:'published',boardId};
 }
 async function tagProduct(pinId,productPinId){const result=await request('/pins/'+encodeURIComponent(pinId)+'/product_tags',{method:'POST',body:JSON.stringify({product_tags:[{pin_id:productPinId}]})},true);if(!result.product_tags?.some(t=>t.pin_id===productPinId))throw new OfficialApiError('A marcação do produto não foi confirmada.',{uncertain:true});return {confirmed:true,productPinId};}
 async function metrics(remoteId,start,end){return request('/pins/'+encodeURIComponent(remoteId)+'/analytics?'+new URLSearchParams({start_date:start,end_date:end,metric_types:'IMPRESSION,OUTBOUND_CLICK,PIN_CLICK,SAVE'}));}
 return {saveClient,start,callback,verify,request,pin,tagProduct,metrics,scopes:spec.scopes};
}
