import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export const initial=()=>({version:1,criteria:{keyword:'organizador cozinha',minPrice:0,maxPrice:500,minCommissionPercent:1,minRating:4.5,onlyAvailable:false,category:''},config:{enabled:false,dailyLimit:1,times:['10:00'],timezone:'America/Sao_Paulo'},connections:{},products:[],drafts:[],queue:[],tests:{},reports:[],audit:[]});
export function createAffiliateState(directory=resolve('data/shopee-official')){
 let tail=Promise.resolve();const file=resolve(directory,'state.json');
 async function read(){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return initial();throw e;}}
 function change(fn){const pending=tail.then(async()=>{const state=await read();const result=await fn(state);await mkdir(directory,{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(state,null,2));await rename(tmp,file);return result;});tail=pending.catch(()=>{});return pending;}
 return {read,change,directory,async close(){await tail;}};
}
