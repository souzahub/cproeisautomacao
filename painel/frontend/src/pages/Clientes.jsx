import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState(null);
  const [customPrice, setCustomPrice] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  const loadClients = async () => {
    try {
      setLoading(true);
      let url = '/clients';
      if (search) url += `?search=${encodeURIComponent(search)}`;
      const data = await apiRequest(url);
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadClients();
  };

  const handleEditClick = (c) => {
    setEditingClient(c);
    setCustomPrice(c.valor_agendamento !== null && c.valor_agendamento !== undefined ? c.valor_agendamento : '');
    setClientPhone(c.phone || '');
  };

  const handleSaveClient = async () => {
    if (!editingClient) return;
    try {
      const priceVal = customPrice === '' ? null : parseFloat(customPrice);
      await apiRequest(`/clients/${editingClient.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          phone: clientPhone,
          valor_agendamento: priceVal
        })
      });
      setEditingClient(null);
      loadClients();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMarkAllPaid = async (clientName) => {
    if (!window.confirm(`Deseja marcar todos os agendamentos pendentes de ${clientName} como pagos?`)) return;
    try {
      await apiRequest(`/agendamentos/marcar-todos-pagos?client_name=${encodeURIComponent(clientName)}`, {
        method: 'POST'
      });
      loadClients();
    } catch (err) {
      alert(err.message);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  return (
    <div>
      <div className="content-header">
        <div>
          <h1 className="page-title">Clientes e cobranca</h1>
          <p className="page-subtitle">Gestao de clientes sincronizados, precos customizados e saldo financeiro</p>
        </div>
        <button className="btn btn-secondary" onClick={loadClients}>
          Atualizar
        </button>
      </div>

      <div className="content-body">
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSearchSubmit} className="filter-bar">
              <input
                type="text"
                className="form-input"
                style={{ minWidth: '260px' }}
                placeholder="Buscar por nome ou CPF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Buscar
              </button>
              {search && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearch('');
                    setTimeout(loadClients, 0);
                  }}
                >
                  Limpar
                </button>
              )}
            </form>
          </div>
        </div>

        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento / Contato</th>
                  <th>Total de vagas</th>
                  <th>Preco por vaga</th>
                  <th>Total faturado</th>
                  <th>Pendente</th>
                  <th>Pago</th>
                  <th style={{ textAlign: 'right' }}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      Carregando clientes...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      Nenhum cliente cadastrado ou sincronizado
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        <div>{c.document || '-'}</div>
                        {c.phone && <small style={{ color: 'var(--text-muted)' }}>{c.phone}</small>}
                      </td>
                      <td>
                        <span className="badge badge-neutral">{c.total_agendamentos} vagas</span>
                      </td>
                      <td>
                        {c.valor_agendamento ? (
                          <div>
                            <strong>{formatCurrency(c.valor_agendamento)}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--accent)' }}>personalizado</div>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)' }}>padrao global</div>
                        )}
                      </td>
                      <td>{formatCurrency(c.total_faturado)}</td>
                      <td>
                        <strong style={{ color: c.total_pendente > 0 ? 'var(--status-warning-text)' : 'inherit' }}>
                          {formatCurrency(c.total_pendente)}
                        </strong>
                      </td>
                      <td style={{ color: 'var(--status-success-text)' }}>
                        {formatCurrency(c.total_pago)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditClick(c)}
                          >
                            Configurar preco
                          </button>
                          {c.total_pendente > 0 && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleMarkAllPaid(c.name)}
                            >
                              Liquidar pendentes
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingClient && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Configurar cobranca: {editingClient.name}</h2>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingClient(null)}
              >
                Fechar
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp</label>
                <input
                  type="text"
                  className="form-input"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(21) 99999-9999"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preco customizado por agendamento (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  className="form-input"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="Deixe em branco para usar o valor padrao"
                />
                <small style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                  Deixe vazio para herdar o preco padrao global definido nas configuracoes.
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingClient(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveClient}>
                Salvar alteracoes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
