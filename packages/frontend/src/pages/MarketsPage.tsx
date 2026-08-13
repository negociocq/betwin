import React, { useState } from 'react';

interface Market {
  id: string;
  name: string;
  sport: string;
  totalMatched: string;
  inPlay: boolean;
  runners: number;
}

export default function MarketsPage() {
  const [markets] = useState<Market[]>([
    {
      id: '1.210562695',
      name: 'Manchester United vs Arsenal',
      sport: 'Football',
      totalMatched: '€1.5M',
      inPlay: false,
      runners: 3,
    },
    {
      id: '1.210562696',
      name: 'Liverpool vs Chelsea',
      sport: 'Football',
      totalMatched: '€2.3M',
      inPlay: true,
      runners: 3,
    },
    {
      id: '1.210562697',
      name: 'Wimbledon Tennis - Match 1',
      sport: 'Tennis',
      totalMatched: '€800K',
      inPlay: false,
      runners: 2,
    },
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          📈 Mercados
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Explore mercados disponíveis na Betfair Exchange
        </p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Buscar mercado..."
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <select className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600">
            <option>Todos os Esportes</option>
            <option>Football</option>
            <option>Tennis</option>
            <option>Basketball</option>
          </select>
          <select className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600">
            <option>Todos</option>
            <option>In Play</option>
            <option>Não Iniciados</option>
          </select>
        </div>
      </div>

      {/* Markets Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                Mercado
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                Esporte
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                Total Matched
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                Status
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {markets.map((market) => (
              <tr
                key={market.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {market.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {market.sport}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {market.totalMatched}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      market.inPlay
                        ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    }`}
                  >
                    {market.inPlay ? '🔴 In Play' : '🟢 Não Iniciado'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors">
                    Analisar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div className="mt-6 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-600 p-4 rounded">
        <p className="text-yellow-800 dark:text-yellow-200 text-sm">
          ⚠️ <strong>Nota:</strong> Conecte sua conta Betfair em Configurações para carregar mercados reais
        </p>
      </div>
    </div>
  );
}

