import {randomBytes,createHash,scrypt as derive,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {check} from './supabase.mjs';
import {seal,unseal} from '../api/cloud-secret.mjs';
const scrypt=promisify(derive),hash=v=>createHash('sha256').update(v).digest('hex'),TTL=7*86400000;
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function createAccountAuth({admin,publicClient,key=process.env.VYNEX_CLOUD_SECRET,publicUrl=process.env.VYNEX_PUBLIC_URL,emailReady=process.env.VYNEX_EMAIL_READY==='true',confirmationRequired=process.env.VYNEX_EMAIL_CONFIRMATION!=='false'}={}){
 const cookie=(res,value,ttl=TTL/1000)=>res.setHeader('Set-Cookie',`vynex_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`);
 const token=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('vynex_session='))?.slice(14)||'';
 const publicUser=p=>p?{id:p.id,name:p.name,email:p.email,username:p.username,isOwner:p.is_owner===true}:null;
 async function profile(authId){return check(await admin.from('vynex_profiles').select('*').eq('auth_user_id',authId).maybeSingle());}
 async function user(req){const value=token(req);if(!/^[A-Za-z0-9_-]{43}$/.test(value))return null;const session=check(await admin.from('vynex_sessions').select('profile_id').eq('token_hash',hash(value)).gt('expires_at',new Date().toISOString()).maybeSingle());return session?publicUser(check(await admin.from('vynex_profiles').select('*').eq('id',session.profile_id).maybeSingle())):null;}
 async function issue(res,id){const value=randomBytes(32).toString('base64url');check(await admin.from('vynex_sessions').insert({token_hash:hash(value),profile_id:id,expires_at:new Date(Date.now()+TTL).toISOString()}));cookie(res,value);}
 async function throttle(req){const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];if(!check(await admin.rpc('vynex_auth_throttle',{p_key:hash(ip)})))fail(429,'Muitas tentativas. Aguarde 15 minutos.');}
 async function authenticate(identifier,password){
  const isEmail=identifier.includes('@');if(!isEmail&&!/^[a-z0-9_.-]{3,32}$/.test(identifier))fail(401,'Usuário, e-mail ou senha incorretos.');
  const p=check(await admin.from('vynex_profiles').select('*').eq(isEmail?'email':'username',identifier).maybeSingle());
  // The legacy owner's password is upgraded only after a successful scrypt check.
  if(p){const legacy=check(await admin.from('vynex_legacy_auth').select('*').eq('profile_id',p.id).maybeSingle());if(legacy){const derived=await scrypt(password,legacy.salt,64);if(timingSafeEqual(derived,Buffer.from(legacy.password_hash,'hex'))){check(await admin.auth.admin.updateUserById(p.auth_user_id,{password}));check(await admin.from('vynex_legacy_auth').delete().eq('profile_id',p.id));}}}
  const result=await publicClient().auth.signInWithPassword({email:p?.email||(isEmail?identifier:'unknown@invalid.invalid'),password});
  if(result.error||!p||result.data.user?.id!==p.auth_user_id)fail(401,result.error?.code==='email_not_confirmed'?'Confirme seu e-mail antes de entrar.':'Usuário, e-mail ou senha incorretos.');return {profile:p,session:result.data.session};
 }
 async function handle(req,res,path,input={}){
  if(!path.startsWith('/api/auth/'))return false;
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));return true;};
  try{
   if(req.method==='GET'&&path==='/api/auth/status')return send(200,{user:await user(req),needsSetup:false,mode:'supabase',multiAccount:true,emailConfirmationRequired:confirmationRequired,registrationAvailable:emailReady||!confirmationRequired});
   if(path==='/api/auth/callback'&&req.method==='GET'){
    const code=new URL(req.url,publicUrl).searchParams.get('code'),stored=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('vynex_verifier='))?.slice(15);
    if(!code||!stored)fail(400,'Confirmação recebida. Entre com seu e-mail e senha para continuar.');
    const verifier=JSON.parse(unseal(decodeURIComponent(stored),key,'auth-pkce'));if(Date.now()-verifier.at>86400000)fail(400,'O link expirou. Solicite outra confirmação.');
    const storage={getItem:k=>k==='vynex-auth-code-verifier'?verifier.value:null,setItem(){},removeItem(){}};
    const result=await publicClient(storage).auth.exchangeCodeForSession(code);if(result.error||!result.data.session)fail(400,'Não foi possível concluir a confirmação. Entre com seu e-mail e senha.');
    const p=await profile(result.data.user.id);if(!p)fail(403,'Conta ainda não disponível.');await issue(res,p.id);res.writeHead(302,{Location:'/app/','Cache-Control':'no-store'});res.end();return true;
   }
   if(req.method!=='POST')return send(405,{error:'Método não permitido.'});
   if(path==='/api/auth/logout'){const value=token(req);if(value)check(await admin.from('vynex_sessions').delete().eq('token_hash',hash(value)));cookie(res,'',0);return send(200,{ok:true});}
   if(path==='/api/auth/register'){
    if(confirmationRequired&&!emailReady)fail(503,'O cadastro será liberado após configurar o envio de confirmação por e-mail.');await throttle(req);
    const name=String(input.name||'').trim(),email=String(input.email||'').trim().toLowerCase(),username=String(input.username||'').trim().toLowerCase(),password=input.password;
    if(name.length<2||name.length>80||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||username&&!/^[a-z0-9_.-]{3,32}$/.test(username)||typeof password!=='string'||password.length<8||password.length>128)fail(400,'Informe nome, e-mail e uma senha de 8 a 128 caracteres.');
    if(username&&check(await admin.from('vynex_profiles').select('id').eq('username',username).maybeSingle()))fail(409,'Este usuário já está em uso.');
    const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},result=await publicClient(storage).auth.signUp({email,password,options:{data:{name,username},emailRedirectTo:publicUrl+'/api/auth/callback'}});
    if(result.error)fail(result.error.status===429?429:400,'Não foi possível cadastrar. Confira os dados ou tente novamente mais tarde.');
    if(result.data.session){const p=await profile(result.data.user.id);await issue(res,p.id);return send(201,{user:publicUser(p)});}
    const verifier=memory.get('vynex-auth-code-verifier');if(verifier)res.setHeader('Set-Cookie',`vynex_verifier=${encodeURIComponent(seal(JSON.stringify({value:verifier,at:Date.now()}),key,'auth-pkce'))}; Path=/api/auth/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
    return send(202,{needsConfirmation:true,message:'Confira seu e-mail e confirme o cadastro para entrar. Se já possui conta, use Entrar.'});
   }
   if(path==='/api/auth/login'){await throttle(req);const identifier=String(input.identifier||input.email||input.username||'').trim().toLowerCase();if(typeof input.password!=='string'||input.password.length>128||identifier.length>254)fail(400,'Informe seu usuário ou e-mail e sua senha.');const result=await authenticate(identifier,input.password);await issue(res,result.profile.id);return send(200,{user:publicUser(result.profile)});}
   if(['/api/auth/profile','/api/auth/password'].includes(path)){
    const current=await user(req);if(!current)fail(401,'Entre na sua conta para continuar.');
    const p=check(await admin.from('vynex_profiles').select('*').eq('id',current.id).single());
    if(path==='/api/auth/password'){
     if(typeof input.newPassword!=='string'||input.newPassword.length<8||input.newPassword.length>128)fail(400,'A nova senha deve ter de 8 a 128 caracteres.');await throttle(req);if(typeof input.currentPassword!=='string')fail(403,'Confirme sua senha atual.');await authenticate(p.email,input.currentPassword);
     check(await admin.auth.admin.updateUserById(p.auth_user_id,{password:input.newPassword}));check(await admin.from('vynex_sessions').delete().eq('profile_id',p.id));await issue(res,p.id);return send(200,{user:publicUser(p),passwordChanged:true});
    }
    const name=String(input.name??p.name).trim(),username=String(input.username??p.username??'').trim().toLowerCase(),email=String(input.email??p.email).trim().toLowerCase();
    if(name.length<2||name.length>80||username&&!/^[a-z0-9_.-]{3,32}$/.test(username))fail(400,'Informe nome e usuário válidos.');
    if(email!==p.email)fail(400,'A alteração de e-mail ficará disponível após configurar o serviço de confirmação.');
    if(username!==(p.username||'')){await throttle(req);if(typeof input.currentPassword!=='string')fail(403,'Confirme sua senha atual.');await authenticate(p.email,input.currentPassword);}
    const updated=await admin.from('vynex_profiles').update({name,username:username||null}).eq('id',p.id).select('*').single();if(updated.error?.code==='23505')fail(409,'Este usuário já está em uso.');check(updated);return send(200,{user:publicUser(updated.data)});
   }
   return send(404,{error:'Operação não disponível.'});
  }catch(e){console.error('Vynex auth:',e.status||'internal');return send(e.status||503,{error:e.status?e.message:'Não foi possível concluir o acesso. Tente novamente.'});}
 }
 return {user,handle};
}
