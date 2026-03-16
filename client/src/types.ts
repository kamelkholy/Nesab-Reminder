export interface Asset {
  id?: string;
  type: 'cash' | 'investment' | 'stock';
  description: string;
  amount: number;
  currency: 'USD' | 'EGP';
  quantity?: number;
  ticker?: string;
  acquisition_date: string;
  hijri_date: string;
  created_at?: string;
  updated_at?: string;
}

export interface ZakatSummary {
  totalWealthEGP: number;
  zakatableWealthEGP: number;
  nisabThresholdEGP: number;
  isAboveNisab: boolean;
  hawlComplete: boolean;
  hawlStartDate: string | null;
  hawlCompletionDate: string | null;
  totalZakatDue: number;
  assets: AssetZakatInfo[];
  usdToEgpRate: number;
}

export interface AssetZakatInfo {
  asset: Asset;
  amountEGP: number;
  excludedFromZakat: boolean;
}

export interface ZakatRecord {
  id: string;
  hijri_year: string;
  amount_due: number;
  is_paid: boolean;
  reminder_sent: boolean;
  due_date_hijri: string;
  due_date_gregorian: string;
  created_at: string;
}

export interface Settings {
  email_to: string;
  gold_price_per_gram_egp: string;
  usd_to_egp_rate: string;
  gold_price_mode: 'manual' | 'auto';
  usd_egp_mode: 'manual' | 'auto';
  stock_price_mode: 'manual' | 'auto';
}
