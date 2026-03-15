const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
  'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', 'Shaban',
  'Ramadan', 'Shawwal', 'Dhul Qadah', 'Dhul Hijjah',
];

export function formatHijriDate(hijriDate: string): string {
  const parts = hijriDate.split('/').map(Number);
  if (parts.length !== 3) return hijriDate;
  return `${parts[2]} ${HIJRI_MONTHS[parts[1] - 1]} ${parts[0]} AH`;
}
