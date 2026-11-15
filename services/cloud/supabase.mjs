import {createClient} from '@supabase/supabase-js';
import {seal,unseal} from '../api/cloud-secret.mjs';
export function supabaseClients({url=process.env.SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY,anonKey=process.env.SUPABASE_ANON_KEY}={}){
 if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||''))throw Error('Supabase não configurado.');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal||AbortSignal.timeout(15000)})}};
 return {admin:createClient(url,serviceKey,options),publicClient:storage=>createClient(url,anonKey,{global:options.global,auth:{...options.auth,flowType:'pkce',storageKey:'vynex-auth',...(storage?{storage,persistSession:true}:{})}})};
}
export function check(result){if(result.error)throw Object.assign(Error('Não foi possível salvar os dados da conta.'),{cause:result.error,dbCode:result.error.code});return result.data;}
export function createAccountWorkspace({admin,ownerId,key=process.env.VYNEX_CLOUD_SECRET,initial}={}){
 const purpose='workspace:'+ownerId;
 async function read(){let rows=check(await admin.from('vynex_workspaces').select('payload,version').eq('owner_id',ownerId));if(!rows.length){const data=initial();const r=await admin.from('vynex_workspaces').insert({owner_id:ownerId,payload:seal(JSON.stringify(data),key,purpose)});if(r.error&&r.error.code!=='23505')check(r);rows=check(await admin.from('vynex_workspaces').select('payload,version').eq('owner_id',ownerId));}return {data:JSON.parse(unseal(rows[0].payload,key,purpose)),etag:rows[0].version};}
 async function write(data,version){const rows=check(await admin.from('vynex_workspaces').update({payload:seal(JSON.stringify(data),key,purpose),version:version+1,updated_at:new Date().toISOString()}).eq('owner_id',ownerId).eq('version',version).select('version'));if(!rows.length)throw Object.assign(Error('Conflito de versão.'),{conflict:true});return rows[0].version;}
 async function transaction(fn){for(let i=0;i<7;i++){const {data,etag}=await read(),result=await fn(data);delete data.lock;try{await write(data,etag);return result;}catch(e){if(!e.conflict)throw e;}}throw Object.assign(Error('Aguarde a operação atual e tente novamente.'),{status:409});}
 return {read,write,transaction};
}
