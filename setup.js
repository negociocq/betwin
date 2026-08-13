#!/usr/bin/env node

/**
 * Betwin - Automatic GitHub + Supabase Setup
 * Este script configura automaticamente GitHub e Supabase
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = 'C:\\Users\\Premium PC\\dyad-apps\\betwin';

console.log('\n🚀 BETWIN - Automatic GitHub + Supabase Setup');
console.log('='.repeat(50));

try {
  // Ler credenciais do arquivo
  const credentialsPath = path.join(projectRoot, '.credentials.env');

  if (!fs.existsSync(credentialsPath)) {
    console.error('❌ Arquivo .credentials.env não encontrado!');
    console.log('Crie o arquivo com suas credenciais e tente novamente.');
    process.exit(1);
  }

  const credentials = fs.readFileSync(credentialsPath, 'utf8')
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, value] = line.split('=');
      acc[key] = value;
      return acc;
    }, {});

  console.log('\n📋 Credenciais carregadas:');
  console.log(`  GitHub: ${credentials.GITHUB_USERNAME}`);
  console.log(`  Supabase: ${credentials.SUPABASE_URL}`);

  // 1. Configurar Git
  console.log('\n1️⃣  Configurando Git...');
  execSync(`cd "${projectRoot}" && git config user.email "${credentials.GITHUB_EMAIL}"`);
  execSync(`cd "${projectRoot}" && git config user.name "${credentials.GITHUB_NAME}"`);
  console.log('  ✓ Git configurado');

  // 2. Configurar GitHub Remote
  console.log('\n2️⃣  Configurando GitHub Remote...');
  execSync(`cd "${projectRoot}" && git remote remove origin 2>nul || true`);
  execSync(`cd "${projectRoot}" && git remote add origin https://github.com/${credentials.GITHUB_USERNAME}/betwin.git`);
  console.log('  ✓ GitHub remote adicionado');

  // 3. Criar .env.local do Frontend
  console.log('\n3️⃣  Criando .env.local do Frontend...');
  const frontendEnv = `VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_ENV=development
VITE_SUPABASE_URL=${credentials.SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${credentials.SUPABASE_ANON_KEY}
`;
  fs.writeFileSync(path.join(projectRoot, 'packages/frontend/.env.local'), frontendEnv);
  console.log('  ✓ Frontend .env.local criado');

  // 4. Criar .env do Backend
  console.log('\n4️⃣  Criando .env do Backend...');
  const backendEnv = `NODE_ENV=development
PORT=3000
SUPABASE_URL=${credentials.SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${credentials.SUPABASE_SERVICE_ROLE_KEY}
DATABASE_URL=postgresql://postgres:sua-postgres-password@seu-project.supabase.co:5432/postgres
PAPER_TRADING_ONLY=true
JWT_SECRET=seu-jwt-secret-minimo-32-caracteres-long-aqui
LOG_LEVEL=debug
`;
  fs.writeFileSync(path.join(projectRoot, 'packages/backend/.env'), backendEnv);
  console.log('  ✓ Backend .env criado');

  // 5. Git Add e Commit
  console.log('\n5️⃣  Preparando primeiro commit...');
  execSync(`cd "${projectRoot}" && git add . && git commit -m "feat: initial betwin setup with frontend, backend, and supabase integration"`);
  console.log('  ✓ Primeiro commit pronto');

  // 6. Git Push
  console.log('\n6️⃣  Enviando para GitHub...');
  execSync(`cd "${projectRoot}" && git branch -M main && git push -u origin main`);
  console.log('  ✓ Código enviado para GitHub');

  console.log('\n' + '='.repeat(50));
  console.log('✅ Configuração Concluída!');
  console.log('='.repeat(50));

  console.log('\n📊 Próximas etapas:');
  console.log('1. Acesse https://app.supabase.com → seu projeto betwin');
  console.log('2. SQL Editor → New Query');
  console.log('3. Execute o SQL (veja arquivo GITHUB_SUPABASE_SETUP.md)');
  console.log('4. Salve a senha do PostgreSQL no .env do backend');
  console.log('5. Execute: npm run dev');

  console.log('\n🔗 Links:');
  console.log(`  GitHub: https://github.com/${credentials.GITHUB_USERNAME}/betwin`);
  console.log(`  Supabase: https://app.supabase.com`);

} catch (error) {
  console.error('\n❌ Erro:', error.message);
  process.exit(1);
}
