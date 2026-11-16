import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function productImages(product,{root=resolve('storage/shopee-official/product-media'),fetchImpl=fetch}={}){
 if(!/^\d+$/.test(String(product.itemId)))throw Error('Identificador do produto inválido.');
 const url=new URL(product.imageUrl||'https://invalid.invalid');if(url.protocol!=='https:'||url.hostname!=='cf.shopee.com.br'||url.username||url.password||url.port)throw Error('Este produto não possui uma foto válida retornada pela Shopee.');
 const folder=resolve(root,String(product.itemId));await mkdir(folder,{recursive:true});let manifest;
 try{manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 let bytes;try{if(manifest?.sourceUrl===url.href)bytes=await readFile(resolve(folder,'source.jpg'));}catch{}
 if(!bytes){const response=await fetchImpl(url.href,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok||!/^image\/(jpeg|png|webp)/i.test(response.headers.get('content-type')||''))throw Error('Não foi possível obter a foto real do produto.');if(Number(response.headers.get('content-length'))>10000000)throw Error('Foto do produto muito grande.');const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>10000000)throw Error('Foto do produto muito grande.');chunks.push(chunk);}bytes=Buffer.concat(chunks);await writeFile(resolve(folder,'source.jpg'),bytes);}
 const sourceSha256=sha(bytes),images=[{file:resolve(folder,'source.jpg'),kind:'source',label:'Foto do anúncio'}];
 if(manifest?.sourceSha256===sourceSha256)for(const image of manifest.images||[]){if(image.kind!=='ai-illustration'&&image.kind!=='authorized-photo')continue;const file=resolve(folder,image.file);if(!file.startsWith(folder+sep))throw Error('Imagem fora do produto selecionado.');try{await stat(file);images.push({file,kind:image.kind,label:image.kind==='ai-illustration'?'Ilustração por IA':'Foto adicional autorizada'});}catch{}}
 await writeFile(resolve(folder,'manifest.json'),JSON.stringify({itemId:String(product.itemId),sourceUrl:url.href,sourceSha256,images:images.slice(1).map(i=>({...i,file:i.file.slice(folder.length+1)}))},null,2));
 return {images:images.slice(0,5),sourceSha256,sourceImageCount:images.filter(i=>i.kind!=='ai-illustration').length,illustrationCount:images.filter(i=>i.kind==='ai-illustration').length};
}
