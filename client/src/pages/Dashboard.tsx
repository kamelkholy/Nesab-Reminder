import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZakatSummary } from '../types';
import { getZakatSummary, getAssets } from '../services/api';
import { formatHijriDate } from '../utils/hijri';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function Dashboard({ showToast }: Props) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ZakatSummary | null>(null);
  const [assetCount, setAssetCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [summaryData, assets] = await Promise.all([getZakatSummary(), getAssets()]);
      setSummary(summaryData);
      setAssetCount(assets.length);
    } catch (err) {
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="page-header"><h2>Loading...</h2></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your wealth and Zakat obligations</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Wealth (EGP)</div>
          <div className="value">{summary?.totalWealthEGP.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'} EGP</div>
          <div className="sub">{assetCount} asset{assetCount !== 1 ? 's' : ''} tracked</div>
        </div>
        <div className="stat-card gold">
          <div className="label">Nisab Threshold</div>
          <div className="value">{summary?.nisabThresholdEGP.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'} EGP</div>
          <div className="sub">Based on 85g of gold</div>
        </div>
        <div className={`stat-card ${summary?.isAboveNisab ? 'danger' : ''}`}>
          <div className="label">Zakat Due</div>
          <div className="value">{summary?.totalZakatDue.toFixed(2) || '0.00'} EGP</div>
          <div className="sub">
            {summary?.hawlComplete && summary?.zakatableWealthEGP !== summary?.totalWealthEGP
              ? `2.5% of ${summary.zakatableWealthEGP.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP (zakatable)`
              : '2.5% of total wealth'}
          </div>
        </div>
        <div className="stat-card warning">
          <div className="label">Hawl Status</div>
          <div className="value">{summary?.hawlComplete ? 'Complete' : 'Pending'}</div>
          <div className="sub">
            {summary?.hawlStartDate
              ? `Started: ${summary.hawlStartDate}`
              : 'Wealth has not yet reached Nisab'}
          </div>
        </div>
        {summary?.hawlCompletionDate && !summary.hawlComplete && (
          <div className="stat-card">
            <div className="label">Hawl Completion</div>
            <div className="value">{summary.hawlCompletionDate}</div>
            <div className="sub">When Zakat becomes due</div>
          </div>
        )}
      </div>

      {summary?.isAboveNisab && summary.totalZakatDue > 0 ? (
        <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={20} />
          <div style={{ flex: 1 }}>
            <strong>Zakat is due!</strong> Your total wealth exceeds the Nisab threshold and the Hawl is complete.
            You owe <strong>{summary.totalZakatDue.toFixed(2)} EGP</strong> in Zakat.
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/zakat')}>
            Pay Zakat
          </button>
        </div>
      ) : (
        <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircle size={20} />
          <div>
            {assetCount === 0
              ? 'No assets tracked yet. Add your assets to start tracking Zakat.'
              : summary?.isAboveNisab
                ? 'Your wealth is above Nisab but the Hawl period has not completed yet.'
                : 'No Zakat due at this time. Your total wealth is below the Nisab threshold.'}
          </div>
        </div>
      )}

      {summary && summary.assets.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Assets Overview</h3>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Hijri Date</th>
                  <th>Value</th>
                  <th>Value (EGP)</th>
                  <th>Due This Hawl</th>
                </tr>
              </thead>
              <tbody>
                {[...summary.assets].sort((a, b) => b.asset.hijri_date.localeCompare(a.asset.hijri_date)).map((info) => {
                  const isZakatable = !info.excludedFromZakat;
                  return (
                  <tr key={info.asset.id} className={isZakatable ? 'row-zakatable' : ''}>
                    <td><strong>{info.asset.description}</strong></td>
                    <td><span className={`badge badge-${info.asset.type}`}>{info.asset.type}</span></td>
                    <td>{formatHijriDate(info.asset.hijri_date)}</td>
                    <td>
                      {info.asset.type === 'stock' && info.asset.quantity
                        ? `${(info.asset.quantity * info.asset.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${info.asset.currency}`
                        : info.asset.type === 'gold'
                        ? `${info.asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} g${info.asset.karat ? ` (${info.asset.karat}K)` : ''}`
                        : `${info.asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${info.asset.currency}`
                      }
                    </td>
                    <td>{info.amountEGP.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</td>
                    <td>
                      {isZakatable
                        ? <span className="badge badge-success">Yes</span>
                        : <span className="badge badge-pending">No</span>
                      }
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
