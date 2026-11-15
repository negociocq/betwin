import {randomBytes,randomUUID,createHash,scrypt as derive,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive),COOKIE='vynex_session',TTL=7*86400000;
const hash=value=>createHash('sha256').update(value).digest('hex');
export function createAuth({db,clock=()=>new Date()}){
 db.exec('CREATE TABLE IF NOT EXISTS auth_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id), expires_at INTEGER NOT NULL);');
 if(!db.prepare('PRAGMA table_info(auth_users)').all().some(c=>c.name==='username'))db.exec('ALTER TABLE auth_users ADD COLUMN username TEXT');
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS auth_username_unique ON auth_users(username)');
 const failures=new Map();
 const publicUser=u=>u?{id:u.id,name:u.name,email:u.email||null,username:u.username||null}:null;
 const token=req=>{const v=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='));return v?.slice(COOKIE.length+1)||'';};
 function user(req){const value=token(req);if(!/^[A-Za-z0-9_-]{43}$/.test(value))return null;const row=db.prepare('SELECT u.id,u.name,u.email,u.username FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hash(value),+clock());return publicUser(row);}
 function cookie(req,value,maxAge=TTL/1000){return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${req.socket?.encrypted?'; Secure':''}`;}
 function session(req,res,id){const value=randomBytes(32).toString('base64url');db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(+clock());db.prepare('INSERT INTO auth_sessions VALUES (?,?,?)').run(hash(value),id,+clock()+TTL);res.setHeader('Set-Cookie',cookie(req,value));}
 const needsSetup=()=>db.prepare('SELECT count(*) AS n FROM auth_users').get().n===0;
 function throttle(req){const ip=req.socket?.remoteAddress||'local';let b=failures.get(ip);if(!b||b.until<=+clock()){b={attempts:0,until:+clock()+15*60000};failures.set(ip,b);}if(b.attempts>=10)throw Object.assign(Error('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'),{statusCode:429});b.attempts++;if(failures.size>1000)for(const [k,v]of failures)if(v.until<=+clock())failures.delete(k);}
 async function handle(req,res,path,input={}){
  if(!path.startsWith('/api/auth/'))return false;
  const send=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));return true;};
  try{
   if(req.method==='GET'&&path==='/api/auth/status')return send(200,{user:user(req),needsSetup:needsSetup(),mode:'local-owner'});
   if(req.method!=='POST')return send(405,{error:'Método não permitido.'});
   if(path==='/api/auth/logout'){const value=token(req);if(value)db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hash(value));res.setHeader('Set-Cookie',cookie(req,'',0));return send(200,{ok:true});}
   if(['/api/auth/profile','/api/auth/password'].includes(path)){
    const current=user(req);if(!current)return send(401,{error:'Entre na sua conta para continuar.'});
    const row=db.prepare('SELECT * FROM auth_users WHERE id=?').get(current.id);
    const confirm=async()=>{throttle(req);if(typeof input.currentPassword!=='string'||input.currentPassword.length>128)return false;const derived=await scrypt(input.currentPassword,row.salt,64);return timingSafeEqual(derived,Buffer.from(row.password_hash,'hex'));};
    if(path==='/api/auth/password'){
     if(Object.keys(input).some(k=>!['currentPassword','newPassword'].includes(k))||typeof input.newPassword!=='string'||input.newPassword.length<8||input.newPassword.length>128)return send(400,{error:'A nova senha deve ter entre 8 e 128 caracteres.'});
     if(!await confirm())return send(403,{error:'A senha atual está incorreta.'});
     const salt=randomBytes(16).toString('hex'),derived=await scrypt(input.newPassword,salt,64);
     db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE auth_users SET salt=?,password_hash=? WHERE id=?').run(salt,derived.toString('hex'),row.id);db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(row.id);session(req,res,row.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return send(200,{user:publicUser(row),passwordChanged:true});
    }
    if(Object.keys(input).some(k=>!['name','username','email','currentPassword'].includes(k)))return send(400,{error:'Dados da conta inválidos.'});
    const name=typeof input.name==='string'?input.name.trim():row.name,username=typeof input.username==='string'?input.username.trim().toLowerCase():row.username||'',email=typeof input.email==='string'?input.email.trim().toLowerCase():row.email;
    if(name.length<2||name.length>80||(username&&!/^[a-z0-9_.-]{3,32}$/.test(username))||(email&&(!/^\S+@\S+\.\S+$/.test(email)||email.length>254))||(!email&&!username))return send(400,{error:'Informe nome e um usuário ou e-mail válido.'});
    const sensitive=username!==(row.username||'')||email!==row.email;
    if(sensitive&&!await confirm())return send(403,{error:'Confirme sua senha atual para alterar o usuário ou e-mail.'});
    db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE auth_users SET name=?,username=?,email=? WHERE id=?').run(name,username||null,email,row.id);if(sensitive){db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(row.id);session(req,res,row.id);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return send(200,{user:publicUser({...row,name,username,email})});
   }
   if(!['/api/auth/register','/api/auth/login'].includes(path))return send(404,{error:'Operação não encontrada.'});
   throttle(req);
   const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
   const username=typeof input.username==='string'?input.username.trim().toLowerCase():'';
   const identifier=String(input.identifier||username||email).trim().toLowerCase();
   if(typeof input.password!=='string'||input.password.length>128||identifier.length>254)return send(400,{error:'Informe seu usuário ou e-mail e sua senha.'});
   if(path==='/api/auth/register'){
    if(!needsSetup())return send(409,{error:'Este Vynex já possui um proprietário. Entre com a conta cadastrada.'});
    if((email&&!/^\S+@\S+\.\S+$/.test(email))||email.length>254||(username&&!/^[a-z0-9_.-]{3,32}$/.test(username))||(!email&&!username))return send(400,{error:'Informe um e-mail válido ou um usuário de 3 a 32 letras, números, pontos ou traços.'});
    const name=typeof input.name==='string'?input.name.trim():username;if(name.length<2||name.length>80||input.password.length<8)return send(400,{error:'Informe seu nome e uma senha com pelo menos 8 caracteres.'});
    const salt=randomBytes(16).toString('hex'),derived=await scrypt(input.password,salt,64);
    const id=randomUUID();db.exec('BEGIN IMMEDIATE');try{if(!needsSetup()){db.exec('ROLLBACK');return send(409,{error:'Este Vynex já possui um proprietário. Faça login.'});}db.prepare('INSERT INTO auth_users (id,email,name,salt,password_hash,created_at,username) VALUES (?,?,?,?,?,?,?)').run(id,email,name,salt,derived.toString('hex'),clock().toISOString(),username||null);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    session(req,res,id);return send(201,{user:{id,name,email:email||null,username:username||null}});
   }
   const row=identifier?db.prepare('SELECT * FROM auth_users WHERE email=? OR username=?').get(identifier,identifier):null,derived=await scrypt(input.password,row?.salt||'0'.repeat(32),64);const expected=Buffer.from(row?.password_hash||'0'.repeat(128),'hex');
   if(!timingSafeEqual(derived,expected)||!row)return send(401,{error:'Usuário, e-mail ou senha incorretos.'});
   failures.delete(req.socket?.remoteAddress||'local');session(req,res,row.id);return send(200,{user:publicUser(row)});
  }catch(e){return send(e.statusCode||500,{error:e.statusCode?e.message:'Não foi possível concluir o acesso. Tente novamente.'});}
 }
 return {user,needsSetup,handle};
}
