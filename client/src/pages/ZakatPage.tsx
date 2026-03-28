import { useEffect, useRef, useState } from 'react';
import { ZakatSummary, ZakatRecord } from '../types';
import {
  getZakatSummary,
  getZakatRecords,
  generateZakatRecords,
  markZakatPaid,
  addZakatPayment,
  deleteZakatPayment,
  deleteZakatRecord,
  sendReminder,
} from '../services/api';
import { Mail, CheckCircle, RefreshCw, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<{ recordId: string; amount: string; date: string; note: string } | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
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

  const handlePayFull = async (id: string) => {
    try {
      await markZakatPaid(id);
      showToast('Marked as fully paid', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to mark as paid', 'error');
    }
  };

  const handleAddPayment = async () => {
    if (!paymentForm) return;
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    if (!paymentForm.date) {
      showToast('Please select a date', 'error');
      return;
    }
    try {
      await addZakatPayment(paymentForm.recordId, {
        amount,
        date_gregorian: paymentForm.date,
        note: paymentForm.note || undefined,
      });
      showToast('Payment recorded', 'success');
      setPaymentForm(null);
      loadData();
    } catch (err) {
      showToast('Failed to record payment', 'error');
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Delete this payment?')) return;
    try {
      await deleteZakatPayment(paymentId);
      showToast('Payment deleted', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to delete payment', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Zakat record?')) return;
    try {
      await deleteZakatRecord(id);
      showToast('Zakat record deleted', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to delete record', 'error');
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
                {summary.isAboveNisab
                  ? summary.hawlComplete
                    ? summary.zakatableWealthEGP !== summary.totalWealthEGP
                      ? `2.5% of ${summary.zakatableWealthEGP.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP (zakatable wealth)`
                      : 'Above Nisab & Hawl complete - Zakat due'
                    : 'Above Nisab - Hawl pending'
                  : 'Below Nisab - No Zakat due'}
              </div>
            </div>
            <div className="stat-card warning">
              <div className="label">Hawl Status</div>
              <div className="value">{summary.hawlComplete ? 'Complete' : 'Pending'}</div>
              <div className="sub">
                {summary.hawlStartDate
                  ? `Started: ${summary.hawlStartDate}`
                  : 'Wealth has not yet reached Nisab'}
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
                  <th></th>
                  <th>Hijri Year</th>
                  <th>Amount Due</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                  <th>Due Date (Hijri)</th>
                  <th>Due Date (Gregorian)</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const remaining = Math.max(0, record.amount_due - record.amount_paid);
                  const isExpanded = expandedRecord === record.id;
                  return (
                    <>
                      <tr key={record.id}>
                        <td>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '2px 6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                            onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                            title={isExpanded ? 'Collapse' : 'Show payments'}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td>{record.hijri_year} AH</td>
                        <td><strong>{record.amount_due.toFixed(2)} EGP</strong></td>
                        <td>{record.amount_paid.toFixed(2)} EGP</td>
                        <td><strong>{remaining.toFixed(2)} EGP</strong></td>
                        <td>{formatHijri(record.due_date_hijri)}</td>
                        <td>{new Date(record.due_date_gregorian).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                        <td>
                          {record.is_paid ? (
                            <span className="badge badge-success">Paid</span>
                          ) : record.amount_paid > 0 ? (
                            <span className="badge badge-warning" style={{ background: '#fff3cd', color: '#856404' }}>Partial</span>
                          ) : (
                            <span className="badge badge-danger">Unpaid</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexDirection:'column' }}>
                            {!record.is_paid && (
                              <>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => setPaymentForm({
                                    recordId: record.id,
                                    amount: remaining.toFixed(2),
                                    date: new Date().toISOString().split('T')[0],
                                    note: '',
                                  })}
                                  title="Add payment"
                                >
                                  <Plus size={14} /> Pay
                                </button>
                                <button className="btn btn-sm btn-secondary" onClick={() => handlePayFull(record.id)} title="Mark fully paid">
                                  <CheckCircle size={14} /> Full
                                </button>
                              </>
                            )}
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(record.id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${record.id}-payments`}>
                          <td colSpan={9} style={{ padding: 0 }}>
                            <div style={{ padding: '12px 24px', background: 'var(--color-bg-secondary, #f8f9fa)' }}>
                              <strong style={{ display: 'block', marginBottom: 8 }}>Payment History</strong>
                              {record.payments.length === 0 ? (
                                <p style={{ color: '#888', margin: 0 }}>No payments recorded yet.</p>
                              ) : (
                                <table style={{ width: '100%', marginBottom: 8 }}>
                                  <thead>
                                    <tr>
                                      <th>Date (Gregorian)</th>
                                      <th>Date (Hijri)</th>
                                      <th>Amount</th>
                                      <th>Note</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {record.payments.map((p) => (
                                      <tr key={p.id}>
                                        <td>{new Date(p.date_gregorian).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                        <td>{formatHijri(p.date_hijri)}</td>
                                        <td>{p.amount.toFixed(2)} EGP</td>
                                        <td>{p.note || '—'}</td>
                                        <td>
                                          <button className="btn btn-sm btn-danger" onClick={() => handleDeletePayment(p.id)} style={{ padding: '2px 8px' }}>
                                            <Trash2 size={12} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {!record.is_paid && (
                                <button
                                  className="btn btn-sm btn-primary"
                                  style={{ marginTop: 4 }}
                                  onClick={() => setPaymentForm({
                                    recordId: record.id,
                                    amount: Math.max(0, record.amount_due - record.amount_paid).toFixed(2),
                                    date: new Date().toISOString().split('T')[0],
                                    note: '',
                                  })}
                                >
                                  <Plus size={14} /> Add Payment
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setPaymentForm(null)}>
          <div className="card" style={{ width: 420, maxWidth: '90vw', margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Record Zakat Payment</h3>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Amount (EGP)</label>
              <input
                type="number"
                className="form-input"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Date</label>
              <input
                type="date"
                className="form-input"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Note (optional)</label>
              <input
                type="text"
                className="form-input"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                placeholder="e.g. Paid to charity X"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setPaymentForm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddPayment}>Record Payment</button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ background: 'var(--color-primary-light)', border: '1px solid #b7dfb7' }}>
        <h3 style={{ marginBottom: 12 }}>How Zakat is Calculated</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li><strong>Nisab:</strong> Your total wealth must exceed the value of 85 grams of gold.</li>
          <li><strong>Hawl:</strong> The Hawl (one Hijri year) starts when your total wealth first reaches the Nisab threshold.</li>
          <li><strong>Rate:</strong> Zakat is 2.5% of your zakatable wealth at the time the Hawl completes.</li>
          <li><strong>New Assets:</strong> Assets acquired after the Hawl completion date are excluded from the current Zakat and will be included in the next Hawl period.</li>
          <li><strong>Reset:</strong> If your wealth drops below Nisab, the Hawl resets. After paying Zakat, a new Hawl cycle begins.</li>
          <li><strong>Calendar:</strong> All dates are tracked using the Hijri calendar for accuracy.</li>
        </ul>
      </div>
    </div>
  );
}
