# Publicação do Vynex

Estado: aplicação local funcional. Nenhum repositório, implantação ou DNS foi alterado nesta preparação.

## Acessos necessários

Conectar GitHub e Vercel. Confirmar o domínio completo do projeto Betwin e a organização Vercel que o possui. Consultar o projeto e os registros atuais antes de substituir o site; preservar registros de e-mail e serviços que não pertençam ao site antigo.

## O que pode ir para o GitHub

Código, testes e arquivos de apresentação. O repositório deve começar privado. `.gitignore` exclui banco local, credenciais, sessões de navegador, ferramentas de IA e vídeos exportados. Não publicar `.env`, arquivos DPAPI, bancos SQLite nem perfis de navegador.

## O que exige adaptação para a nuvem

- **Banco e sessões:** o código atual usa SQLite no disco e arquivos JSON mutáveis. A implantação Vercel não oferece persistência desses arquivos. Migrar dados, usuários e sessões para armazenamento persistente antes de publicar o painel funcional.
- **Credenciais:** DPAPI depende do Windows e do usuário local. Não copiar seus arquivos para a Vercel. As integrações da nuvem precisam de armazenamento apropriado de segredos e nova autorização quando necessário.
- **Vídeos:** FFmpeg, Python, modelos de voz, arquivos de mídia e processos contínuos não cabem no fluxo atual de funções Vercel. Manter inicialmente um agente local autenticado ou usar um worker separado, com armazenamento persistente para os arquivos.
- **Agendamento:** substituir os temporizadores em memória por execução durável e idempotente. Preservar recibos existentes para não reenviar publicações.
- **URLs públicas:** substituir callbacks localhost por URLs HTTPS reais, configurar origens permitidas e cookies Secure. Usar um domínio de prévia antes da troca do DNS.
- **Acesso:** a versão atual é de proprietário único. Vender acessos independentes exige isolamento de usuários e credenciais, licenciamento e confirmação de pagamento, que ainda não estão implementados.

## Sequência

1. Verificar os acessos e identificar o projeto Betwin correto.
2. Preparar o repositório privado sem dados locais.
3. Definir banco persistente e execução dos vídeos; migrar e testar em prévia.
4. Testar login, sessões, conexões, geração e publicação autorizada na arquitetura escolhida.
5. Só então vincular o domínio existente à versão funcional, preservando os registros necessários.

Publicar apenas os arquivos visuais deixaria o painel e suas automações sem funcionamento. A apresentação pode ser publicada separadamente, mas não equivale à migração completa do Vynex.

Referências oficiais: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel e https://vercel.com/docs/domains/working-with-domains/add-a-domain.
