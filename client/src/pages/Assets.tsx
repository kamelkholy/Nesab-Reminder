import { useEffect, useState } from 'react';
import { Asset } from '../types';
import { getAssets, deleteAsset } from '../services/api';
import AssetForm from '../components/AssetForm';
import { Plus, Edit2, Trash2, Wallet } from 'lucide-react';

interface Props {
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function Assets({ showToast }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>();

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const data = await getAssets();
      setAssets(data);
    } catch (err) {
      showToast('Failed to load assets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
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

  if (loading) {
    return <div className="page-header"><h2>Loading...</h2></div>;
  }

  const cashAssets = assets.filter(a => a.type === 'cash');
  const investmentAssets = assets.filter(a => a.type === 'investment');
  const stockAssets = assets.filter(a => a.type === 'stock');

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>My Assets</h2>
          <p>Track your cash, investments, and stocks</p>
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
              <AssetTable assets={cashAssets} onEdit={handleEdit} onDelete={handleDelete} />
            </div>
          )}

          {investmentAssets.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Investments</h3>
                <span className="badge badge-investment">{investmentAssets.length} items</span>
              </div>
              <AssetTable assets={investmentAssets} onEdit={handleEdit} onDelete={handleDelete} />
            </div>
          )}

          {stockAssets.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Stocks</h3>
                <span className="badge badge-stock">{stockAssets.length} items</span>
              </div>
              <AssetTable assets={stockAssets} onEdit={handleEdit} onDelete={handleDelete} showStockCols />
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
}: {
  assets: Asset[];
  onEdit: (a: Asset) => void;
  onDelete: (id: number) => void;
  showStockCols?: boolean;
}) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Value</th>
            {showStockCols && <th>Ticker</th>}
            {showStockCols && <th>Shares</th>}
            <th>Acquisition Date</th>
            <th>Hijri Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td><strong>{asset.description}</strong></td>
              <td>
                {showStockCols && asset.quantity
                  ? (asset.quantity * asset.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })
                  : asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                } {asset.currency}
              </td>
              {showStockCols && <td>{asset.ticker || '—'}</td>}
              {showStockCols && <td>{asset.quantity || '—'}</td>}
              <td>{asset.acquisition_date}</td>
              <td>{asset.hijri_date}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
