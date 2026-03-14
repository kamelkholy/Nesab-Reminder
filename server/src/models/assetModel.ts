import { getDb, persist } from '../database';
import { Asset } from '../types';
import { gregorianToHijri } from '../utils/hijri';

function rowToAsset(columns: string[], values: any[]): Asset {
  const obj: any = {};
  columns.forEach((col, i) => (obj[col] = values[i]));
  return obj as Asset;
}

export function getAllAssets(): Asset[] {
  const db = getDb();
  const result = db.exec('SELECT * FROM assets ORDER BY created_at DESC');
  if (result.length === 0) return [];
  return result[0].values.map(row => rowToAsset(result[0].columns, row as any[]));
}

export function getAssetById(id: number): Asset | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM assets WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const obj = stmt.getAsObject();
    stmt.free();
    return {
      id: obj.id as number,
      type: obj.type as Asset['type'],
      description: obj.description as string,
      amount: obj.amount as number,
      currency: (obj.currency as Asset['currency']) || 'EGP',
      quantity: obj.quantity as number | undefined,
      ticker: obj.ticker as string | undefined,
      acquisition_date: obj.acquisition_date as string,
      hijri_date: obj.hijri_date as string,
      created_at: obj.created_at as string,
      updated_at: obj.updated_at as string,
    };
  }
  stmt.free();
  return undefined;
}

export function createAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'hijri_date'>): Asset {
  const db = getDb();
  const hijriDate = gregorianToHijri(asset.acquisition_date);

  db.run(
    `INSERT INTO assets (type, description, amount, currency, quantity, ticker, acquisition_date, hijri_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      asset.type,
      asset.description,
      asset.amount,
      asset.currency,
      asset.quantity ?? null,
      asset.ticker ?? null,
      asset.acquisition_date,
      hijriDate,
    ]
  );

  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastId = result[0].values[0][0] as number;
  persist();
  return getAssetById(lastId)!;
}

export function updateAsset(id: number, asset: Partial<Omit<Asset, 'id' | 'created_at'>>): Asset | undefined {
  const db = getDb();
  const existing = getAssetById(id);
  if (!existing) return undefined;

  const updated = { ...existing, ...asset };
  if (asset.acquisition_date) {
    updated.hijri_date = gregorianToHijri(asset.acquisition_date);
  }

  db.run(
    `UPDATE assets SET
      type = ?, description = ?, amount = ?, currency = ?, quantity = ?, ticker = ?,
      acquisition_date = ?, hijri_date = ?, updated_at = datetime('now')
    WHERE id = ?`,
    [
      updated.type,
      updated.description,
      updated.amount,
      updated.currency,
      updated.quantity ?? null,
      updated.ticker ?? null,
      updated.acquisition_date,
      updated.hijri_date,
      id,
    ]
  );

  persist();
  return getAssetById(id);
}

export function updateAssetDates(id: number, acquisitionDate: string, hijriDate: string): void {
  const db = getDb();
  db.run(
    `UPDATE assets SET acquisition_date = ?, hijri_date = ?, updated_at = datetime('now') WHERE id = ?`,
    [acquisitionDate, hijriDate, id]
  );
  persist();
}

export function deleteAsset(id: number): boolean {
  const db = getDb();
  const existing = getAssetById(id);
  if (!existing) return false;
  db.run('DELETE FROM assets WHERE id = ?', [id]);
  persist();
  return true;
}
