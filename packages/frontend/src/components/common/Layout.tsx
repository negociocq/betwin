import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', label: '📊 Dashboard', icon: '📊' },
    { path: '/markets', label: '📈 Mercados', icon: '📈' },
    { path: '/trading', label: '💹 Trading', icon: '💹' },
    { path: '/analytics', label: '📉 Analytics', icon: '📉' },
    { path: '/signals', label: '🎯 Sinais', icon: '🎯' },
    { path: '/backtest', label: '⏱️ Backtest', icon: '⏱️' },
    { path: '/settings', label: '⚙️ Configurações', icon: '⚙️' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitial = user?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Top Navigation Bar */}
        <nav className="bg-white dark:bg-gray-800 shadow sticky top-0 z-40">
          <div className="px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                ☰
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                🚀 Betwin
              </h1>
              <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full font-semibold">
                PAPER TRADING
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                title={darkMode ? 'Light Mode' : 'Dark Mode'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 pl-4 border-l border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {userInitial}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user?.username || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.trading_mode || 'PAPER'}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {user?.username || user?.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{user?.email}</p>
                    </div>

                    <Link
                      to="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      ⚙️ Configurações
                    </Link>

                    <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                        CONTA
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Modo: <span className="font-semibold text-yellow-600 dark:text-yellow-400">{user?.trading_mode}</span>
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Saldo: <span className="font-semibold text-green-600 dark:text-green-400">€{user?.account_balance?.toLocaleString() || '0.00'}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 border-t border-gray-200 dark:border-gray-700"
                    >
                      🚪 Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        <div className="flex">
          {/* Sidebar */}
          <aside
            className={`${
              sidebarOpen ? 'w-64' : 'w-20'
            } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 fixed h-[calc(100vh-80px)] overflow-y-auto`}
          >
            <div className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={item.label}
                >
                  <span className="text-xl">{item.icon}</span>
                  {sidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                </Link>
              ))}
            </div>

            {/* Sidebar Footer */}
            <div className="absolute bottom-4 left-0 right-0 px-4">
              <div className={`p-3 bg-blue-50 dark:bg-blue-900 rounded-lg ${!sidebarOpen && 'px-2'}`}>
                {sidebarOpen && (
                  <>
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
                      Saldo Virtual
                    </p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      €{user?.account_balance?.toLocaleString() || '10,000'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className={`${sidebarOpen ? 'ml-64' : 'ml-20'} flex-1 transition-all duration-300`}>
            <div className="p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

