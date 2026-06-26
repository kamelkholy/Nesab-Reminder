import { useState } from 'react';
import { Asset } from '../types';
import { createAsset, updateAsset } from '../services/api';
import { X } from 'lucide-react';

interface Props {
  asset?: Asset;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function AssetForm({ asset, onClose, onSaved, showToast }: Props) {
  const [type, setType] = useState<Asset['type']>(asset?.type || 'cash');
  const [description, setDescription] = useState(asset?.description || '');
  const [amount, setAmount] = useState(asset?.amount?.toString() || '');
  const [currency, setCurrency] = useState<Asset['currency']>(asset?.currency || 'EGP');
  const [quantity, setQuantity] = useState(asset?.quantity?.toString() || '');
  const [ticker, setTicker] = useState(asset?.ticker || '');
  const [karat, setKarat] = useState<string>(asset?.karat?.toString() || '');
  const [acquisitionDate, setAcquisitionDate] = useState(asset?.acquisition_date || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        type,
        description,
        amount: parseFloat(amount),
        currency: type === 'gold' ? 'EGP' : currency,
        quantity: quantity ? parseFloat(quantity) : undefined,
        ticker: ticker || undefined,
        karat: type === 'gold' && karat ? parseInt(karat) : undefined,
        acquisition_date: acquisitionDate,
      };

      if (asset?.id) {
        await updateAsset(asset.id, data);
        showToast('Asset updated successfully', 'success');
      } else {
        await createAsset(data);
        showToast('Asset added successfully', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      showToast((err as Error).message || 'Failed to save asset', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3>{asset ? 'Edit Asset' : 'Add New Asset'}</h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Asset Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as Asset['type'])}>
              <option value="cash">Cash / Money</option>
              <option value="investment">Investment</option>
              <option value="stock">Stock</option>
              <option value="gold">Gold</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Savings account, Gold investment, AAPL shares"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{type === 'stock' ? 'Stock Price' : type === 'gold' ? 'Weight (grams)' : 'Value'}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  step={type === 'gold' ? '0.01' : '0.001'}
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  style={{ flex: 1 }}
                />
                {type !== 'gold' && (
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Asset['currency'])}
                    style={{ width: 90 }}
                  >
                    <option value="EGP">EGP</option>
                    <option value="USD">USD</option>
                  </select>
                )}
              </div>
            </div>
            <div className="form-group">
              <label>{type === 'gold' ? 'Acquired Date' : type === 'stock' ? 'Vest Date' : 'Acquisition Date'}</label>
              <input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                required
              />
            </div>
          </div>

          {type === 'stock' && (
            <div className="form-row">
              <div className="form-group">
                <label>Ticker Symbol</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="e.g., AAPL"
                />
              </div>
              <div className="form-group">
                <label>Number of Shares</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {type === 'gold' && (
            <div className="form-group">
              <label>Gold Purity (Karat)</label>
              <select
                value={karat}
                onChange={(e) => setKarat(e.target.value)}
                required
              >
                <option value="">Select karat...</option>
                <option value="18">18K (75% pure)</option>
                <option value="21">21K (87.5% pure)</option>
                <option value="24">24K (100% pure)</option>
              </select>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : asset ? 'Update Asset' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
