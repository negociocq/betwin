import test from 'node:test';
import assert from 'node:assert/strict';
import {bufferCatalog,selectBufferChannel} from '../services/social/buffer-catalog.mjs';
test('Buffer limits include all channels in an organization and locked channels cannot be selected',async()=>{
 const fetchImpl=async(url,options)=>({ok:true,json:async()=>({data:JSON.parse(options.body).query.includes('VynexOrganizations')?{account:{organizations:[{id:'org',channelCount:5,limits:{channels:3,scheduledPosts:10}}]}}:{channels:['youtube','instagram','tiktok','pinterest','facebook'].map((service,i)=>({id:service,name:service,service,isDisconnected:false,isLocked:i>=3,isQueuePaused:false}))}})});
 const data=await bufferCatalog('fixture-token-12345',fetchImpl);assert.equal(data.organizations[0].channelLimit,3);assert.equal(data.organizations[0].activeChannels,3);assert.equal(data.organizations[0].remainingSlots,0);assert.equal(data.organizations[0].planName,null);
 const state={...data,bindings:{youtube:'youtube',instagram:'instagram'}};state.bindings=selectBufferChannel(state,{platform:'tiktok',channelId:'tiktok'});assert.equal(Object.keys(state.bindings).length,3);assert.throws(()=>selectBufferChannel(state,{platform:'pinterest',channelId:'pinterest'}),/bloqueado/);assert.equal(Object.keys(selectBufferChannel(state,{platform:'tiktok',channelId:''})).length,2);
 const invalid={...state,channels:state.channels.map(c=>({...c,locked:false}))};assert.throws(()=>selectBufferChannel(invalid,{platform:'pinterest',channelId:'pinterest'}),/limite/);
});
test('Missing Buffer limits remain unknown instead of inventing a Free plan',async()=>{const data=await bufferCatalog('fixture-token-12345',async(url,options)=>({ok:true,json:async()=>({data:JSON.parse(options.body).query.includes('VynexOrganizations')?{account:{organizations:[{id:'org'}]}}:{channels:[]}})}));assert.equal(data.organizations[0].channelLimit,null);assert.equal(data.organizations[0].planName,null);});
