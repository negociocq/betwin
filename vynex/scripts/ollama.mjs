import { spawn } from 'node:child_process';
import { existsSync, createWriteStream, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

export async function ensureOllama() {
  const url = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const available = async () => fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok).catch(() => false);
  if (await available()) return { owned: false, close() {} };
  if (process.env.OLLAMA_AUTOSTART === 'false' || process.platform !== 'win32' || !['http://127.0.0.1:11434','http://localhost:11434'].includes(url)) return null;
  const local = join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
  const executable = existsSync(local) ? local : 'ollama';
  mkdirSync(resolve('data', 'logs'), { recursive: true });
  const output = createWriteStream(resolve('data', 'logs', 'ollama-vynex.log'), { flags: 'a' });
  const child = spawn(executable, ['serve'], { windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434', OLLAMA_NOPRUNE: 'true', OLLAMA_NO_CLOUD: 'true', OLLAMA_MAX_LOADED_MODELS: '1', OLLAMA_NUM_PARALLEL: '1', OLLAMA_CONTEXT_LENGTH: '4096' } });
  let failed = false; child.on('error', () => { failed = true; output.end(); });
  child.stdout?.pipe(output, { end: false }); child.stderr?.pipe(output, { end: false }); child.on('exit', () => output.end());
  for (let i = 0; i < 30; i++) {
    if (failed || child.exitCode !== null) return null;
    if (await available()) return { owned: true, close() { child.kill(); } };
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  child.kill(); return null;
}
