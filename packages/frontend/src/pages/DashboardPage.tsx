import React, { useState, useEffect } from 'react';

interface KPI {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export default function DashboardPage() {
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

  useEffect(() => {
    // Tentar conectar ao backend
    fetch('http://localhost:3000/health')
      .then(() => setStatus('connected'))
      .catch(() => setStatus('disconnected'));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Plataforma de Análise Quantitativa - Betfair Exchange
              </p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
              status === 'connected'
                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
            }`}>
              {status === 'connected' ? '🟢 Backend Conectado' : '🔴 Backend Desconectado'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Configuração */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              ⚙️ Configuração
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Modo de Trading</span>
                <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm font-semibold">
                  PAPER
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Capital Virtual</span>
                <span className="text-gray-900 dark:text-white font-semibold">€10,000.00</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Saldo Disponível</span>
                <span className="text-gray-900 dark:text-white font-semibold">€10,000.00</span>
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
              <div className="flex items-center p-3 bg-green-50 dark:bg-green-900 rounded">
                <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Backend API: Rodando</span>
              </div>
              <div className="flex items-center p-3 bg-green-50 dark:bg-green-900 rounded">
                <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Frontend Dashboard: Rodando</span>
              </div>
              <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-600 dark:text-gray-400 mr-2">⊘</span>
                <span className="text-gray-700 dark:text-gray-300">Database: Aguardando Setup</span>
              </div>
              <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-600 dark:text-gray-400 mr-2">⊘</span>
                <span className="text-gray-700 dark:text-gray-300">Autenticação Betfair: Aguardando</span>
              </div>
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            🚀 Roadmap de Desenvolvimento
          </h2>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="text-green-600 text-lg">✓</span>
              <span className="ml-3 text-gray-700 dark:text-gray-300">
                <strong>Fase 1:</strong> Setup e Infraestrutura Base
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-400 text-lg">⏳</span>
              <span className="ml-3 text-gray-700 dark:text-gray-300">
                <strong>Fase 2:</strong> Autenticação Betfair (próxima)
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-400 text-lg">-</span>
              <span className="ml-3 text-gray-500 dark:text-gray-400">
                <strong>Fase 3:</strong> Integração API Betfair
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-400 text-lg">-</span>
              <span className="ml-3 text-gray-500 dark:text-gray-400">
                <strong>Fase 4-10:</strong> Analytics, Signals, Risk, Trading, etc.
              </span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-600 p-6 rounded">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
            ℹ️ Informações Importantes
          </h3>
          <ul className="text-blue-800 dark:text-blue-300 space-y-1 text-sm">
            <li>✓ A plataforma está em <strong>PAPER TRADING MODE</strong> - sem risco real</li>
            <li>✓ Todas as operações são simuladas com capital virtual de €10,000</li>
            <li>✓ Nenhuma credencial da Betfair foi salva localmente</li>
            <li>✓ Use as páginas de <strong>Mercados</strong>, <strong>Sinais</strong> e <strong>Trading</strong> para explorar funcionalidades</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

