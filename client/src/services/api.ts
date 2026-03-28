const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: getAuthHeaders(),
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

// Auth
export const login = (username: string, password: string) =>
  fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    return res.json() as Promise<{ token: string; username: string }>;
  });

export const verifyToken = () =>
  fetch(`${API_BASE}/auth/verify`, {
    headers: getAuthHeaders(),
  }).then((res) => res.ok);

// Assets
export const getAssets = () => request<import('../types').Asset[]>('/assets');

export const createAsset = (asset: Omit<import('../types').Asset, 'id' | 'created_at' | 'updated_at' | 'hijri_date'>) =>
  request<import('../types').Asset>('/assets', {
    method: 'POST',
    body: JSON.stringify(asset),
  });

export const updateAsset = (id: string, asset: Partial<import('../types').Asset>) =>
  request<import('../types').Asset>(`/assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(asset),
  });

export const deleteAsset = (id: string) =>
  request<{ success: boolean }>(`/assets/${id}`, { method: 'DELETE' });

// Zakat
export const getZakatSummary = () => request<import('../types').ZakatSummary>('/zakat/summary');

export const getZakatRecords = () => request<import('../types').ZakatRecord[]>('/zakat/records');

export const generateZakatRecords = () =>
  request<{ success: boolean; records: import('../types').ZakatRecord[] }>('/zakat/generate', {
    method: 'POST',
  });

export const markZakatPaid = (id: string) =>
  request<{ success: boolean }>(`/zakat/pay/${id}`, { method: 'POST' });

export const addZakatPayment = (recordId: string, payment: { amount: number; date_gregorian: string; note?: string }) =>
  request<{ success: boolean; payment: import('../types').ZakatPayment }>(`/zakat/records/${recordId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payment),
  });

export const deleteZakatPayment = (paymentId: string) =>
  request<{ success: boolean }>(`/zakat/payments/${paymentId}`, { method: 'DELETE' });

export const deleteZakatRecord = (id: string) =>
  request<{ success: boolean }>(`/zakat/records/${id}`, { method: 'DELETE' });

export const sendReminder = () =>
  request<{ success: boolean; message: string }>('/zakat/remind', { method: 'POST' });

// Settings
export const getSettings = () => request<import('../types').Settings>('/zakat/settings');

export const updateSettings = (settings: Partial<import('../types').Settings>) =>
  request<{ success: boolean }>('/zakat/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

export const fetchExchangeRate = () =>
  request<{ rate: number }>('/zakat/fetch-exchange-rate');

export const fetchGoldPrice = () =>
  request<{ price_per_gram_egp: number; gold_per_oz_usd: number; usd_to_egp: number }>('/zakat/fetch-gold-price');

export const fetchStockPrice = (ticker: string) =>
  request<{ ticker: string; price: number }>(`/zakat/fetch-stock-price/${encodeURIComponent(ticker)}`);

export const refreshAllStockPrices = () =>
  request<{ success: boolean; results: { ticker: string; price: number | null; updated: boolean }[] }>('/zakat/refresh-stock-prices', {
    method: 'POST',
  });
