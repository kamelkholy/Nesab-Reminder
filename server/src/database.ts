import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '..', 'data', 'nesab.db');

let db: SqlJsDatabase | null = null;
let dbReady: Promise<void>;

function saveDb(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('cash', 'investment', 'stock')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EGP' CHECK(currency IN ('USD', 'EGP')),
      quantity REAL,
      ticker TEXT,
      acquisition_date TEXT NOT NULL,
      hijri_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS zakat_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      hijri_year TEXT NOT NULL,
      amount_due REAL NOT NULL,
      is_paid INTEGER DEFAULT 0,
      reminder_sent INTEGER DEFAULT 0,
      due_date_hijri TEXT NOT NULL,
      due_date_gregorian TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('email_to', '')");
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('gold_price_per_gram_egp', '3750')");
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('usd_to_egp_rate', '50')");

  saveDb();
}

dbReady = initDb();

export async function ensureDb(): Promise<void> {
  await dbReady;
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call ensureDb() first.');
  }
  return db;
}

export function persist(): void {
  saveDb();
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
