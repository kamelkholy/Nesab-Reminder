export interface Asset {
  id?: number;
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

export interface ZakatRecord {
  id: number;
  asset_id: number;
  hijri_year: string;
  amount_due: number;
  is_paid: number;
  reminder_sent: number;
  due_date_hijri: string;
  due_date_gregorian: string;
  created_at: string;
}

export interface Settings {
  email_to: string;
  gold_price_per_gram_egp: string;
  usd_to_egp_rate: string;
}
