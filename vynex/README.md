# Vynex - Shopee e GTA 6

## Apresentação e acesso

**http://localhost:3001/** apresenta a plataforma e os módulos Shopee e GTA 6.

No primeiro acesso, abra **/cadastro** e crie o proprietário desta instalação. Depois use **/login** para entrar. O estúdio fica em **/app/**. O cadastro é local e de proprietário único, sem liberar suas conexões a novos usuários. Não existe confirmação nem recuperação de senha por e-mail configurada.

Senhas são armazenadas com salt e scrypt. Sessões usam cookies HttpOnly e expiram em sete dias; Sair revoga a sessão no servidor. O banco, os arquivos e os cofres existentes foram preservados. As automações locais continuam executando independentemente do login no navegador.

## Estúdio unificado

Use o seletor no topo ou as pastas do menu para trocar de projeto. Ambos têm Visão geral, Vídeos gerados, Configurações e Conexões.

Na Shopee, Configurações permite escolher nicho, busca, meta de 1 a 3 vídeos por dia, horários e filtros. A geração automática fica desligada até você ativar; o lote manual segue a mesma meta diária. Novos conteúdos sempre ficam para revisão, sem aprovação ou publicação automática. Sem novas ofertas elegíveis, o sistema informa a pendência e não repete produtos.

Campanhas sazonais calcula sugestões para Natal, Black Friday, Dia das Mães, Dia dos Pais, Namorados, Crianças e Ano Novo. A antecedência é editável entre 7 e 90 dias. A ativação é explícita e muda as próximas buscas, sem alterar vídeos existentes. Depois da data, a busca retorna ao nicho normal. Black Friday mantém a busca do nicho; a API validada não comprova descontos.

Os horários de produção configurados são usados ao planejar novos Pins aprovados. Alterações não reescrevem agendamentos já enviados. A publicação pelo Buffer continua sem validação; a fila Pinterest usa OAuth direto e exige teste aprovado.

Abra INICIAR.cmd e acesse http://localhost:3001.

Somente dois projetos: Shopee e GTA 6. Configure as contas em http://localhost:3001/#connections.

- Shopee: API oficial, produtos, previas, aprovacao e fila Pinterest. Buffer separado; envio Buffer ainda precisa ser validado. Shopee Video continua manual.
- GTA 6: biblioteca, cortes, dublagem PT-BR, horarios, canais e recibos anteriores preservados.

## Seus arquivos

output/shopee-official: icone e kit de publicacao.
output/gta6-corte: videos GTA.
data: SQLite, cofres e configuracoes.
storage: arquivos internos dos dois projetos; caminhos existentes preservados.

apps, services, scripts, tests e .tools sao pastas tecnicas. Apenas dependencias dos dois projetos foram mantidas. Python, FFmpeg, ASR e Supertonic sao usados na renderizacao e na dublagem GTA. Nao alteramos modelos externos a este diretorio.

npm test: testes. npm run check: sintaxe.

Relatorio: data/maintenance/cleanup-result.json.
Copia unica do banco antes da limpeza: data/maintenance/antes-limpeza.sqlite. Nao e usada pelo aplicativo.

Mantenha o computador ligado para executar as tarefas locais. Conexao pendente nao equivale a publicacao confirmada. A automacao nao garante vendas.
