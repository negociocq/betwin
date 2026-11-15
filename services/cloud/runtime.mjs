import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {Readable,Writable} from 'node:stream';
import {openStore} from '../api/store.mjs';
import {createAuth} from '../api/auth.mjs';
import {seal,unseal} from '../api/cloud-secret.mjs';
export const tableNames=['records','settings','audit','auth_users','auth_sessions','auth_attempts'];
export const jsonFiles=['shopee-official/state.json','social-accounts/accounts.json','social-projects/shopee/accounts/accounts.json'];
export const vaultSpecs=[['integrations/buffer.dpapi','buffer'],['integrations/youtube.dpapi','youtube'],['integrations/youtube-client.dpapi','youtube-client'],['social-projects/shopee/integrations/buffer.dpapi','buffer'],['social-projects/shopee/integrations/shopee-affiliate.dpapi','shopee-affiliate'],['shopee-official/secrets/pinterest.dpapi','pinterest']];
export function dumpTables(db){return Object.fromEntries(tableNames.map(name=>[name,db.prepare(`SELECT * FROM ${name}`).all()]));}
export function restoreTables(db,tables){db.exec('BEGIN IMMEDIATE');try{for(const name of [...tableNames].reverse())db.exec(`DELETE FROM ${name}`);for(const name of tableNames)for(const row of tables[name]||[]){const columns=db.prepare(`PRAGMA table_info(${name})`).all().map(c=>c.name).filter(k=>k in row);db.prepare(`INSERT INTO ${name} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...columns.map(k=>row[k]));}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
function vaultPurpose(path,purpose){return path.startsWith('shopee-official/secrets/')?'affiliate-vault:'+purpose:'vault:'+purpose;}
export async function createRuntime(workspace){
 const directory=await mkdtemp(join(tmpdir(),'betwin-runtime-'));const initial=openStore(directory);createAuth({db:initial.db});restoreTables(initial.db,workspace.tables);initial.db.close();
 for(const path of jsonFiles){const value=workspace.files[path];if(value!==undefined){await mkdir(resolve(directory,path,'..'),{recursive:true});await writeFile(resolve(directory,path),JSON.stringify(value));}}
 for(const [path,purpose]of vaultSpecs){const value=workspace.vaults[path];if(value!==undefined&&value!==null){await mkdir(resolve(directory,path,'..'),{recursive:true});await writeFile(resolve(directory,path),seal(JSON.stringify(value),process.env.VYNEX_CLOUD_SECRET,vaultPurpose(path,purpose)));}}
 const store=openStore(directory),auth=createAuth({db:store.db});
 const handler=async(req,res)=>{let body='';for await(const part of req)body+=part;const path=new URL(req.url,'https://betwin-three.vercel.app').pathname;if(!await auth.handle(req,res,path,body?JSON.parse(body):{})){res.writeHead(404);res.end('{}');}};
 const api={store,auth,server:{listeners:()=>[handler]},async close(){store.db.close();}};
 async function capture(){workspace.tables=dumpTables(api.store.db);for(const path of jsonFiles){try{workspace.files[path]=JSON.parse(await readFile(resolve(directory,path),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}for(const [path,purpose]of vaultSpecs){try{workspace.vaults[path]=JSON.parse(unseal(await readFile(resolve(directory,path),'utf8'),process.env.VYNEX_CLOUD_SECRET,vaultPurpose(path,purpose)));}catch(e){if(e.code==='ENOENT')delete workspace.vaults[path];else throw e;}}}
 async function invoke({path,method='GET',headers={},body,ip='cloud'}){
  const request=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(request,{method,url:path,headers,socket:{encrypted:true,remoteAddress:ip}});let status=200;const responseHeaders={};const chunks=[];let complete;const done=new Promise(r=>{complete=r;});
  const response=new Writable({write(chunk,encoding,cb){chunks.push(Buffer.from(chunk));cb();}});response.headersSent=false;response.setHeader=(k,v)=>{responseHeaders[k.toLowerCase()]=v;};response.getHeader=k=>responseHeaders[k.toLowerCase()];response.writeHead=(s,h={})=>{status=s;for(const [k,v]of Object.entries(h))response.setHeader(k,v);response.headersSent=true;return response;};response.on('finish',complete);
  await api.server.listeners('request')[0](request,response);await done;return {status,headers:responseHeaders,body:Buffer.concat(chunks)};
 }
 return {api,invoke,capture,async close(){await api.close();await rm(directory,{recursive:true,force:true});}};
}
