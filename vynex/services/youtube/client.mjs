import { randomBytes, createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { now } from '../api/store.mjs';
const projectFingerprint=project=>digest(JSON.stringify(project)); // Legacy upload helper; GTA uses its validated direct adapter.
import { storedPath, validatedMedia, validateArtifacts, digest } from '../media/library.mjs';
import { createVault } from './vault.mjs';

const scopes = ['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly'];
export function youtubeConfig() {
  return { clientId: process.env.YOUTUBE_CLIENT_ID || '', clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '', redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://127.0.0.1:8100/api/youtube/oauth/callback' };
}
export function uploadMetadata(project, topic, credits) {
  if (project.platform !== 'youtube') throw new Error('Selecione um projeto YouTube.');
  if (typeof project.madeForKids !== 'boolean') throw new Error('Declare se o vídeo é destinado a crianças antes de enviar.');
  if (!topic?.sources?.length || topic.sources.some(s => !s.reviewed)) throw new Error('Associe um tema com fontes revisadas manualmente.');
  const title = project.title.trim();
  if (!title || title.length > 100 || /[<>]/.test(title)) throw new Error('O título do YouTube deve ter até 100 caracteres, sem < ou >.');
  const description = `${project.description || ''}\n\nFontes:\n${topic.sources.map(s => `${s.title}: ${s.url} (consulta ${s.retrievedAt})`).join('\n')}\n\n${credits}`;
  if (Buffer.byteLength(description, 'utf8') > 5000 || /[<>]/.test(description)) throw new Error('Descrição com créditos e fontes excede o limite de 5000 bytes ou contém < ou >. Edite-a antes de enviar.');
  if (project.render?.outputLicense === 'CC-BY-SA-4.0') throw new Error('CC BY-SA: compatibilidade da distribuição no YouTube exige revisão de direitos. Use mídias com direitos compatíveis antes de enviar pela API.');
  return { snippet: { title, description, categoryId: '27', defaultLanguage: 'pt-BR', tags: (project.hashtags || []).map(t => t.replace(/^#/, '')).filter(Boolean).slice(0, 10) }, status: { privacyStatus: 'private', selfDeclaredMadeForKids: project.madeForKids } };
}
export function createYouTube({ store, vault = createVault(), clientVault = createVault(undefined,'youtube-client'), fetchImpl = fetch, config = youtubeConfig } = {}) {
  let importedConfig;
  const baseConfig=config;config=()=>importedConfig||baseConfig();
  async function loadClient(){if(!config().clientId&&store.get('youtube-client','integrations'))importedConfig=await clientVault.load();}
  const pending = new Map(); let uploading = false;
  const connection = () => store.get('youtube-connection', 'integrations');
  const configured = () => !!config()?.clientId||!!store.get('youtube-client','integrations');
  async function request(url, options = {}) {
    const response = await fetchImpl(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(120000) });
    return response;
  }
  async function jsonResponse(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code=typeof payload.error==='string'?payload.error:null;
      const reason=payload.error?.errors?.[0]?.reason||payload.error?.details?.find(d=>typeof d.reason==='string')?.reason||code;
      const hints={invalid_grant:'A autorização do YouTube expirou ou foi revogada. Reconecte o canal no Vynex para retomar a leitura de inscritos.',accessNotConfigured:'Ative a YouTube Data API v3 no projeto Google Cloud usado pelas credenciais.',SERVICE_DISABLED:'Ative a YouTube Data API v3 no projeto Google Cloud usado pelas credenciais.',quotaExceeded:'A quota do projeto Google foi atingida. Confira os limites no Google Cloud.',dailyLimitExceeded:'O limite diário do projeto Google foi atingido.',insufficientPermissions:'Reconecte o canal e conceda as permissões solicitadas.',youtubeSignupRequired:'A conta autorizada precisa ter um canal YouTube.'};
      throw new Error(`YouTube/Google HTTP ${response.status}. ${hints[reason]||'Verifique autorização, quota e restrições do projeto.'}`);
    }
    return payload;
  }
  async function access() {
    await loadClient();
    let token = await vault.load();
    if (!token?.accessToken) throw new Error('Conecte seu canal pelo OAuth oficial.');
    if (token.expiresAt < Date.now() + 60000) {
      if (!token.refreshToken) throw new Error('Autorização expirada. Reconecte o canal.');
      const c = config();
      const body = new URLSearchParams({ client_id: c.clientId, grant_type: 'refresh_token', refresh_token: token.refreshToken, ...(c.clientSecret ? { client_secret: c.clientSecret } : {}) });
      const refreshed = await jsonResponse(await request('https://oauth2.googleapis.com/token', { method: 'POST', body }));
      if (!refreshed.access_token || !(refreshed.expires_in > 0)) throw new Error('Resposta de renovação inválida. Reconecte o canal.');
      token = { ...token, accessToken: refreshed.access_token, expiresAt: Date.now() + refreshed.expires_in * 1000 };
      await vault.save(token);
    }
    return token;
  }
  async function verifyProject(projectId, requireConnection = true) {
    const project = store.get(projectId, 'projects');
    if (!project?.render || project.render.projectFingerprint !== projectFingerprint(project)) throw new Error('Produza um vídeo atualizado e validado.');
    if (project.videoStatus !== 'approved' || !project.videoApprovedAt) throw new Error('Aprove o vídeo manualmente antes de enviar.');
    await validatedMedia(store, project.mediaIds);
    await validateArtifacts(project.render);
    const credits = await readFile(storedPath(project.render.artifacts.credits.file), 'utf8');
    const metadata = uploadMetadata(project, store.get(project.topicId, 'topics'), credits);
    if (requireConnection && (!configured() || !connection()?.channelId)) throw new Error('Configure as credenciais e conecte o canal pelo OAuth oficial.');
    return { project, metadata };
  }
  return {
    async prepareAuthorization(){await loadClient();return this.beginAuthorization();},
    async configureClient(input){
      if(uploading||connection()?.channelId)throw Error('Desconecte o canal antes de trocar as credenciais Google.');
      const c=input?.installed;
      if(!c||typeof c.client_id!=='string'||!c.client_id.endsWith('.apps.googleusercontent.com')||typeof c.client_secret!=='string'||!c.client_secret||c.client_secret.length>4096||c.client_id.length>500)throw Error('Importe o JSON OAuth de aplicativo Desktop baixado do Google Cloud.');
      const value={clientId:c.client_id,clientSecret:c.client_secret,redirectUri:'http://127.0.0.1:'+(process.env.API_PORT||8100)+'/api/youtube/oauth/callback'};
      const fileName=typeof input.fileName==='string'?input.fileName.replace(/[\\/\x00-\x1f]/g,'').slice(0,240):null;
      await clientVault.save(value);importedConfig=value;store.put('integrations',{id:'youtube-client',configuredAt:now(),fileName});return this.status();
    },
    async authorizedRequest(url,options){if(!/^https:\/\/(www\.googleapis\.com|youtube\.googleapis\.com)\//.test(url))throw Error('Destino Google inválido.');const token=await access();return request(url,{...options,headers:{...options?.headers,Authorization:'Bearer '+token.accessToken}});},
    status() { const c = connection(); return { configured: configured(), clientFileName:store.get('youtube-client','integrations')?.fileName||null,connected: !!c?.channelId, channelId: c?.channelId || null, channelTitle: c?.channelTitle || null, automaticPublication: false, liveIntegrationValidated: store.list('uploads').some(u => u.channelId === c?.channelId && u.status === 'uploaded_private'), scopes }; },
    beginAuthorization() {
      const c = config(); if (!c.clientId) throw new Error('Configure YOUTUBE_CLIENT_ID e o cliente OAuth de aplicativo desktop no .env.');
      const redirect = new URL(c.redirectUri);
      if (redirect.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(redirect.hostname) || redirect.pathname !== '/api/youtube/oauth/callback' || redirect.port !== String(process.env.API_PORT || 8100)) throw new Error('O redirect OAuth deve apontar para o callback local da API Vynex.');
      for (const [key, value] of pending) if (value.expiresAt < Date.now()) pending.delete(key);
      if (pending.size > 20) throw new Error('Muitas autorizações pendentes; aguarde a expiração.');
      const state = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
      pending.set(state, { verifier, expiresAt: Date.now() + 600000 });
      const params = new URLSearchParams({ client_id: c.clientId, redirect_uri: c.redirectUri, response_type: 'code', scope: scopes.join(' '), access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },
    async finishAuthorization(query) {
      const session = pending.get(query.get('state')); pending.delete(query.get('state'));
      if (!session || session.expiresAt < Date.now()) throw new Error('Estado OAuth inválido ou expirado. Reinicie a conexão.');
      if (query.get('error') || !query.get('code')) throw new Error('Autorização Google não concedida.');
      const c = config();
      const token = await jsonResponse(await request('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code: query.get('code'), client_id: c.clientId, redirect_uri: c.redirectUri, code_verifier: session.verifier, ...(c.clientSecret ? { client_secret: c.clientSecret } : {}) }) }));
      if (!token.access_token || !(token.expires_in > 0)) throw new Error('Resposta OAuth incompleta.');
      if (!scopes.every(scope => token.scope?.split(' ').includes(scope))) throw new Error('As permissões necessárias não foram concedidas.');
      const channels = await jsonResponse(await request('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${token.access_token}` } }));
      const channel = channels.items?.[0]; if (!channel?.id) throw new Error('Nenhum canal YouTube foi confirmado pela API.');
      await vault.save({ accessToken: token.access_token, refreshToken: token.refresh_token || null, expiresAt: Date.now() + token.expires_in * 1000, sessions: {}, channelId: channel.id });
      store.put('integrations', { id: 'youtube-connection', channelId: channel.id, channelTitle: channel.snippet.title, connectedAt: now() });
      return this.status();
    },
    async disconnect() { if (uploading) throw new Error('Aguarde o envio em andamento antes de desconectar.'); await vault.clear(); store.remove('youtube-connection', 'integrations'); store.configure({ automation: false }); return this.status(); },
    async preflight(projectId) { try { const { metadata } = await verifyProject(projectId); return { ready: true, privacy: 'private', metadata, automaticPublication: false, liveIntegrationValidated: false }; } catch (error) { return { ready: false, reasons: [error.message], automaticPublication: false, liveIntegrationValidated: false }; } },
    async uploadPrivate(projectId, confirmed) {
      if (confirmed !== true) throw new Error('O envio exige confirmação manual explícita.');
      if (uploading) throw new Error('Já há um envio em andamento.');
      uploading = true; let receipt;
      try {
        const { project, metadata } = await verifyProject(projectId);
        const token = await access();
        const artifact = project.render.artifacts.video;
        const id = 'youtube-' + digest(token.channelId + ':' + artifact.sha256);
        receipt = store.get(id, 'uploads');
        if (receipt?.status === 'uploaded_private') return receipt;
        const previous = token.sessions?.[id];
        if (receipt && !previous) throw new Error('Envio anterior requer conciliação manual para impedir duplicação.');
        receipt = store.put('uploads', { ...receipt, id, channelId: token.channelId, projectId, title: project.title, artifactSha256: artifact.sha256, status: 'initiating' });
        const auth = { Authorization: `Bearer ${token.accessToken}` };
        let uploadUrl = previous, offset = 0, result;
        if (!uploadUrl) {
          const started = await request('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json; charset=utf-8', 'X-Upload-Content-Length': String(artifact.bytes), 'X-Upload-Content-Type': 'video/mp4' }, body: JSON.stringify(metadata) });
          if (!started.ok || !started.headers.get('location')) throw new Error(`Não foi possível iniciar o envio (HTTP ${started.status}).`);
          uploadUrl = started.headers.get('location');
          const target = new URL(uploadUrl);
          if (target.protocol !== 'https:' || target.hostname !== 'www.googleapis.com' || !target.pathname.startsWith('/upload/')) throw new Error('URL de envio retornada pela API não autorizada.');
          token.sessions = { ...token.sessions, [id]: uploadUrl }; await vault.save(token);
        } else {
          const resumed = await request(uploadUrl, { method: 'PUT', headers: { ...auth, 'Content-Length': '0', 'Content-Range': `bytes */${artifact.bytes}` } });
          if (resumed.status === 308) {
            const range = resumed.headers.get('range');
            if (range && !/^bytes=0-\d+$/.test(range)) throw new Error('Intervalo de retomada inválido.');
            offset = range ? Number(range.split('-')[1]) + 1 : 0;
          } else result = await jsonResponse(resumed);
        }
        if (!result) {
          // Recheck the approved local file immediately before transferring bytes.
          await verifyProject(projectId);
          if (offset >= artifact.bytes) throw new Error('Envio remoto requer conciliação de status.');
          receipt = store.put('uploads', { ...receipt, status: 'transferring' });
          result = await jsonResponse(await request(uploadUrl, { method: 'PUT', duplex: 'half', headers: { ...auth, 'Content-Type': 'video/mp4', 'Content-Length': String(artifact.bytes - offset), ...(offset ? { 'Content-Range': `bytes ${offset}-${artifact.bytes - 1}/${artifact.bytes}` } : {}) }, body: createReadStream(storedPath(artifact.file), { start: offset }) }));
        }
        if (!result.id || typeof result.id !== 'string') throw new Error('API não confirmou o ID do vídeo. O envio não foi marcado como concluído.');
        receipt = store.put('uploads', { ...receipt, videoId: result.id, status: 'verifying' });
        const remote = await jsonResponse(await request(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(result.id)}`, { headers: auth }));
        const confirmedVideo = remote.items?.find(item => item.id === result.id);
        if (!confirmedVideo || confirmedVideo.status?.privacyStatus !== 'private' || !['uploaded','processed'].includes(confirmedVideo.status?.uploadStatus)) throw new Error('Status remoto não confirmou o envio privado. Verifique o YouTube Studio antes de repetir.');
        receipt = store.put('uploads', { ...receipt, status: 'uploaded_private', videoId: result.id, remoteUploadStatus: confirmedVideo.status.uploadStatus, confirmedAt: now() });
        return receipt;
      } catch (error) { if (receipt) store.put('uploads', { ...receipt, status: 'needs_reconciliation', error: error.message }); throw error; }
      finally { uploading = false; }
    }
  };
}
