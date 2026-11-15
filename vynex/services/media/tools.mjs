import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
const voiceCatalog=()=>[]; // Voice production lives in the dedicated GTA dubbing pipeline.

const exec = promisify(execFile);
export function binary(name) {
  const configured = process.env[name.toUpperCase() + '_PATH'];
  if (configured) return resolve(configured);
  const local = resolve('.tools', 'ffmpeg', 'bin', name + (process.platform === 'win32' ? '.exe' : ''));
  return existsSync(local) ? local : name;
}
export async function command(executable, args, options = {}) {
  try {
    return await exec(executable, args, { windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 * 1024, ...options });
  } catch (error) {
    if (error.name === 'AbortError' || options.signal?.aborted) throw new Error('Processamento interrompido.');
    const detail = String(error.stderr || error.message).trim().slice(-2500);
    throw new Error(`${executable.split(/[\\/]/).pop()}: ${detail}`);
  }
}
export async function probe(file, signal) {
  const { stdout } = await command(binary('ffprobe'), ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { signal, timeout: 15000 });
  return JSON.parse(stdout);
}
export async function voices() {
  if (process.platform !== 'win32') return [];
  const { stdout } = await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve('scripts/speech.ps1'), '-Operation', 'voices'], { timeout: 10000 });
  return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
}
export async function localHealth() {
  const version = async name => {
    try { const { stdout } = await command(binary(name), ['-version'], { timeout: 5000 }); return { available: true, version: stdout.split(/\r?\n/)[0] }; }
    catch { return { available: false }; }
  };
  const [ffmpeg, ffprobe, installedVoices] = await Promise.all([version('ffmpeg'), version('ffprobe'), voices().catch(() => [])]);
  const brazilian = installedVoices.filter(v => v.culture === 'pt-BR' && v.enabled);
  const aiVoices=voiceCatalog();
  return { ffmpeg, ffprobe, narration: {provider:'local-ai', available:aiVoices.some(v=>v.available), voices:aiVoices}, speech: { provider: 'windows-sapi-legacy', available: brazilian.length > 0, voices: installedVoices, selectedVoice: process.env.TTS_VOICE || brazilian[0]?.name || null } };
}
