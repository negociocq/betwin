import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {Readable} from 'node:stream';
import {serveGta6} from '../media/gta6-page.mjs';
export function createWebServer({api,apiPort,root=resolve('apps/web')}){
return createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if(['/', '/index.html', '/login', '/cadastro'].includes(path)&&api.auth.user(req)){
      res.writeHead(302,{Location:'/app/','Cache-Control':'no-store'});return res.end();
    }
    if(path==='/app.js'){
      res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      return res.end("location.replace('/?v=shopee-gta-2'+(location.hash==='#accounts'?'#connections':location.hash==='#gta6'?'#gta6':''));");
    }
    if(path==='/styles.css'||path==='/production.css'){
      res.writeHead(200,{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-store'});
      return res.end('/* Legacy stylesheet retired. The current entry uses home.css. */');
    }
    const studioPage=path==='/app'||path==='/app/';
    if((studioPage||path.startsWith('/gta6/')||path==='/gta6')&&!api.auth.user(req)){
      res.writeHead(302,{Location:'/login?next='+encodeURIComponent(studioPage?'/app/':('/app/#gta6/videos')),'Cache-Control':'no-store'});return res.end();
    }
    if(await serveGta6(req,res))return;
    if(path==='/favicon.ico'){res.writeHead(204,{'Cache-Control':'no-store'});return res.end();}
    if (path.startsWith('/api/')) {
      const query = new URL(req.url, 'http://localhost').search;
      const upstream = await fetch(`http://127.0.0.1:${apiPort}${path}${query}`, { method: req.method, redirect: 'manual', headers: { 'Content-Type': req.headers['content-type'] || 'application/json', ...(req.headers.origin ? { Origin: req.headers.origin } : {}), ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}), ...(req.headers.range ? { Range: req.headers.range } : {}) }, ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: req, duplex: 'half' }) });
      const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
      for (const key of ['content-type','content-length','content-range','accept-ranges','content-disposition','location']) if (upstream.headers.has(key)) headers[key] = upstream.headers.get(key);
      const cookies=upstream.headers.getSetCookie();if(cookies.length)headers['Set-Cookie']=cookies;
      res.writeHead(upstream.status, headers);
      if (!upstream.body) return res.end();
      const stream = Readable.fromWeb(upstream.body); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); return stream.pipe(res);
    }
    const files={'/':'landing.html','/index.html':'landing.html','/app':'index.html','/app/':'index.html','/login':'login.html','/cadastro':'register.html','/public.css':'public.css','/public.js':'public.js','/home.js':'home.js','/studio.js':'studio.js','/folders.js':'folders.js','/status-text.js':'status-text.js','/home.css':'home.css','/gta6.js':'gta6.js','/gta6.css':'gta6.css','/shopee-afiliados.html':'shopee-afiliados.html','/shopee-afiliados.js':'shopee-afiliados.js','/shopee-afiliados.css':'shopee-afiliados.css'};
    if (!files[path]) { res.writeHead(404); return res.end('Não encontrado'); }
    const body = await readFile(resolve(root, files[path]));
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' })[extname(files[path])], 'Cache-Control':'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': `default-src 'self'; script-src 'self'; media-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https://cf.shopee.com.br; object-src 'none'; base-uri 'none'; frame-ancestors ${['/aba-shopee.html','/ofertas.html','/v3/CRIAR.html'].includes(path)?"'self'":"'none'"}` });
    res.end(body);
  } catch(error) { if(req.url?.startsWith('/api/'))console.error('Vynex API proxy:',req.url.split('?')[0],error.cause?.code||error.code||error.name);if(res.headersSent)return res.destroy();res.writeHead(502,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Serviço indisponível. A operação pode continuar no backend; consulte o status antes de tentar novamente.'})); }
});
}
