import { mkdir, writeFile, readFile, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { required } from '../api/store.mjs';
import { validateRights } from './rights.mjs';
import { probe } from './tools.mjs';

export const storageRoot = () => resolve(process.env.STORAGE_DIR || 'storage');
export const digest = buffer => createHash('sha256').update(buffer).digest('hex');
export const fileDigest = async file => digest(await readFile(file));
export function storedPath(relative) {
  const root = storageRoot();
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.startsWith('/') || relative.split('/').some(s => ['.', '..', ''].includes(s))) throw new Error('Caminho de arquivo inválido.');
  const path = resolve(root, relative);
  if (!path.startsWith(root + '/')) {
    // Windows uses backslashes in resolved paths.
    if (!path.startsWith(root + '\\')) throw new Error('Arquivo fora do armazenamento Vynex.');
  }
  return path;
}
export async function importMedia(store, input) {
  const rights = validateRights(input);
  if (input.productId && !store.get(input.productId, 'products')) throw new Error('Produto não encontrado.');
  const name = required(input.name, 'Nome da mídia', 200);
  const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4' };
  const extension = types[input.mime];
  if (!extension) throw new Error('Envie JPEG, PNG, WebP ou MP4.');
  if (typeof input.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) throw new Error('Conteúdo base64 inválido.');
  const bytes = Buffer.from(input.base64, 'base64');
  if (!bytes.length || bytes.length > 40 * 1024 * 1024) throw new Error('Arquivo vazio ou maior que 40 MB.');
  const signature = bytes.subarray(0, 12);
  if ((extension === 'jpg' && !(signature[0] === 255 && signature[1] === 216 && signature[2] === 255)) ||
      (extension === 'png' && !signature.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
      (extension === 'webp' && !(signature.toString('ascii', 0, 4) === 'RIFF' && signature.toString('ascii', 8, 12) === 'WEBP')) ||
      (extension === 'mp4' && signature.toString('ascii', 4, 8) !== 'ftyp')) throw new Error('O conteúdo não corresponde ao tipo declarado.');
  const id = randomUUID(); const relative = `media/${id}.${extension}`; const file = storedPath(relative);
  await mkdir(storedPath('media'), { recursive: true });
  await writeFile(file, bytes, { flag: 'wx' });
  try {
    const info = await probe(file);
    const video = info.streams.find(s => s.codec_type === 'video');
    if (!video || !video.width || !video.height || video.width * video.height > 50000000) throw new Error('Mídia sem imagem válida ou com resolução excessiva.');
    if (extension === 'mp4' && !(Number(info.format.duration) > 0)) throw new Error('Vídeo sem duração válida.');
    return store.put('media', { id, name, mime: input.mime, kind: extension === 'mp4' ? 'video' : 'image', file: relative, bytes: bytes.length, sha256: digest(bytes), width: video.width, height: video.height, productId: input.productId || null, ...rights });
  } catch (error) { await unlink(file).catch(() => {}); throw error; }
}
export async function validatedMedia(store, ids, productId) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 12 || new Set(ids).size !== ids.length) throw new Error('Selecione de 1 a 12 mídias autorizadas, sem duplicatas.');
  const media = [];
  for (const id of ids) {
    const item = store.get(id, 'media');
    if (!item) throw new Error('Uma mídia selecionada não existe.');
    validateRights(item);
    if (productId && item.productId !== productId) throw new Error('Use mídias associadas ao produto selecionado.');
    const file = storedPath(item.file);
    if ((await stat(file)).size !== item.bytes || await fileDigest(file) !== item.sha256) throw new Error(`Arquivo de mídia alterado: ${item.name}. Importe novamente.`);
    media.push(item);
  }
  return media;
}
export async function validateArtifacts(render, keys = ['video', 'narration', 'subtitles', 'credits', 'manifest', 'thumbnail']) {
  if (!render?.validatedAt || !render.artifacts) throw new Error('Não há entrega validada.');
  for (const key of keys) {
    const artifact = render.artifacts[key];
    if (!artifact || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error(`Arquivo final ausente: ${key}.`);
    const file = storedPath(artifact.file);
    if ((await stat(file)).size !== artifact.bytes || await fileDigest(file) !== artifact.sha256) throw new Error(`Arquivo final alterado: ${key}. Produza novamente.`);
  }
}
