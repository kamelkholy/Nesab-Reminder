import { ZakatSummary, AssetZakatInfo } from '../types';
import { getAllAssets } from '../models/assetModel';
import { getSetting, setSetting, getZakatRecordByYear, createZakatRecord } from '../models/zakatModel';
import {
  isHawlComplete,
  getHawlCompletionDate,
  hijriToGregorian,
  getCurrentHijriYear,
  getCurrentHijriDate,
  formatHijriDate,
  comparHijriDates,
} from '../utils/hijri';

// Nisab = 85 grams of gold
const NISAB_GOLD_GRAMS = 85;

function toEGP(amount: number, currency: string, usdToEgpRate: number): number {
  return currency === 'USD' ? amount * usdToEgpRate : amount;
}

/**
 * Calculate Zakat summary based on total wealth.
 * Hawl starts when total wealth first reaches nisab.
 * Zakat is 2.5% of total wealth when hawl completes.
 */
export async function calculateZakat(goldPricePerGramEGP: number, usdToEgpRate: number): Promise<ZakatSummary> {
  const allAssets = await getAllAssets();
  const nisabThreshold = NISAB_GOLD_GRAMS * goldPricePerGramEGP;

  const assets: AssetZakatInfo[] = [];
  let totalWealthEGP = 0;

  for (const asset of allAssets) {
    let amountEGP = 0;
    
    if (asset.type === 'stock' && asset.quantity) {
      // Stock: price per share * quantity
      amountEGP = toEGP(asset.quantity * asset.amount, asset.currency, usdToEgpRate);
    } else if (asset.type === 'gold' && asset.karat) {
      // Gold: weight_in_grams * (karat/24) * price_per_gram_egp
      // This converts to pure gold equivalent and calculates its value
      const pureGoldGrams = asset.amount * (asset.karat / 24);
      amountEGP = pureGoldGrams * goldPricePerGramEGP;
    } else {
      // Cash / Investment
      amountEGP = toEGP(asset.amount, asset.currency, usdToEgpRate);
    }
    
    totalWealthEGP += amountEGP;
    assets.push({ asset, amountEGP, excludedFromZakat: false });
  }

  const isAboveNisab = totalWealthEGP >= nisabThreshold;
  let nisabReachedDate = await getSetting('nisab_reached_date_hijri') || null;

  if (isAboveNisab && !nisabReachedDate) {
    // Determine which asset historically pushed wealth above nisab
    // by replaying assets in chronological order
    const sorted = [...allAssets].sort((a, b) =>
      a.acquisition_date.localeCompare(b.acquisition_date)
    );
    let runningTotal = 0;
    for (const asset of sorted) {
      let base = 0;
      if (asset.type === 'stock' && asset.quantity) {
        base = asset.quantity * asset.amount;
      } else if (asset.type === 'gold' && asset.karat) {
        const pureGoldGrams = asset.amount * (asset.karat / 24);
        base = pureGoldGrams * goldPricePerGramEGP;
      } else {
        base = asset.amount;
      }
      runningTotal += toEGP(base, asset.currency, usdToEgpRate);
      if (runningTotal >= nisabThreshold) {
        nisabReachedDate = asset.hijri_date;
        break;
      }
    }
    nisabReachedDate = nisabReachedDate || getCurrentHijriDate();
    await setSetting('nisab_reached_date_hijri', nisabReachedDate);
  } else if (!isAboveNisab && nisabReachedDate) {
    // Wealth dropped below nisab — reset hawl
    nisabReachedDate = null;
    await setSetting('nisab_reached_date_hijri', '');
  }

  const hawlComplete = nisabReachedDate ? isHawlComplete(nisabReachedDate) : false;
  const hawlCompletionDate = nisabReachedDate ? getHawlCompletionDate(nisabReachedDate) : null;

  // When hawl is complete, exclude assets acquired after the hawl completion date
  let zakatableWealthEGP = totalWealthEGP;
  if (hawlComplete && hawlCompletionDate) {
    zakatableWealthEGP = 0;
    for (const info of assets) {
      if (comparHijriDates(info.asset.hijri_date, hawlCompletionDate) > 0) {
        info.excludedFromZakat = true;
      } else {
        zakatableWealthEGP += info.amountEGP;
      }
    }
  }

  const totalZakatDue = isAboveNisab ? zakatableWealthEGP * 0.025 : 0;

  return {
    totalWealthEGP,
    zakatableWealthEGP,
    nisabThresholdEGP: nisabThreshold,
    isAboveNisab,
    hawlComplete,
    hawlStartDate: nisabReachedDate ? formatHijriDate(nisabReachedDate) : null,
    hawlCompletionDate: hawlCompletionDate ? formatHijriDate(hawlCompletionDate) : null,
    hawlCompletionDateRaw: hawlCompletionDate || null,
    totalZakatDue,
    assets,
    usdToEgpRate,
  };
}

/**
 * Generate a zakat record for the current Hijri year if hawl is complete
 * and no record exists yet.
 */
export async function generateZakatRecords(goldPricePerGramEGP: number, usdToEgpRate: number): Promise<void> {
  const summary = await calculateZakat(goldPricePerGramEGP, usdToEgpRate);
  if (!summary.isAboveNisab || !summary.hawlComplete || summary.totalZakatDue === 0) return;

  const currentHijriYear = getCurrentHijriYear().toString();
  const existing = await getZakatRecordByYear(currentHijriYear);
  if (existing) return;

  const nisabReachedDate = await getSetting('nisab_reached_date_hijri');
  const hawlDate = nisabReachedDate ? getHawlCompletionDate(nisabReachedDate) : getCurrentHijriDate();

  await createZakatRecord({
    hijri_year: currentHijriYear,
    amount_due: summary.totalZakatDue,
    is_paid: false,
    reminder_sent: false,
    due_date_hijri: hawlDate,
    due_date_gregorian: hijriToGregorian(hawlDate),
  });
}
