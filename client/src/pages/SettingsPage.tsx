import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../services/api';
import { Settings } from '../types';
import { Save } from 'lucide-react';

interface Props {
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function SettingsPage({ showToast }: Props) {
  const [settings, setSettings] = useState<Settings>({ email_to: '', gold_price_per_gram_egp: '3750', usd_to_egp_rate: '50' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        email_to: settings.email_to,
        gold_price_per_gram_egp: settings.gold_price_per_gram_egp,
        usd_to_egp_rate: settings.usd_to_egp_rate,
      });
      showToast('Settings saved', 'success');
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-header"><h2>Loading...</h2></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
        <p>Configure your Zakat calculation and notification preferences</p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 20 }}>General Settings</h3>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Email Address (for Zakat reminders)</label>
            <input
              type="email"
              value={settings.email_to}
              onChange={(e) => setSettings({ ...settings, email_to: e.target.value })}
              placeholder="your-email@example.com"
            />
            <small style={{ color: 'var(--color-text-secondary)', marginTop: 4, display: 'block' }}>
              Zakat reminder emails will be sent to this address.
            </small>
          </div>

          <div className="form-group">
            <label>Gold Price per Gram (EGP)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={settings.gold_price_per_gram_egp}
              onChange={(e) => setSettings({ ...settings, gold_price_per_gram_egp: e.target.value })}
              placeholder="3750.00"
            />
            <small style={{ color: 'var(--color-text-secondary)', marginTop: 4, display: 'block' }}>
              Used to calculate the Nisab threshold (85 grams × gold price).
              Current Nisab = {(85 * parseFloat(settings.gold_price_per_gram_egp || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
            </small>
          </div>

          <div className="form-group">
            <label>USD to EGP Exchange Rate</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={settings.usd_to_egp_rate}
              onChange={(e) => setSettings({ ...settings, usd_to_egp_rate: e.target.value })}
              placeholder="50.00"
            />
            <small style={{ color: 'var(--color-text-secondary)', marginTop: 4, display: 'block' }}>
              Used to convert USD assets to EGP for Zakat calculation.
              1 USD = {parseFloat(settings.usd_to_egp_rate || '0').toFixed(2)} EGP
            </small>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Email Configuration</h3>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
          To enable email reminders, configure the following environment variables in the server's <code>.env</code> file:
        </p>
        <div style={{ background: '#f8faf8', padding: 16, borderRadius: 8, marginTop: 12, fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.8 }}>
          SMTP_HOST=smtp.gmail.com<br />
          SMTP_PORT=587<br />
          SMTP_USER=your-email@gmail.com<br />
          SMTP_PASS=your-app-password<br />
        </div>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 12, fontSize: '0.85rem' }}>
          For Gmail, you need to use an App Password. Go to Google Account → Security → 2-Step Verification → App passwords.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Automatic Reminders</h3>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
          The server automatically checks every day at 8:00 AM if any Zakat is due based on the Hijri calendar.
          If your total wealth exceeds the Nisab threshold and any asset has completed its Hawl (one Hijri year),
          a reminder email will be sent to the configured email address.
        </p>
      </div>
    </div>
  );
}
