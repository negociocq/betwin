import {readFile,stat} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {fileDigest} from './library.mjs';
import {serveFile} from './serve.mjs';

export async function gta6Catalog(directory=resolve('output/gta6-corte')) {
 let batch={clips:[]};
 try{batch=JSON.parse(await readFile(resolve(directory,'gta6-batch.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 let automatic={clips:[]},automation={enabled:false};
 try{automatic=JSON.parse(await readFile(resolve(directory,'gta6-automation-clips.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 try{automation=JSON.parse(await readFile(resolve(directory,'automation-status.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const entries=[{id:'gta6-melhores-momentos-vertical',title:'O caos de Vice City',duration:28,category:'Trailer',name:'gta6-melhores-momentos-vertical.mp4',source:'https://www.rockstargames.com/VI/media/videos'},
 ...(batch.clips||[]).map(c=>({id:c.id,title:c.title,duration:c.duration,category:'Dentro do jogo',name:basename(c.file),description:c.description,source:batch.sourcePage})),
 ...(automatic.clips||[]).map(c=>({id:c.id,title:c.title,duration:c.duration,category:c.category||(c.id==='gta6-melhores-momentos-vertical'?'Trailer':'Dentro do jogo'),name:basename(c.file),source:c.sourcePage,scheduledDay:c.day,language:c.language}))];
 const clips=[];
 for(const entry of new Map(entries.map(entry=>[entry.id,entry])).values()){
  if(automation.requireDubbing&&entry.language!=='pt-BR')continue;
  if(!/^[a-zA-Z0-9_-]+\.mp4$/.test(entry.name))continue;
  try{const info=await stat(resolve(directory,entry.name));if(!info.size)continue;
   clips.push({...entry,bytes:info.size,url:'/gta6/media/'+entry.name,poster:'/gta6/media/'+entry.id+'.jpg'});
  }catch(e){if(e.code!=='ENOENT')throw e;}
 }
 return {clips,automation,publicationStatus:automation.enabled?'automatic':'not_configured'};
}
export async function serveGta6(req,res,directory=resolve('output/gta6-corte')){
 const path=new URL(req.url,'http://localhost').pathname;
 if(path!=='/gta6'&&!path.startsWith('/gta6/'))return false;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return true;}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(path==='/gta6'||path==='/gta6/'){res.writeHead(302,{Location:'/#gta6'});res.end();return true;}
 try{
  const catalog=await gta6Catalog(directory);
  if(path==='/gta6/catalog.json'){
   const body=JSON.stringify(catalog);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body)});res.end(req.method==='HEAD'?undefined:body);return true;
  }
  const allowed=new Map(catalog.clips.flatMap(c=>[[c.url,{name:c.name,mime:'video/mp4'}],[c.poster,{name:c.id+'.jpg',mime:'image/jpeg'}]]));
  allowed.set('/gta6/lote.zip',{name:catalog.automation.requireDubbing?'gta6-lote-dublado-ptbr.zip':'gta6-lote-3-videos.zip',mime:'application/zip'});
  const item=allowed.get(path);
  if(!item){res.writeHead(404);res.end('Arquivo não encontrado.');return true;}
  const file=resolve(directory,item.name);const info=await stat(file);
  await serveFile(req,res,{file,bytes:info.size,sha256:await fileDigest(file),mime:item.mime},item.name,file);
 }catch(e){if(res.headersSent)res.destroy();else{res.writeHead(e.code==='ENOENT'?404:500);res.end('Não foi possível abrir o vídeo.');}}
 return true;
}
