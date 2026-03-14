import { Asset, ZakatSummary, AssetZakatInfo } from '../types';
import { getAllAssets } from '../models/assetModel';
import { getZakatRecordsByAsset, createZakatRecord } from '../models/zakatModel';
import {
  isHawlComplete,
  getHawlCompletionDate,
  hijriToGregorian,
  getCurrentHijriYear,
  formatHijriDate,
} from '../utils/hijri';

// Nisab = 85 grams of gold
const NISAB_GOLD_GRAMS = 85;

/**
 * Convert asset amount to EGP based on its currency
 */
function toEGP(amount: number, currency: string, usdToEgpRate: number): number {
  return currency === 'USD' ? amount * usdToEgpRate : amount;
}

/**
 * Calculate Zakat summary for all assets.
 * All calculations are done in EGP.
 */
export function calculateZakat(goldPricePerGramEGP: number, usdToEgpRate: number): ZakatSummary {
  const assets = getAllAssets();
  const nisabThreshold = NISAB_GOLD_GRAMS * goldPricePerGramEGP;

  const eligibleAssets: AssetZakatInfo[] = [];
  let totalWealthEGP = 0;

  for (const asset of assets) {
    const baseAmount = asset.type === 'stock' && asset.quantity
      ? asset.quantity * asset.amount
      : asset.amount;
    const amountEGP = toEGP(baseAmount, asset.currency, usdToEgpRate);
    totalWealthEGP += amountEGP;
    const hawlComplete = isHawlComplete(asset.hijri_date);
    const hawlCompletionDate = getHawlCompletionDate(asset.hijri_date);

    eligibleAssets.push({
      asset,
      amountEGP,
      hijriAcquisitionDate: asset.hijri_date,
      hawlComplete,
      hawlCompletionDate: formatHijriDate(hawlCompletionDate),
      zakatAmount: hawlComplete ? amountEGP * 0.025 : 0,
    });
  }

  const isAboveNisab = totalWealthEGP >= nisabThreshold;
  const totalZakatDue = isAboveNisab
    ? eligibleAssets.reduce((sum, a) => sum + a.zakatAmount, 0)
    : 0;

  return {
    totalWealthEGP,
    nisabThresholdEGP: nisabThreshold,
    isAboveNisab,
    totalZakatDue,
    eligibleAssets,
    usdToEgpRate,
  };
}

/**
 * Generate zakat records for assets whose hawl has completed
 * and don't already have a record for the current Hijri year
 */
export function generateZakatRecords(goldPricePerGramEGP: number, usdToEgpRate: number): void {
  const summary = calculateZakat(goldPricePerGramEGP, usdToEgpRate);
  if (!summary.isAboveNisab) return;

  const currentHijriYear = getCurrentHijriYear().toString();

  for (const info of summary.eligibleAssets) {
    if (!info.hawlComplete || info.zakatAmount === 0) continue;

    const assetId = info.asset.id!;
    const existingRecords = getZakatRecordsByAsset(assetId);
    const hasRecord = existingRecords.some(r => r.hijri_year === currentHijriYear);

    if (!hasRecord) {
      const hawlDate = getHawlCompletionDate(info.asset.hijri_date);
      createZakatRecord({
        asset_id: assetId,
        hijri_year: currentHijriYear,
        amount_due: info.zakatAmount,
        is_paid: false,
        reminder_sent: false,
        due_date_hijri: hawlDate,
        due_date_gregorian: hijriToGregorian(hawlDate),
      });
    }
  }
}
