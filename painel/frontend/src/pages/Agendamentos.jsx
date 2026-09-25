import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function Agendamentos() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      let url = '/agendamentos?limit=500';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (filterPayment) url += `&status_pagamento=${encodeURIComponent(filterPayment)}`;
      const data = await apiRequest(url);
      setAgendamentos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterPayment]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleTogglePayment = async (ag) => {
    const nextStatus = ag.status_pagamento === 'pago' ? 'pendente' : 'pago';
    try {
      await apiRequest(`/agendamentos/${ag.id}/status-pagamento`, {
        method: 'PATCH',
        body: JSON.stringify({ status_pagamento: nextStatus })
      });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSavePrice = async () => {
    if (!editingItem) return;
    try {
      await apiRequest(`/agendamentos/${editingItem.id}/status-pagamento`, {
        method: 'PATCH',
        body: JSON.stringify({
          status_pagamento: editingItem.status_pagamento,
          valor_cobrado: parseFloat(editPrice) || 0
        })
      });
      setEditingItem(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja remover este registro de agendamento?')) return;
    try {
      await apiRequest(`/agendamentos/${id}`, { method: 'DELETE' });
      loadData();
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
          <h1 className="page-title">Agendamentos e lancamentos</h1>
          <p className="page-subtitle">Historico de vagas obtidas e controle de recebimentos</p>
        </div>
        <button className="btn btn-secondary" onClick={loadData}>
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
                style={{ minWidth: '240px' }}
                placeholder="Buscar por cliente, evento ou data..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="form-input"
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
              >
                <option value="">Todos os status de pagamento</option>
                <option value="pendente">Apenas pendentes</option>
                <option value="pago">Apenas pagos</option>
              </select>

              <button type="submit" className="btn btn-primary">
                Buscar
              </button>

              {search && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearch('');
                    setTimeout(loadData, 0);
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
                  <th>Data registro</th>
                  <th>Cliente</th>
                  <th>Evento e data</th>
                  <th>Local / Encontro</th>
                  <th>Tipo</th>
                  <th>Valor cobrado</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      Carregando agendamentos...
                    </td>
                  </tr>
                ) : agendamentos.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      Nenhum agendamento encontrado
                    </td>
                  </tr>
                ) : (
                  agendamentos.map((ag) => (
                    <tr key={ag.id}>
                      <td>
                        <div>{ag.data_agendamento || '-'}</div>
                        <small style={{ color: 'var(--text-muted)' }}>ID #{ag.id}</small>
                      </td>
                      <td>
                        <strong>{ag.client_name}</strong>
                        {ag.client_document && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {ag.client_document}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{ag.evento}</div>
                        <small style={{ color: 'var(--text-secondary)' }}>
                          Data do evento: {ag.data_evento || '-'} {ag.horario ? `• ${ag.horario}` : ''}
                        </small>
                      </td>
                      <td>
                        <div style={{ maxWidth: '200px', fontSize: '12px' }}>
                          {ag.ponto_encontro !== '-' && ag.ponto_encontro ? ag.ponto_encontro : ag.endereco || '-'}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{ag.tipo_vaga}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatCurrency(ag.valor_cobrado)}</div>
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            padding: 0
                          }}
                          onClick={() => {
                            setEditingItem(ag);
                            setEditPrice(ag.valor_cobrado);
                          }}
                        >
                          Editar valor
                        </button>
                      </td>
                      <td>
                        <span className={`badge ${ag.status_pagamento === 'pago' ? 'badge-paid' : 'badge-pending'}`}>
                          {ag.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleTogglePayment(ag)}
                          >
                            {ag.status_pagamento === 'pago' ? 'Marcar pendente' : 'Marcar pago'}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--status-error-text)' }}
                            onClick={() => handleDelete(ag.id)}
                          >
                            Remover
                          </button>
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

      {editingItem && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Editar valor cobrado</h2>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingItem(null)}
              >
                Fechar
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Ajuste o valor cobrado para o agendamento de <strong>{editingItem.client_name}</strong>.
              </p>
              <div className="form-group">
                <label className="form-label">Valor cobrado (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  className="form-input"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingItem(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSavePrice}>
                Salvar alteracao
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
