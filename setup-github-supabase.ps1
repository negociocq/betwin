#!/usr/bin/env pwsh

# Betwin - GitHub + Supabase Setup Script
# Este script configura automaticamente GitHub e Supabase

Write-Host "🚀 Betwin - GitHub + Supabase Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Solicitar informações do usuário
Write-Host "Por favor, forneça as seguintes informações:" -ForegroundColor Yellow
Write-Host ""

$githubUsername = Read-Host "GitHub Username"
$supabaseUrl = Read-Host "Supabase Project URL (ex: https://xxxx.supabase.co)"
$supabaseAnonKey = Read-Host "Supabase Anon Key"
$supabaseServiceRoleKey = Read-Host "Supabase Service Role Key"
$githubEmail = Read-Host "GitHub Email"
$githubName = Read-Host "GitHub Name"

Write-Host ""
Write-Host "Configurando..." -ForegroundColor Cyan
Write-Host ""

# Navegar para o diretório do projeto
Set-Location "C:\Users\Premium PC\dyad-apps\betwin"

# Configurar Git
Write-Host "1️⃣  Configurando Git..." -ForegroundColor Green
git config user.email $githubEmail
git config user.name $githubName

# Remover remote anterior e adicionar novo
git remote remove origin 2>$null
git remote add origin "https://github.com/$githubUsername/betwin.git"

Write-Host "✓ Git configurado" -ForegroundColor Green
Write-Host ""

# Criar .env.local do frontend
Write-Host "2️⃣  Criando .env.local do Frontend..." -ForegroundColor Green

$frontendEnv = @"
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_ENV=development

# Supabase Configuration
VITE_SUPABASE_URL=$supabaseUrl
VITE_SUPABASE_ANON_KEY=$supabaseAnonKey
"@

Set-Content -Path "packages/frontend/.env.local" -Value $frontendEnv
Write-Host "✓ Frontend .env.local criado" -ForegroundColor Green
Write-Host ""

# Criar .env do backend
Write-Host "3️⃣  Criando .env do Backend..." -ForegroundColor Green

# Extrair informações do Supabase URL
$projectId = $supabaseUrl -replace 'https://', '' -replace '.supabase.co', ''

$backendEnv = @"
NODE_ENV=development
PORT=3000

# Supabase (Backend)
SUPABASE_URL=$supabaseUrl
SUPABASE_SERVICE_ROLE_KEY=$supabaseServiceRoleKey
DATABASE_URL=postgresql://postgres:seu-postgres-password@$projectId.supabase.co:5432/postgres

# Betfair
BETFAIR_APP_ID=seu-app-id-aqui
PAPER_TRADING_ONLY=true

# JWT
JWT_SECRET=seu-jwt-secret-minimo-32-caracteres-long-aqui

# Logging
LOG_LEVEL=debug
"@

Set-Content -Path "packages/backend/.env" -Value $backendEnv
Write-Host "✓ Backend .env criado" -ForegroundColor Green
Write-Host ""

# Git Add e Commit
Write-Host "4️⃣  Preparando primeiro commit..." -ForegroundColor Green
git add .
git commit -m "feat: initial betwin setup with frontend, backend, and supabase integration

- React 18 dashboard with dark mode support
- Express.js backend API
- Supabase PostgreSQL database integration
- Paper trading mode by default
- Type-safe TypeScript throughout
- Responsive UI with Tailwind CSS"

Write-Host "✓ Primeiro commit pronto" -ForegroundColor Green
Write-Host ""

# Git Push
Write-Host "5️⃣  Enviando para GitHub..." -ForegroundColor Green
git branch -M main
git push -u origin main

Write-Host "✓ Código enviado para GitHub" -ForegroundColor Green
Write-Host ""

# Informações finais
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✅ Configuração Concluída!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📊 Informações da Integração:" -ForegroundColor Yellow
Write-Host "  GitHub: https://github.com/$githubUsername/betwin" -ForegroundColor White
Write-Host "  Supabase: $supabaseUrl" -ForegroundColor White
Write-Host ""

Write-Host "⚠️  PRÓXIMAS ETAPAS:" -ForegroundColor Yellow
Write-Host "  1. Acesse seu Supabase e execute o SQL para criar as tabelas"
Write-Host "  2. Atualize o .env do backend com a senha do PostgreSQL"
Write-Host "  3. Execute: npm install && npm run dev"
Write-Host "  4. Frontend estará em: http://localhost:5173"
Write-Host "  5. Backend estará em: http://localhost:3000"
Write-Host ""

Write-Host "📄 Arquivo SQL para Supabase: Veja SETUP_GITHUB_SUPABASE.md" -ForegroundColor Cyan
Write-Host ""
