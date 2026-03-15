import { useEffect, useState } from 'react';
import { ZakatSummary, ZakatRecord } from '../types';
import {
  getZakatSummary,
  getZakatRecords,
  generateZakatRecords,
  markZakatPaid,
  sendReminder,
} from '../services/api';
import { Calculator, Mail, CheckCircle, RefreshCw } from 'lucide-react';

const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
  'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', 'Shaban',
  'Ramadan', 'Shawwal', 'Dhul Qadah', 'Dhul Hijjah',
];

function formatHijri(hijriDate: string): string {
  const parts = hijriDate.split('/');
  if (parts.length !== 3) return hijriDate;
  const month = HIJRI_MONTHS[parseInt(parts[1]) - 1] || parts[1];
  return `${parseInt(parts[2])} ${month} ${parts[0]} AH`;
}

interface Props {
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function ZakatPage({ showToast }: Props) {
  const [summary, setSummary] = useState<ZakatSummary | null>(null);
  const [records, setRecords] = useState<ZakatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [s, r] = await Promise.all([getZakatSummary(), getZakatRecords()]);
      setSummary(s);
      setRecords(r);
    } catch (err) {
      showToast('Failed to load zakat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      await generateZakatRecords();
      showToast('Zakat records generated', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to generate records', 'error');
    }
  };

  const handlePay = async (id: number) => {
    try {
      await markZakatPaid(id);
      showToast('Marked as paid', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to mark as paid', 'error');
    }
  };

  const handleSendReminder = async () => {
    setSending(true);
    try {
      const result = await sendReminder();
      showToast(result.message, result.success ? 'success' : 'error');
    } catch (err) {
      showToast('Failed to send reminder', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="page-header"><h2>Loading...</h2></div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Zakat Calculator</h2>
          <p>Calculate and track your Zakat obligations based on Hijri calendar</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleGenerate}>
            <RefreshCw size={16} /> Recalculate
          </button>
          <button className="btn btn-gold" onClick={handleSendReminder} disabled={sending}>
            <Mail size={16} /> {sending ? 'Sending...' : 'Send Reminder'}
          </button>
        </div>
      </div>

      {summary && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="label">Total Wealth (EGP)</div>
              <div className="value">{summary.totalWealthEGP.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</div>
            </div>
            <div className="stat-card gold">
              <div className="label">Nisab Threshold</div>
              <div className="value">{summary.nisabThresholdEGP.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</div>
              <div className="sub">85 grams of gold</div>
            </div>
            <div className={`stat-card ${summary.isAboveNisab ? 'danger' : ''}`}>
              <div className="label">Total Zakat Due</div>
              <div className="value">{summary.totalZakatDue.toFixed(2)} EGP</div>
              <div className="sub">
                {summary.isAboveNisab ? 'Above Nisab - Zakat applicable' : 'Below Nisab - No Zakat due'}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Eligible Wealth (EGP)</div>
              <div className="value">
                {summary.eligibleAssets
                  .filter(a => a.hawlComplete)
                  .reduce((sum, a) => sum + a.amountEGP, 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
              </div>
              <div className="sub">
                {summary.eligibleAssets.filter(a => a.hawlComplete).length} asset{summary.eligibleAssets.filter(a => a.hawlComplete).length !== 1 ? 's' : ''} with hawl complete
              </div>
            </div>
          </div>
        </>
      )}

      {records.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Zakat Records</h3>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Hijri Year</th>
                  <th>Amount Due</th>
                  <th>Due Date (Hijri)</th>
                  <th>Due Date (Gregorian)</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.hijri_year} AH</td>
                    <td><strong>{record.amount_due.toFixed(2)} EGP</strong></td>
                    <td>{formatHijri(record.due_date_hijri)}</td>
                    <td>{new Date(record.due_date_gregorian).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                    <td>
                      {record.is_paid ? (
                        <span className="badge badge-success">Paid</span>
                      ) : (
                        <span className="badge badge-danger">Unpaid</span>
                      )}
                    </td>
                    <td>
                      {!record.is_paid && (
                        <button className="btn btn-sm btn-primary" onClick={() => handlePay(record.id)}>
                          <CheckCircle size={14} /> Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ background: 'var(--color-primary-light)', border: '1px solid #b7dfb7' }}>
        <h3 style={{ marginBottom: 12 }}>How Zakat is Calculated</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li><strong>Nisab:</strong> Your total wealth must exceed the value of 85 grams of gold.</li>
          <li><strong>Hawl:</strong> Each asset must be held for one full Hijri (lunar) year.</li>
          <li><strong>Rate:</strong> Zakat is 2.5% of the value of each eligible asset.</li>
          <li><strong>Calendar:</strong> All dates are tracked using the Hijri calendar for accuracy.</li>
        </ul>
      </div>
    </div>
  );
}
