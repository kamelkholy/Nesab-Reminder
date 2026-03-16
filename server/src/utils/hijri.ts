// Hijri calendar utilities using moment-hijri
// eslint-disable-next-line @typescript-eslint/no-var-requires
const momentHijri = require('moment-hijri') as (input?: any, format?: string) => any;

/**
 * Convert Arabic-Indic numerals to Western/Latin digits
 */
function toLatinDigits(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

/**
 * Convert a Gregorian date string to Hijri date string
 */
export function gregorianToHijri(gregorianDate: string): string {
  const m = momentHijri(gregorianDate, 'YYYY-MM-DD');
  return toLatinDigits(m.format('iYYYY/iMM/iDD'));
}

/**
 * Convert a Hijri date string to Gregorian date string
 */
export function hijriToGregorian(hijriDate: string): string {
  const parts = hijriDate.split('/');
  const m = momentHijri(`${parts[0]}/${parts[1]}/${parts[2]}`, 'iYYYY/iMM/iDD');
  return toLatinDigits(m.format('YYYY-MM-DD'));
}

/**
 * Get the current Hijri date
 */
export function getCurrentHijriDate(): string {
  return toLatinDigits(momentHijri().format('iYYYY/iMM/iDD'));
}

/**
 * Get the current Hijri year
 */
export function getCurrentHijriYear(): number {
  return momentHijri().iYear();
}

/**
 * Calculate the hawl (one lunar year) completion date from a Hijri acquisition date
 * Hawl = one full Hijri year from the acquisition date
 */
export function getHawlCompletionDate(hijriAcquisitionDate: string): string {
  const parts = hijriAcquisitionDate.split('/');
  const year = parseInt(parts[0]) + 1;
  return `${year}/${parts[1]}/${parts[2]}`;
}

/**
 * Check if hawl (one complete Hijri year) has passed since the acquisition date
 */
export function isHawlComplete(hijriAcquisitionDate: string): boolean {
  const hawlDate = getHawlCompletionDate(hijriAcquisitionDate);
  const currentHijri = getCurrentHijriDate();

  return comparHijriDates(currentHijri, hawlDate) >= 0;
}

/**
 * Compare two Hijri dates.
 * Returns negative if a < b, 0 if equal, positive if a > b
 */
export function comparHijriDates(a: string, b: string): number {
  const partsA = a.split('/').map(Number);
  const partsB = b.split('/').map(Number);

  if (partsA[0] !== partsB[0]) return partsA[0] - partsB[0];
  if (partsA[1] !== partsB[1]) return partsA[1] - partsB[1];
  return partsA[2] - partsB[2];
}

/**
 * Format a Hijri date for display
 */
export function formatHijriDate(hijriDate: string): string {
  const months = [
    'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
    'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', 'Shaban',
    'Ramadan', 'Shawwal', 'Dhul Qadah', 'Dhul Hijjah'
  ];
  const parts = hijriDate.split('/').map(Number);
  return `${parts[2]} ${months[parts[1] - 1]} ${parts[0]} AH`;
}

/**
 * Get today's Gregorian date as YYYY-MM-DD
 */
export function getTodayGregorian(): string {
  return momentHijri().format('YYYY-MM-DD');
}

/**
 * Calculate the number of Gregorian days remaining until hawl completion.
 * Returns 0 if hawl is already complete, otherwise a positive number.
 */
export function daysUntilHawlCompletion(hawlCompletionHijri: string): number {
  const completionGregorian = hijriToGregorian(hawlCompletionHijri);
  const today = momentHijri();
  const completionDate = momentHijri(completionGregorian, 'YYYY-MM-DD');
  const diff = completionDate.diff(today, 'days');
  return diff > 0 ? diff : 0;
}
