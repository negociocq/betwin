import { createServer } from 'node:net';

export async function assertPortAvailable(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta inválida.');
  await new Promise((accept, reject) => {
    const probe = createServer();
    probe.once('error', error => reject(new Error(error.code === 'EADDRINUSE' ? `A porta ${port} já está ocupada. O Vynex não encerrará processos de outros projetos.` : `Não foi possível usar a porta ${port}: ${error.message}`)));
    probe.listen(port, '127.0.0.1', () => probe.close(accept));
  });
}
