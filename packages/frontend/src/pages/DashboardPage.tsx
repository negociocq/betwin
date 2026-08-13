import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';

interface KPI {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [kpis, setKpis] = useState<KPI[]>([
    {
      label: 'Total Trades',
      value: '0',
      change: '0%',
      changeType: 'neutral',
    },
    {
      label: 'Profit/Loss',
      value: '€0.00',
      change: '+0%',
      changeType: 'neutral',
    },
    {
      label: 'Win Rate',
      value: '0%',
      change: '-',
      changeType: 'neutral',
    },
    {
      label: 'Drawdown',
      value: '0%',
      change: '-',
      changeType: 'neutral',
    },
  ]);

  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [systemStatus, setSystemStatus] = useState({
    backend: 'checking',
    frontend: 'running',
    database: 'pending',
    betfair: 'pending',
  });

  useEffect(() => {
    // Check backend health
    fetch('/api/health')
      .then(res => res.json())
      .then(() => {
        setStatus('connected');
        setSystemStatus(prev => ({ ...prev, backend: 'running' }));
      })
      .catch(() => {
        setStatus('disconnected');
        setSystemStatus(prev => ({ ...prev, backend: 'error' }));
      });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-50 dark:bg-green-900';
      case 'pending':
        return 'bg-gray-50 dark:bg-gray-700';
      case 'error':
        return 'bg-red-50 dark:bg-red-900';
      default:
        return 'bg-yellow-50 dark:bg-yellow-900';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return '✓';
      case 'pending':
        return '⊘';
      case 'error':
        return '✕';
      default:
        return '⏳';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-600 dark:text-green-400';
      case 'pending':
        return 'text-gray-600 dark:text-gray-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-yellow-600 dark:text-yellow-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow rounded-lg mb-8 p-6">
        <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Bem-vindo, {user?.username || user?.email?.split('@')[0] || 'Trader'}! 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Plataforma de Análise Quantitativa - Betfair Exchange
            </p>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
            status === 'connected'
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}>
            {status === 'connected' ? '🟢 Backend Conectado' : '🔴 Backend Desconectado'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-2">
                {kpi.label}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {kpi.value}
              </p>
              {kpi.change && (
                <p
                  className={`text-sm font-semibold ${
                    kpi.changeType === 'positive'
                      ? 'text-green-600 dark:text-green-400'
                      : kpi.changeType === 'negative'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {kpi.change}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Info Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuração */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              ⚙️ Configuração da Conta
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Email</span>
                <span className="text-gray-900 dark:text-white font-semibold text-sm">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Modo de Trading</span>
                <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm font-semibold">
                  {user?.trading_mode || 'PAPER'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Capital Virtual</span>
                <span className="text-gray-900 dark:text-white font-semibold">€{user?.account_balance?.toLocaleString() || '10,000.00'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Saldo Disponível</span>
                <span className="text-gray-900 dark:text-white font-semibold">€{user?.account_balance?.toLocaleString() || '10,000.00'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Status Betfair</span>
                <span className="text-red-600 dark:text-red-400 font-semibold">Não Conectado</span>
              </div>
            </div>
          </div>

          {/* Status do Sistema */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              ✓ Status do Sistema
            </h2>
            <div className="space-y-3">
              {/* Backend */}
              <div className={`flex items-center p-3 rounded ${getStatusColor(systemStatus.backend)}`}>
                <span className={`${getStatusTextColor(systemStatus.backend)} mr-2 text-lg font-bold`}>
                  {getStatusIcon(systemStatus.backend)}
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  Backend API: {systemStatus.backend === 'running' ? 'Rodando' : systemStatus.backend === 'error' ? 'Erro' : 'Verificando...'}
                </span>
              </div>

              {/* Frontend */}
              <div className={`flex items-center p-3 rounded ${getStatusColor(systemStatus.frontend)}`}>
                <span className={`${getStatusTextColor(systemStatus.frontend)} mr-2 text-lg font-bold`}>
                  {getStatusIcon(systemStatus.frontend)}
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  Frontend Dashboard: Rodando
                </span>
              </div>

              {/* Database */}
              <div className={`flex items-center p-3 rounded ${getStatusColor(systemStatus.database)}`}>
                <span className={`${getStatusTextColor(systemStatus.database)} mr-2 text-lg font-bold`}>
                  {getStatusIcon(systemStatus.database)}
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  Database: Aguardando Setup
                </span>
              </div>

              {/* Autenticação Betfair */}
              <div className={`flex items-center p-3 rounded ${getStatusColor(systemStatus.betfair)}`}>
                <span className={`${getStatusTextColor(systemStatus.betfair)} mr-2 text-lg font-bold`}>
                  {getStatusIcon(systemStatus.betfair)}
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  Autenticação Betfair: Aguardando
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            🚀 Roadmap de Desenvolvimento
          </h2>
          <div className="space-y-3">
            <div className="flex items-start">
              <span className="text-green-600 text-lg mr-3 font-bold">✓</span>
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300 font-semibold">
                  <strong>Fase 1:</strong> Setup e Infraestrutura Base
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">✓ GitHub + Vercel + Supabase configurados</p>
              </div>
            </div>

            <div className="flex items-start">
              <span className="text-blue-600 text-lg mr-3 font-bold">●</span>
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300 font-semibold">
                  <strong>Fase 2:</strong> Autenticação e Database (EM PROGRESSO)
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">✓ Login/Signup implementados • ⏳ Database Supabase • ⏳ Tabelas SQL</p>
              </div>
            </div>

            <div className="flex items-start">
              <span className="text-gray-400 text-lg mr-3">-</span>
              <div className="flex-1">
                <p className="text-gray-500 dark:text-gray-400 font-semibold">
                  <strong>Fase 3:</strong> Integração API Betfair
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">OAuth2 • Rate Limiting • Sincronização de Mercados</p>
              </div>
            </div>

            <div className="flex items-start">
              <span className="text-gray-400 text-lg mr-3">-</span>
              <div className="flex-1">
                <p className="text-gray-500 dark:text-gray-400 font-semibold">
                  <strong>Fases 4-10:</strong> Analytics, Signals, Risk, Paper Trading, Backtest
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-600 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
            ℹ️ Informações Importantes
          </h3>
          <ul className="text-blue-800 dark:text-blue-300 space-y-2 text-sm">
            <li>✓ A plataforma está em <strong>PAPER TRADING MODE</strong> - sem risco real</li>
            <li>✓ Todas as operações são simuladas com capital virtual de €{user?.account_balance?.toLocaleString() || '10,000'}</li>
            <li>✓ Nenhuma credencial da Betfair foi salva localmente</li>
            <li>✓ Use as páginas de <strong>Mercados</strong>, <strong>Sinais</strong> e <strong>Trading</strong> para explorar funcionalidades</li>
            <li>✓ Seus dados estão armazenados de forma segura no Supabase</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/markets"
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 text-center"
          >
            📈 Explorar Mercados
          </a>
          <a
            href="/trading"
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 text-center"
          >
            💹 Começar a Tradear
          </a>
          <a
            href="/settings"
            className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 text-center"
          >
            ⚙️ Configurações
          </a>
        </div>
      </main>
    </div>
  );
}

