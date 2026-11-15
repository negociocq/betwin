import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable,Writable} from 'node:stream';
import {createHash} from 'node:crypto';
import {openStore} from '../services/api/store.mjs';
import {createAuth} from '../services/api/auth.mjs';
import {dumpTables} from '../services/cloud/runtime.mjs';
import {createCloudHandler} from '../services/cloud/handler.mjs';
import {createWorkspaceStore} from '../services/cloud/workspace.mjs';
const key='ab'.repeat(32);
test('encrypted cloud workspace rejects stale writes and persists owner sessions across runtimes',async()=>{
 let value,etag=0;const sdk={async get(){return value?{stream:new Blob([value]).stream(),blob:{etag:'W/'+String(etag)}}:null;},async put(path,bytes,options){if(options.ifMatch&&options.ifMatch!==String(etag))throw Object.assign(Error('stale'),{name:'BlobPreconditionFailedError'});value=bytes;return {etag:String(++etag)};}};
 const store=createWorkspaceStore({key,sdkImpl:sdk});const dir=await mkdtemp(join(tmpdir(),'betwin-test-'));let workspace;
 try{const local=openStore(dir);createAuth({db:local.db});workspace={tables:dumpTables(local.db),files:{},vaults:{},snapshots:{'/api/status':{projects:['shopee','gta6']}},commands:[]};local.db.close();}finally{await rm(dir,{recursive:true,force:true});}
 await store.write(workspace);assert.ok(!value.includes('auth_users'));const original=await store.read();await store.write(original.data,original.etag);await assert.rejects(()=>store.write(original.data,original.etag));
 const handler=createCloudHandler({store});async function request(path,body,cookie){const req=Readable.from([]);Object.assign(req,{url:path,method:body?'POST':'GET',body,headers:cookie?{cookie}:{},socket:{remoteAddress:'test'}});const chunks=[];let status,headers={};const res=new Writable({write(b,e,cb){chunks.push(b);cb();}});res.writeHead=(s,h)=>{status=s;headers={...headers,...h};};res.setHeader=(k,v)=>{headers[k]=v;};await handler(req,res);return {status,headers,body:JSON.parse(Buffer.concat(chunks).toString())};}
 assert.equal((await request('/api/status')).status,401);
 const register=await request('/api/auth/register',{username:'owner',name:'Owner',password:'example-password'});assert.equal(register.status,201);const cookie=register.headers['set-cookie'].split(';')[0];assert.equal((await request('/api/auth/status',undefined,cookie)).body.user.username,'owner');assert.equal((await request('/api/status',undefined,cookie)).status,200);
 const queued=await request('/api/shopee-official/production-run',{},cookie);assert.equal(queued.status,202);assert.equal((await store.read()).data.commands.length,1);assert.equal((await request('/api/other',{},cookie)).status,404);
 const logout=await request('/api/auth/logout',{},cookie);assert.equal(logout.status,200);assert.equal((await request('/api/status',undefined,cookie)).status,401);
});
