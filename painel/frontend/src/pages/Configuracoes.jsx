import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function Configuracoes() {
  const [defaultPrice, setDefaultPrice] = useState('30.00');
  const [syncSecret, setSyncSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/settings');
      setDefaultPrice(String(data.default_slot_price || 30.0));
      setSyncSecret(data.sync_secret_key || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');

    try {
      await apiRequest('/settings', {
        method: 'POST',
        body: JSON.stringify({
          default_slot_price: parseFloat(defaultPrice) || 0,
          sync_secret_key: syncSecret
        })
      });
      setFeedback('Configuracoes salvas');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="content-header">
        <div>
          <h1 className="page-title">Configuracoes</h1>
          <p className="page-subtitle">Parametros de cobranca global e seguranca da sincronizacao</p>
        </div>
      </div>

      <div className="content-body" style={{ maxWidth: '640px' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Parametros financeiros e sincronizacao</div>
          </div>
          <div className="card-body">
            {feedback && (
              <div
                style={{
                  backgroundColor: 'var(--status-success-bg)',
                  border: '1px solid var(--status-success-border)',
                  color: 'var(--status-success-text)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  marginBottom: '16px'
                }}
              >
                {feedback}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Valor padrao cobrado por agendamento (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  className="form-input"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  required
                />
                <small style={{ color: 'var(--text-muted)' }}>
                  Este valor sera aplicado automaticamente a todos os novos agendamentos confirmados, exceto quando o cliente possuir valor customizado.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Chave secreta de sincronizacao (Sync Secret Key)</label>
                <input
                  type="text"
                  className="form-input"
                  value={syncSecret}
                  onChange={(e) => setSyncSecret(e.target.value)}
                  required
                />
                <small style={{ color: 'var(--text-muted)' }}>
                  A mesma chave configurada na variavel SYNC_SECRET_KEY do seu arquivo .env local.
                </small>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || loading}
                style={{ marginTop: '8px' }}
              >
                {saving ? 'Salvando...' : 'Salvar configuracoes'}
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Integracao com o sistema local</div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Para que o sistema local envie os agendamentos e clientes automaticamente para este painel, configure as seguintes variaveis no arquivo <strong>.env</strong> do sistema local:
            </p>
            <div
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                marginTop: '12px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: 'var(--text-primary)'
              }}
            >
              <div>PAINEL_URL=https://seu-painel.easypanel.host</div>
              <div>SYNC_SECRET_KEY={syncSecret || 'sua_chave_secreta_aqui'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
