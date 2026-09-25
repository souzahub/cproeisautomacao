import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function Dashboard({ onNavigate }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/billing/metrics');
      setMetrics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleTogglePayment = async (agendamento) => {
    const nextStatus = agendamento.status_pagamento === 'pago' ? 'pendente' : 'pago';
    try {
      await apiRequest(`/agendamentos/${agendamento.id}/status-pagamento`, {
        method: 'PATCH',
        body: JSON.stringify({ status_pagamento: nextStatus })
      });
      loadMetrics();
    } catch (err) {
      alert(err.message);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  if (loading && !metrics) {
    return (
      <div className="content-body">
        <div style={{ color: 'var(--text-muted)' }}>Carregando dados...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header">
        <div>
          <h1 className="page-title">Visao geral</h1>
          <p className="page-subtitle">Acompanhamento consolidado de agendamentos e faturamento</p>
        </div>
        <button className="btn btn-secondary" onClick={loadMetrics}>
          Atualizar
        </button>
      </div>

      <div className="content-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total de agendamentos</div>
            <div className="stat-value">{metrics?.total_agendamentos || 0}</div>
            <div className="stat-desc">Vagas confirmadas</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Clientes ativos</div>
            <div className="stat-value">{metrics?.total_clientes || 0}</div>
            <div className="stat-desc">Perfis gerenciados</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Faturamento previsto</div>
            <div className="stat-value">{formatCurrency(metrics?.total_faturado)}</div>
            <div className="stat-desc">Preco base: {formatCurrency(metrics?.preco_padrao_agendamento)}/vaga</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Pendente de cobranca</div>
            <div className="stat-value" style={{ color: 'var(--status-warning-text)' }}>
              {formatCurrency(metrics?.total_pendente)}
            </div>
            <div className="stat-desc">Aguardando recebimento</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total recebido</div>
            <div className="stat-value" style={{ color: 'var(--status-success-text)' }}>
              {formatCurrency(metrics?.total_pago)}
            </div>
            <div className="stat-desc">Pagamentos liquidados</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Ultimos agendamentos realizados</div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('agendamentos')}>
              Ver todos
            </button>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Cliente</th>
                  <th>Evento</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Pagamento</th>
                  <th style={{ textAlign: 'right' }}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(!metrics?.ultimos_agendamentos || metrics.ultimos_agendamentos.length === 0) ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      Nenhum agendamento sincronizado ainda
                    </td>
                  </tr>
                ) : (
                  metrics.ultimos_agendamentos.map((ag) => (
                    <tr key={ag.id}>
                      <td>{ag.data_agendamento || ag.data_evento}</td>
                      <td>
                        <strong>{ag.client_name}</strong>
                      </td>
                      <td>
                        <div>{ag.evento}</div>
                        <small style={{ color: 'var(--text-muted)' }}>{ag.convenio}</small>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{ag.tipo_vaga}</span>
                      </td>
                      <td>{formatCurrency(ag.valor_cobrado)}</td>
                      <td>
                        <span className={`badge ${ag.status_pagamento === 'pago' ? 'badge-paid' : 'badge-pending'}`}>
                          {ag.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleTogglePayment(ag)}
                        >
                          {ag.status_pagamento === 'pago' ? 'Marcar pendente' : 'Marcar pago'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
