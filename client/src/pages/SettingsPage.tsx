import { useEffect, useState } from 'react';
import { getSettings, updateSettings, fetchExchangeRate, fetchGoldPrice } from '../services/api';
import { Settings } from '../types';
import { Save, RefreshCw } from 'lucide-react';

interface Props {
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function SettingsPage({ showToast }: Props) {
  const [settings, setSettings] = useState<Settings>({
    email_to: '',
    gold_price_per_gram_egp: '3750',
    usd_to_egp_rate: '50',
    gold_price_mode: 'manual',
    usd_egp_mode: 'manual',
    stock_price_mode: 'manual',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingGold, setFetchingGold] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

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
        gold_price_mode: settings.gold_price_mode,
        usd_egp_mode: settings.usd_egp_mode,
        stock_price_mode: settings.stock_price_mode,
      });
      showToast('Settings saved', 'success');
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchGoldPrice = async () => {
    setFetchingGold(true);
    try {
      const data = await fetchGoldPrice();
      setSettings((prev) => ({
        ...prev,
        gold_price_per_gram_egp: data.price_per_gram_egp.toString(),
      }));
      showToast(
        `Gold price fetched: ${data.price_per_gram_egp.toLocaleString()} EGP/gram (${data.gold_per_oz_usd.toLocaleString()} USD/oz)`,
        'success'
      );
    } catch (err) {
      showToast('Failed to fetch gold price. Please enter manually.', 'error');
    } finally {
      setFetchingGold(false);
    }
  };

  const handleFetchExchangeRate = async () => {
    setFetchingRate(true);
    try {
      const data = await fetchExchangeRate();
      setSettings((prev) => ({
        ...prev,
        usd_to_egp_rate: data.rate.toString(),
      }));
      showToast(`Exchange rate fetched: 1 USD = ${data.rate} EGP`, 'success');
    } catch (err) {
      showToast('Failed to fetch exchange rate. Please enter manually.', 'error');
    } finally {
      setFetchingRate(false);
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

          {/* Gold Price Setting */}
          <div className="form-group">
            <label>Gold Price per Gram (EGP)</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="gold_price_mode"
                  value="manual"
                  checked={settings.gold_price_mode === 'manual'}
                  onChange={() => setSettings({ ...settings, gold_price_mode: 'manual' })}
                />
                Enter manually
              </label>
              <label>
                <input
                  type="radio"
                  name="gold_price_mode"
                  value="auto"
                  checked={settings.gold_price_mode === 'auto'}
                  onChange={() => setSettings({ ...settings, gold_price_mode: 'auto' })}
                />
                Fetch from API
              </label>
            </div>
            <div className="input-with-action">
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.gold_price_per_gram_egp}
                onChange={(e) => setSettings({ ...settings, gold_price_per_gram_egp: e.target.value })}
                placeholder="3750.00"
                readOnly={settings.gold_price_mode === 'auto'}
                style={settings.gold_price_mode === 'auto' ? { background: '#f0f0f0', cursor: 'default' } : {}}
              />
              {settings.gold_price_mode === 'auto' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleFetchGoldPrice}
                  disabled={fetchingGold}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <RefreshCw size={14} className={fetchingGold ? 'spin' : ''} />
                  {fetchingGold ? 'Fetching...' : 'Fetch Latest'}
                </button>
              )}
            </div>
            <small style={{ color: 'var(--color-text-secondary)', marginTop: 4, display: 'block' }}>
              Used to calculate the Nisab threshold (85 grams × gold price).
              Current Nisab = {(85 * parseFloat(settings.gold_price_per_gram_egp || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
              {settings.gold_price_mode === 'auto' && (
                <span style={{ display: 'block', marginTop: 2 }}>
                  Source: gold-api.com &amp; open.er-api.com (gold USD/oz converted to EGP/gram)
                </span>
              )}
            </small>
          </div>

          {/* USD to EGP Exchange Rate Setting */}
          <div className="form-group">
            <label>USD to EGP Exchange Rate</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="usd_egp_mode"
                  value="manual"
                  checked={settings.usd_egp_mode === 'manual'}
                  onChange={() => setSettings({ ...settings, usd_egp_mode: 'manual' })}
                />
                Enter manually
              </label>
              <label>
                <input
                  type="radio"
                  name="usd_egp_mode"
                  value="auto"
                  checked={settings.usd_egp_mode === 'auto'}
                  onChange={() => setSettings({ ...settings, usd_egp_mode: 'auto' })}
                />
                Fetch from API
              </label>
            </div>
            <div className="input-with-action">
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.usd_to_egp_rate}
                onChange={(e) => setSettings({ ...settings, usd_to_egp_rate: e.target.value })}
                placeholder="50.00"
                readOnly={settings.usd_egp_mode === 'auto'}
                style={settings.usd_egp_mode === 'auto' ? { background: '#f0f0f0', cursor: 'default' } : {}}
              />
              {settings.usd_egp_mode === 'auto' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleFetchExchangeRate}
                  disabled={fetchingRate}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <RefreshCw size={14} className={fetchingRate ? 'spin' : ''} />
                  {fetchingRate ? 'Fetching...' : 'Fetch Latest'}
                </button>
              )}
            </div>
            <small style={{ color: 'var(--color-text-secondary)', marginTop: 4, display: 'block' }}>
              Used to convert USD assets to EGP for Zakat calculation.
              1 USD = {parseFloat(settings.usd_to_egp_rate || '0').toFixed(2)} EGP
              {settings.usd_egp_mode === 'auto' && (
                <span style={{ display: 'block', marginTop: 2 }}>
                  Source: open.er-api.com (free exchange rate API)
                </span>
              )}
            </small>
          </div>

          {/* Stock Price Setting */}
          <div className="form-group">
            <label>Stock Prices</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="stock_price_mode"
                  value="manual"
                  checked={settings.stock_price_mode === 'manual'}
                  onChange={() => setSettings({ ...settings, stock_price_mode: 'manual' })}
                />
                Enter manually
              </label>
              <label>
                <input
                  type="radio"
                  name="stock_price_mode"
                  value="auto"
                  checked={settings.stock_price_mode === 'auto'}
                  onChange={() => setSettings({ ...settings, stock_price_mode: 'auto' })}
                />
                Fetch from API
              </label>
            </div>
            <small style={{ color: 'var(--color-text-secondary)', marginTop: 4, display: 'block' }}>
              {settings.stock_price_mode === 'auto'
                ? 'Stock prices will be fetched automatically from Yahoo Finance based on each asset\'s ticker symbol. Prices update when the Zakat summary is calculated.'
                : 'Stock prices are entered manually per asset. You can update them on the Assets page.'}
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
          The Hawl (one Hijri year) begins when your <strong>total wealth</strong> first reaches the Nisab threshold
          (85 grams of gold). If your wealth remains above Nisab when the Hawl completes, Zakat of 2.5% is due
          on all zakatable wealth. Assets acquired after the Hawl completion date are excluded from the current
          cycle. If the gold price or exchange rate is set to "Fetch from API", live rates will be used
          automatically. A reminder email will be sent to the configured email address when Zakat is due.
        </p>
      </div>
    </div>
  );
}
