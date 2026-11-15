# Vynex no projeto betwin

Esta implantação pertence exclusivamente a `negociocq/betwin` e ao projeto Vercel `betwin`. O endereço é https://betwin-three.vercel.app.

## Funcionamento

- `/` apresenta a plataforma; `/login` autentica a conta proprietária; `/app/` exige uma sessão válida antes de carregar os projetos.
- Conta, sessões e dados do painel persistem em um workspace criptografado com AES-256-GCM no Vercel Blob privado. SQLite em `/tmp` serve apenas para processar uma requisição; não é a persistência do sistema.
- Vídeos e imagens ficam em Blob privado. Após autenticação, a API emite links assinados temporários para assistir e baixar sem transmitir vídeos grandes por uma Function.
- O painel mostra a última sincronização e uma fila de solicitações. Configurar, gerar e publicar envia um comando ao agente Windows existente. A resposta 202 significa solicitação salva, não vídeo gerado ou publicação realizada.
- O computador com o Vynex deve ficar ligado. O agente consulta a fila a cada dez minutos, executa as APIs locais autorizadas e sincroniza resultados. Comandos reclamados nunca são retomados automaticamente após resultado incerto, evitando duplicar publicações.
- As credenciais das plataformas permanecem no cofre Windows. Credenciais informadas pelo painel entram na fila criptografada e são removidas do comando ao concluir. Não existem cookies de plataforma ou APIs privadas nesta integração.

## Limites

O cadastro é de um único proprietário por workspace. O preço de R$ 197 é uma apresentação comercial; não há cobrança ou provisionamento de clientes implementados.

Pinterest continua sujeito à autorização e permissões reais da plataforma. A fila de Pins exige revisão, aprovação e teste real antes de ser ativada. Shopee Vídeo requer exportação e envio manual, pois nenhuma API oficial de publicação foi validada. Nenhuma venda ou audiência é garantida.

A hospedagem utiliza o plano Hobby existente. Não foi contratada expansão paga. O armazenamento e as operações respeitam as cotas disponíveis; novos arquivos precisam de retenção e monitoramento quando a biblioteca crescer.

## Configuração Vercel

Node 24, `npm ci --ignore-scripts`, `npm run build`, saída `vynex/apps`.

Variáveis protegidas: `BLOB_READ_WRITE_TOKEN`, `VYNEX_CLOUD_SECRET` (64 caracteres hexadecimais), `VYNEX_AGENT_HASH` (SHA-256 do token do agente), `VYNEX_PUBLIC_URL` e `VYNEX_CLOUD_RUNTIME=true`.

Não publicar `.env*`, `.credentials.env`, cofres DPAPI, SQLite, mídia ou caches no Git. Um arquivo de credenciais legado foi retirado da árvore atual; isso não remove cópias do histórico Git nem revoga suas chaves. A rotação de credenciais de serviços externos depende do titular desses serviços.

## Validação

`npm test` verifica persistência de sessões entre runtimes, criptografia, conflitos de gravação, proteção da API, fila e logout. `npm run build` verifica o ponto de entrada da Function.

Os diretórios legados de Betfair permanecem preservados no repositório e excluídos da implantação. Os endpoints antigos de negociação foram removidos da versão publicada.
