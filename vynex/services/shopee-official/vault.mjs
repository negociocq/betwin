import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export function affiliateVault(provider,directory=resolve('data/shopee-official/secrets')){
 if(!['pinterest','youtube'].includes(provider))throw Error('Provedor inválido');const file=resolve(directory,provider+'.dpapi');
 function protect(operation,value){return new Promise((accept,reject)=>{const child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('services/shopee-official/vault.ps1'),'-Operation',operation,'-Provider',provider],{windowsHide:true,timeout:15000,maxBuffer:1024*1024},(error,out)=>error?reject(Error('Não foi possível acessar o cofre local do módulo Shopee.')):accept(out.trim()));child.stdin.on('error',()=>{});child.stdin.end(value);});}
 return {async load(){try{return JSON.parse(await protect('unprotect',await readFile(file,'utf8')));}catch(e){if(e.code==='ENOENT')return {};throw e;}},async save(value){await mkdir(directory,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,await protect('protect',JSON.stringify(value)));await rename(temp,file);}};
}
