import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile, rename, unlink,access } from 'node:fs/promises';

async function protect(operation, content,purpose) {
  if (process.platform !== 'win32') throw new Error('O cofre de tokens desta versão requer Windows DPAPI.');
  return new Promise((accept, reject) => {
    const child = execFile('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('scripts/protect-secret.ps1'),'-Operation',operation,'-Purpose',purpose], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout) => error ? reject(new Error('Não foi possível acessar o cofre DPAPI do usuário Windows.')) : accept(stdout.trim()));
    child.stdin.on('error', () => {}); child.stdin.end(content);
  });
}
export function createVault(directory = resolve('data', 'integrations'),purpose='youtube') {
  if(!['youtube','youtube-client','azure-speech','buffer','shopee-affiliate'].includes(purpose))throw Error('Finalidade de cofre inválida.');
  const file = resolve(directory, purpose+'.dpapi');
  return {
    async exists(){try{await access(file);return true;}catch{return false;}},
    async load() { let encrypted; try { encrypted = await readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } return JSON.parse(await protect('unprotect', encrypted,purpose)); },
    async save(value) { const encrypted = await protect('protect', JSON.stringify(value),purpose); await mkdir(directory, { recursive: true }); await writeFile(file + '.tmp', encrypted, { mode: 0o600 }); await rename(file + '.tmp', file); },
    async clear() { await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  };
}
