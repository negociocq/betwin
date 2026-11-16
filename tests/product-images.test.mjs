import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {productImages} from '../services/shopee-official/product-images.mjs';
test('product photos reject arbitrary hosts and cannot reuse illustrations from outside the product folder',async()=>{
 const root=await mkdtemp(join(tmpdir(),'vynex-photos-'));try{await assert.rejects(productImages({itemId:'1',imageUrl:'http://127.0.0.1/photo'},{root}),/foto válida/);await assert.rejects(productImages({itemId:'../2',imageUrl:'https://cf.shopee.com.br/file/photo'},{root}),/Identificador/);
 const folder=join(root,'1'),bytes=Buffer.from('fixture-only');await mkdir(folder);await writeFile(join(folder,'source.jpg'),bytes);await writeFile(join(folder,'manifest.json'),JSON.stringify({sourceUrl:'https://cf.shopee.com.br/file/photo',sourceSha256:createHash('sha256').update(bytes).digest('hex'),images:[{file:'../2/another-product.png',kind:'ai-illustration'}]}));await assert.rejects(productImages({itemId:'1',imageUrl:'https://cf.shopee.com.br/file/photo'},{root}),/fora do produto/);
 }finally{await rm(root,{recursive:true,force:true});}
});
