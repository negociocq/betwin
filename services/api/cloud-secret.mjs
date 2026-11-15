import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export function seal(value,keyHex,purpose='betwin-workspace'){
 if(!/^[a-f0-9]{64}$/i.test(keyHex||''))throw Error('Cloud encryption key missing');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),iv);cipher.setAAD(Buffer.from(purpose));const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')});
}
export function unseal(value,keyHex,purpose='betwin-workspace'){
 const box=JSON.parse(value);if(box.v!==1||!/^[a-f0-9]{64}$/i.test(keyHex||''))throw Error('Invalid encrypted workspace');const cipher=createDecipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),Buffer.from(box.iv,'base64'));cipher.setAAD(Buffer.from(purpose));cipher.setAuthTag(Buffer.from(box.tag,'base64'));return Buffer.concat([cipher.update(Buffer.from(box.data,'base64')),cipher.final()]).toString('utf8');
}
export function cloudSecret(operation,value,purpose){if(process.env.VYNEX_CLOUD_RUNTIME!=='true')return null;return operation==='protect'?seal(value,process.env.VYNEX_CLOUD_SECRET,purpose):unseal(value,process.env.VYNEX_CLOUD_SECRET,purpose);}
