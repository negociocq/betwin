# Vynex no projeto betwin

Esta implantação pertence exclusivamente a `negociocq/betwin` e ao projeto Vercel `betwin`. O endereço é https://betwin-three.vercel.app.

## Funcionamento

- `/` apresenta a plataforma; `/login` autentica usuários; `/app/` exige uma sessão válida antes de carregar os projetos.
- O projeto Supabase **Vynex** (`uswtmedhueodidquspkx`) contém autenticação nativa, perfis, sessões revogáveis e workspaces individuais. RLS e permissões impedem acesso público às sessões, hashes e dados internos. Cada workspace tem criptografia AES-256-GCM com contexto do titular e gravações por versão.
- A conta proprietária mantém seus dados e seu login. O hash scrypt antigo é validado uma única vez no primeiro login e convertido em senha nativa do Supabase Auth; nenhuma senha em texto é armazenada. Mudanças de senha revogam sessões anteriores.
- Vídeos e imagens ficam em Blob privado. Após autenticação, a API emite links assinados temporários para assistir e baixar sem transmitir vídeos grandes por uma Function.
- O painel mostra a última sincronização e uma fila de solicitações. Configurar, gerar e publicar envia um comando ao agente Windows existente. A resposta 202 significa solicitação salva, não vídeo gerado ou publicação realizada.
- “Gerar vídeo agora” cria uma unidade manual adicional, sem aprovar ou publicar. O agente recebe um Broadcast privado do Supabase; as etapas reais são exibidas durante busca, seleção, renderização, validação e upload. A conclusão só é gravada após as mídias estarem disponíveis no painel. Se o computador estiver desligado, o comando permanece aguardando.
- O compositor `product-scenes-v2` exige a foto do produto retornada pela API Shopee. Usa fotos autorizadas e ilustrações preparadas para aquele item; vistas por IA têm identificação em cada cena. Não cria um cartão sem produto quando a imagem está indisponível. Cada galeria é vinculada ao item e ao hash da referência para evitar misturar produtos ou variações.
- As ilustrações dos quatro produtos existentes foram preparadas nesta atualização. Produtos novos usam a foto disponível e seus enquadramentos; perspectivas adicionais por IA não são geradas automaticamente sem preparar novas referências. “Refazer com fotos” mantém os arquivos anteriores, invalida a aprovação e bloqueia substituição de conteúdos publicados ou agendados.
- As conexões Shopee permitem escolher YouTube, Instagram, TikTok, Pinterest e Facebook entre os canais retornados pelo Buffer. O limite vem de `Organization.limits.channels` e considera a organização inteira. O nome comercial do plano não é inferido. Kwai continua com exportação manual, pois não consta no catálogo oficial do Buffer.
- O computador com o Vynex deve ficar ligado. O agente existente está vinculado exclusivamente à conta proprietária e não executa comandos de outros usuários. Novas contas começam sem vídeos, conexões ou agente. Configurações próprias ficam salvas; geração e integrações exigem um agente exclusivo, ainda não provisionado automaticamente.
- As credenciais das plataformas permanecem no cofre Windows. Credenciais informadas pelo painel entram na fila criptografada e são removidas do comando ao concluir. Não existem cookies de plataforma ou APIs privadas nesta integração.

## Limites

Cadastros usam confirmação de e-mail obrigatória, por escolha do titular. `VYNEX_EMAIL_READY=false` mantém o cadastro público aguardando SMTP. Não desligar a confirmação para contornar essa etapa. Quando o serviço de e-mail estiver configurado, atualizar a variável e validar confirmação via PKCE antes de liberar cadastros. O preço de R$ 197 permanece uma apresentação comercial; cobrança automática não foi implementada.

O workspace anterior no Blob foi preservado como backup. Vídeos continuam em Blob privado. O Supabase recebe somente os dados e credenciais necessários à aplicação; a chave de serviço fica exclusivamente no servidor.

Pinterest continua sujeito à autorização e permissões reais da plataforma. A fila de Pins exige revisão, aprovação e teste real antes de ser ativada. Shopee Vídeo requer exportação e envio manual, pois nenhuma API oficial de publicação foi validada. Nenhuma venda ou audiência é garantida.

A hospedagem utiliza o plano Hobby existente. Não foi contratada expansão paga. O armazenamento e as operações respeitam as cotas disponíveis; novos arquivos precisam de retenção e monitoramento quando a biblioteca crescer.

## Configuração Vercel

Node 24, `npm ci --ignore-scripts`, `npm run build`, saída `vynex/apps`.

Variáveis protegidas: `BLOB_READ_WRITE_TOKEN`, `VYNEX_CLOUD_SECRET`, `VYNEX_AGENT_HASH`, `VYNEX_PUBLIC_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VYNEX_OWNER_ID`, `VYNEX_EMAIL_READY=false` e `VYNEX_EMAIL_CONFIRMATION=true`. As variáveis Supabase não são injetadas no JavaScript público.

Não publicar `.env*`, `.credentials.env`, cofres DPAPI, SQLite, mídia ou caches no Git. Um arquivo de credenciais legado foi retirado da árvore atual; isso não remove cópias do histórico Git nem revoga suas chaves. A rotação de credenciais de serviços externos depende do titular desses serviços.

## Validação

`npm test` verifica persistência de sessões entre runtimes, criptografia, conflitos de gravação, proteção da API, fila e logout. `npm run build` verifica o ponto de entrada da Function.

A migração `supabase/migrations/20261115000100_vynex_accounts.sql` cria o esquema isolado. A integração foi validada com duas contas temporárias: migração de senha, login, isolamento de dados, bloqueio de escalada de permissões, RLS, revogação de sessões e logout. As contas de teste foram removidas.

Os diretórios legados de Betfair permanecem preservados no repositório e excluídos da implantação. Os endpoints antigos de negociação foram removidos da versão publicada.
