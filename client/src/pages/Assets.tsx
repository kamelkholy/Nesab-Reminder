import { useEffect, useState } from 'react';
import { Asset, ZakatSummary, Settings } from '../types';
import { getAssets, deleteAsset, getZakatSummary, getSettings, refreshAllStockPrices } from '../services/api';
import AssetForm from '../components/AssetForm';
import { formatHijriDate } from '../utils/hijri';
import { Plus, Edit2, Trash2, Wallet, RefreshCw } from 'lucide-react';

interface Props {
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function Assets({ showToast }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [zakatableAssetIds, setZakatableAssetIds] = useState<Set<string>>(new Set());
  const [assetValuesEGP, setAssetValuesEGP] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>();
  const [stockPriceMode, setStockPriceMode] = useState<'manual' | 'auto'>('manual');
  const [refreshingStocks, setRefreshingStocks] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const [data, summary, settings] = await Promise.all([getAssets(), getZakatSummary(), getSettings()]);
      setAssets(data);
      setStockPriceMode(settings.stock_price_mode || 'manual');
      const ids = new Set<string>(
        summary.assets
          .filter(a => !a.excludedFromZakat && a.asset.id)
          .map(a => a.asset.id!)
      );
      setZakatableAssetIds(ids);
      const values = new Map<string, number>(
        summary.assets
          .filter(a => a.asset.id)
          .map(a => [a.asset.id!, a.amountEGP])
      );
      setAssetValuesEGP(values);
    } catch (err) {
      showToast('Failed to load assets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    try {
      await deleteAsset(id);
      showToast('Asset deleted', 'success');
      loadAssets();
    } catch (err) {
      showToast('Failed to delete asset', 'error');
    }
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingAsset(undefined);
    setShowForm(true);
  };

  const handleRefreshStockPrices = async () => {
    setRefreshingStocks(true);
    try {
      const result = await refreshAllStockPrices();
      const updated = result.results.filter(r => r.updated).length;
      const failed = result.results.filter(r => !r.updated).length;
      showToast(
        `Updated ${updated} stock price${updated !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`,
        failed > 0 && updated === 0 ? 'error' : 'success'
      );
      loadAssets();
    } catch (err) {
      showToast('Failed to refresh stock prices', 'error');
    } finally {
      setRefreshingStocks(false);
    }
  };

  if (loading) {
    return <div className="page-header"><h2>Loading...</h2></div>;
  }

  const cashAssets = assets.filter(a => a.type === 'cash');
  const investmentAssets = assets.filter(a => a.type === 'investment');
  const stockAssets = assets.filter(a => a.type === 'stock');
  const goldAssets = assets.filter(a => a.type === 'gold');

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>My Assets</h2>
          <p>Track your cash, investments, stocks, and gold</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}>
          <Plus size={18} /> Add Asset
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Wallet size={48} />
            <h3>No assets yet</h3>
            <p>Add your first asset to start tracking your wealth and Zakat obligations.</p>
            <button className="btn btn-primary" onClick={handleAdd} style={{ marginTop: 16 }}>
              <Plus size={18} /> Add Your First Asset
            </button>
          </div>
        </div>
      ) : (
        <>
          {cashAssets.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Cash & Money</h3>
                <span className="badge badge-cash">{cashAssets.length} items</span>
              </div>
              <AssetTable assets={cashAssets} onEdit={handleEdit} onDelete={handleDelete} zakatableIds={zakatableAssetIds} />
            </div>
          )}

          {investmentAssets.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Investments</h3>
                <span className="badge badge-investment">{investmentAssets.length} items</span>
              </div>
              <AssetTable assets={investmentAssets} onEdit={handleEdit} onDelete={handleDelete} zakatableIds={zakatableAssetIds} />
            </div>
          )}

          {stockAssets.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Stocks</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {stockPriceMode === 'auto' && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={handleRefreshStockPrices}
                      disabled={refreshingStocks}
                    >
                      <RefreshCw size={14} className={refreshingStocks ? 'spin' : ''} />
                      {refreshingStocks ? 'Refreshing...' : 'Refresh Prices'}
                    </button>
                  )}
                  <span className="badge badge-stock">{stockAssets.length} items</span>
                </div>
              </div>
              <AssetTable assets={stockAssets} onEdit={handleEdit} onDelete={handleDelete} showStockCols zakatableIds={zakatableAssetIds} />
            </div>
          )}

          {goldAssets.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Gold</h3>
                <span className="badge badge-gold">{goldAssets.length} items</span>
              </div>
              <AssetTable assets={goldAssets} onEdit={handleEdit} onDelete={handleDelete} showGoldCols zakatableIds={zakatableAssetIds} valuesEGP={assetValuesEGP} />
            </div>
          )}
        </>
      )}

      {showForm && (
        <AssetForm
          asset={editingAsset}
          onClose={() => setShowForm(false)}
          onSaved={loadAssets}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function AssetTable({
  assets,
  onEdit,
  onDelete,
  showStockCols = false,
  showGoldCols = false,
  zakatableIds,
  valuesEGP,
}: {
  assets: Asset[];
  onEdit: (a: Asset) => void;
  onDelete: (id: string) => void;
  showStockCols?: boolean;
  showGoldCols?: boolean;
  zakatableIds: Set<string>;
  valuesEGP?: Map<string, number>;
}) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>{showGoldCols ? 'Weight' : 'Value'}</th>
            {showStockCols && <th>Ticker</th>}
            {showStockCols && <th>Shares</th>}
            {showGoldCols && <th>Karat</th>}
            {showGoldCols && <th>Value</th>}
            <th>Acquisition Date</th>
            <th>Hijri Date</th>
            <th>Due This Hawl</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {[...assets].sort((a, b) => b.hijri_date.localeCompare(a.hijri_date)).map((asset) => {
            const isZakatable = !!(asset.id && zakatableIds.has(asset.id));
            return (
            <tr key={asset.id} className={isZakatable ? 'row-zakatable' : ''}>
              <td><strong>{asset.description}</strong></td>
              <td>
                {showGoldCols
                  ? `${asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} g`
                  : showStockCols && asset.quantity
                  ? `${(asset.quantity * asset.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${asset.currency}`
                  : `${asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${asset.currency}`
                }
              </td>
              {showStockCols && <td>{asset.ticker || '—'}</td>}
              {showStockCols && <td>{asset.quantity || '—'}</td>}
              {showGoldCols && <td>{asset.karat ? `${asset.karat}K` : '—'}</td>}
              {showGoldCols && (
                <td>
                  {asset.id && valuesEGP?.has(asset.id)
                    ? `${valuesEGP.get(asset.id)!.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP`
                    : '—'}
                </td>
              )}
              <td>{asset.acquisition_date}</td>
              <td>{formatHijriDate(asset.hijri_date)}</td>
              <td>
                {isZakatable
                  ? <span className="badge badge-success">Yes</span>
                  : <span className="badge badge-pending">No</span>
                }
              </td>
              <td>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => onEdit(asset)}>
                    <Edit2 size={14} />
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => onDelete(asset.id!)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
