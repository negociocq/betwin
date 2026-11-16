import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {command,probe} from '../media/tools.mjs';
import {digest} from './policy.mjs';
import {productImages} from './product-images.mjs';
export async function renderProduct(product,id,{progress=async()=>{}}={}){
 const folder=resolve('storage/shopee-official',id);await mkdir(folder,{recursive:true});await progress('renderizando','Preparando fotos e cenas do produto.');
 const gallery=await productImages(product),input=resolve(folder,'render-request.json');await writeFile(input,JSON.stringify({folder,productName:product.name,...gallery}));
 await command(resolve('.tools/chatterbox-venv/Scripts/python.exe'),[resolve('services/shopee-official/render.py'),input]);await progress('validando','Validando o vídeo com imagens do produto.');
 const info=await probe(resolve(folder,'video.mp4'));if(!info.streams.some(s=>s.codec_type==='video')||Math.abs(Number(info.format.duration)-24)>.1)throw Error('Vídeo não validado.');const assets={};
 for(const [key,name,mime]of [['pin','pin.png','image/png'],['video','video.mp4','video/mp4']]){const file=resolve(folder,name);assets[key]={file,mime,bytes:(await stat(file)).size,sha256:digest(await readFile(file))};}
 for(let i=0;i<gallery.images.length;i++){const file=resolve(folder,'product-image-'+i+'.png');assets['image'+i]={file,mime:'image/png',bytes:(await stat(file)).size,sha256:digest(await readFile(file))};}
 return {assets,visuals:{...JSON.parse(await readFile(resolve(folder,'visuals.json'),'utf8')),sourceSha256:gallery.sourceSha256}};
}
