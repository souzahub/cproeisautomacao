import React, { useState, useEffect } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from './api/client';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agendamentos from './pages/Agendamentos';
import Clientes from './pages/Clientes';
import Configuracoes from './pages/Configuracoes';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const checkAuth = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await apiRequest('/auth/me');
      setUser(userData);
    } catch {
      setUser(null);
      setStoredToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="login-wrapper">
        <div style={{ color: 'var(--text-muted)' }}>Carregando painel...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={checkAuth} />;
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">Painel CPROEIS</div>
          <div className="sidebar-subtitle">Gestao de vagas e cobranca</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            Visao geral
          </button>

          <button
            className={`nav-item ${currentPage === 'agendamentos' ? 'active' : ''}`}
            onClick={() => setCurrentPage('agendamentos')}
          >
            Agendamentos
          </button>

          <button
            className={`nav-item ${currentPage === 'clientes' ? 'active' : ''}`}
            onClick={() => setCurrentPage('clientes')}
          >
            Clientes e cobranca
          </button>

          <button
            className={`nav-item ${currentPage === 'configuracoes' ? 'active' : ''}`}
            onClick={() => setCurrentPage('configuracoes')}
          >
            Configuracoes
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user.name || user.email}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Sair">
            Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        {currentPage === 'dashboard' && <Dashboard onNavigate={setCurrentPage} />}
        {currentPage === 'agendamentos' && <Agendamentos />}
        {currentPage === 'clientes' && <Clientes />}
        {currentPage === 'configuracoes' && <Configuracoes />}
      </main>
    </div>
  );
}
