import { getDb, persist } from '../database';
import { ZakatRecord } from '../types';

function rowToRecord(columns: string[], values: any[]): ZakatRecord {
  const obj: any = {};
  columns.forEach((col, i) => (obj[col] = values[i]));
  return obj as ZakatRecord;
}

export function getZakatRecords(): ZakatRecord[] {
  const db = getDb();
  const result = db.exec('SELECT * FROM zakat_records ORDER BY created_at DESC');
  if (result.length === 0) return [];
  return result[0].values.map(row => rowToRecord(result[0].columns, row as any[]));
}

export function getZakatRecordsByAsset(assetId: number): ZakatRecord[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM zakat_records WHERE asset_id = ? ORDER BY created_at DESC');
  stmt.bind([assetId]);
  const records: ZakatRecord[] = [];
  while (stmt.step()) {
    records.push(stmt.getAsObject() as unknown as ZakatRecord);
  }
  stmt.free();
  return records;
}

export function createZakatRecord(record: Omit<ZakatRecord, 'id' | 'created_at'>): ZakatRecord {
  const db = getDb();
  db.run(
    `INSERT INTO zakat_records (asset_id, hijri_year, amount_due, is_paid, reminder_sent, due_date_hijri, due_date_gregorian)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      record.asset_id,
      record.hijri_year,
      record.amount_due,
      record.is_paid ? 1 : 0,
      record.reminder_sent ? 1 : 0,
      record.due_date_hijri,
      record.due_date_gregorian,
    ]
  );

  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastId = result[0].values[0][0] as number;
  persist();
  const stmt = db.prepare('SELECT * FROM zakat_records WHERE id = ?');
  stmt.bind([lastId]);
  stmt.step();
  const row = stmt.getAsObject() as unknown as ZakatRecord;
  stmt.free();
  return row;
}

export function getZakatRecordById(id: number): ZakatRecord | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM zakat_records WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as ZakatRecord;
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function markZakatPaid(id: number): boolean {
  const db = getDb();
  db.run('UPDATE zakat_records SET is_paid = 1 WHERE id = ?', [id]);
  const modified = db.getRowsModified() > 0;
  persist();
  return modified;
}

export function updateZakatRecordDueDates(id: number, dueDateHijri: string, dueDateGregorian: string, hijriYear: string): void {
  const db = getDb();
  db.run(
    'UPDATE zakat_records SET due_date_hijri = ?, due_date_gregorian = ?, hijri_year = ? WHERE id = ?',
    [dueDateHijri, dueDateGregorian, hijriYear, id]
  );
  persist();
}

export function markReminderSent(id: number): boolean {
  const db = getDb();
  db.run('UPDATE zakat_records SET reminder_sent = 1 WHERE id = ?', [id]);
  const modified = db.getRowsModified() > 0;
  persist();
  return modified;
}

export function deleteUnpaidRecords(): number {
  const db = getDb();
  db.run('DELETE FROM zakat_records WHERE is_paid = 0');
  const deleted = db.getRowsModified();
  persist();
  return deleted;
}

export function getSetting(key: string): string | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  stmt.bind([key]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as { value: string };
    stmt.free();
    return row.value;
  }
  stmt.free();
  return undefined;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  persist();
}
