import {randomUUID} from 'node:crypto';
import {seal,unseal} from '../api/cloud-secret.mjs';
export const workspacePath='vynex/private/workspace.v1.json';
export function createWorkspaceStore({token,key,sdkImpl}={}){
 async function sdk(){return sdkImpl||await import('@vercel/blob');}
 async function read(){const lib=await sdk(),result=await lib.get(workspacePath,{access:'private',token,useCache:false});if(!result?.stream)throw Error('O workspace online ainda não foi inicializado.');const text=await new Response(result.stream).text();return {data:JSON.parse(unseal(text,key)),etag:result.blob.etag.replace(/^W\//,'')};}
 async function write(data,etag){const lib=await sdk();const result=await lib.put(workspacePath,seal(JSON.stringify(data),key),{access:'private',token,addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{}),contentType:'application/json',cacheControlMaxAge:60});return result.etag;}
 async function transaction(fn){for(let attempt=0;attempt<7;attempt++){const current=await read();if(current.data.lock&&current.data.lock.until>Date.now()){await new Promise(r=>setTimeout(r,150+attempt*100));continue;}const id=randomUUID();current.data.lock={id,until:Date.now()+180000};let etag;try{etag=await write(current.data,current.etag);}catch(e){if(e.constructor?.name?.includes('Precondition')||e.name?.includes('Precondition'))continue;throw e;}
   try{const result=await fn(current.data);delete current.data.lock;current.data.updatedAt=new Date().toISOString();await write(current.data,etag);return result;}catch(e){try{const fresh=await read();if(fresh.data.lock?.id===id){delete fresh.data.lock;await write(fresh.data,fresh.etag);}}catch{}throw e;}
  }throw Object.assign(Error('O workspace está concluindo outra operação. Tente novamente em instantes.'),{status:409});}
 return {read,write,transaction};
}
