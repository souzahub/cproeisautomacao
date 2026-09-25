const API_BASE = '/api';

export function getStoredToken() {
  return localStorage.getItem('cproeis_painel_token');
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('cproeis_painel_token', token);
  } else {
    localStorage.removeItem('cproeis_painel_token');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    setStoredToken(null);
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Sessao expirada');
  }

  if (!response.ok) {
    let errorDetail = 'Erro na requisicao';
    try {
      const errJson = await response.json();
      if (errJson.detail) errorDetail = errJson.detail;
    } catch {
      errorDetail = `Erro HTTP ${response.status}`;
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
