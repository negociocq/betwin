import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { storedPath, fileDigest } from './library.mjs';

export async function serveFile(req, res, artifact, name, validatedAbsoluteFile) {
  const file = validatedAbsoluteFile || storedPath(artifact.file);let info;
  try{info=await stat(file);}catch(e){if(e.code==='ENOENT'){const error=new Error('Arquivo não encontrado no caminho registrado. Restaure a cópia original preservada.');error.statusCode=404;throw error;}throw e;}
  if (!info.size || info.size !== artifact.bytes || await fileDigest(file) !== artifact.sha256){const error=new Error('Arquivo vazio ou alterado. Restaure a cópia original preservada.');error.statusCode=409;throw error;}
  res.setHeader('Content-Type', artifact.mime + (artifact.mime.startsWith('text/') ? '; charset=utf-8' : ''));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', `${new URL(req.url, 'http://localhost').searchParams.has('download') ? 'attachment' : 'inline'}; filename="${name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
  let start = 0, end = info.size - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
    if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
    res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
  }
  res.setHeader('Content-Length', end - start + 1);
  res.writeHead(req.headers.range ? 206 : 200);
  if(req.method==='HEAD'){res.end();return;}
  const stream = createReadStream(file, { start, end });
  stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
}
