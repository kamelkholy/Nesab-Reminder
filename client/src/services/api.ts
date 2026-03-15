const API_BASE = 'http://localhost:3001/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

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

export const sendReminder = () =>
  request<{ success: boolean; message: string }>('/zakat/remind', { method: 'POST' });

// Settings
export const getSettings = () => request<import('../types').Settings>('/zakat/settings');

export const updateSettings = (settings: Partial<import('../types').Settings>) =>
  request<{ success: boolean }>('/zakat/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
