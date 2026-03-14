export interface Asset {
  id?: number;
  type: 'cash' | 'investment' | 'stock';
  description: string;
  amount: number;
  currency: 'USD' | 'EGP';
  quantity?: number;        // for stocks: number of shares
  ticker?: string;          // for stocks: ticker symbol
  acquisition_date: string; // Gregorian date YYYY-MM-DD
  hijri_date: string;       // Hijri date
  created_at?: string;
  updated_at?: string;
}

export interface ZakatRecord {
  id?: number;
  asset_id: number;
  hijri_year: string;
  amount_due: number;
  is_paid: boolean;
  reminder_sent: boolean;
  due_date_hijri: string;
  due_date_gregorian: string;
  created_at?: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  to: string;
}

export interface ZakatSummary {
  totalWealthEGP: number;
  nisabThresholdEGP: number;
  isAboveNisab: boolean;
  totalZakatDue: number;
  eligibleAssets: AssetZakatInfo[];
  usdToEgpRate: number;
}

export interface AssetZakatInfo {
  asset: Asset;
  amountEGP: number;
  hijriAcquisitionDate: string;
  hawlComplete: boolean;
  hawlCompletionDate: string;
  zakatAmount: number;
}
