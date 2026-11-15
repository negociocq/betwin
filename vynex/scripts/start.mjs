import {createWebServer} from '../services/api/web.mjs';
import { createApi } from '../services/api/server.mjs';
import { ensureOllama } from './ollama.mjs';
import { assertPortAvailable } from './ports.mjs';

const webPort = Number(process.env.WEB_PORT || 3001);
const apiPort = Number(process.env.API_PORT || 8100);
if (webPort === 3000 || apiPort === 3000) throw new Error('A porta 3000 é reservada ao AuxPlus.');
if (webPort === apiPort) throw new Error('Frontend e backend precisam de portas diferentes.');
try {
  await assertPortAvailable(webPort);
  await assertPortAvailable(apiPort);
} catch (error) {
  console.error(`Vynex: ${error.message}`);
  process.exit(1);
}
const api = createApi();
const ollamaStartup = ensureOllama();
const web=createWebServer({api,apiPort});
let stopping;
const stop = () => stopping ||= (async () => { web.close(); await api.close(); const ollama = await ollamaStartup; ollama?.close(); })();
for (const server of [api.server, web]) server.on('error', error => { console.error(`Vynex: ${error.message}`); stop(); process.exitCode = 1; });
api.server.listen(apiPort, '127.0.0.1', () => console.log(`API Vynex: http://127.0.0.1:${apiPort}`));
web.listen(webPort, '127.0.0.1', () => console.log(`Vynex: http://127.0.0.1:${webPort}`));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('message', async message => { if (message === 'shutdown') { await stop(); process.disconnect?.(); } });

