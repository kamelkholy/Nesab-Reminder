import { EmailClient } from '@azure/communication-email';
import { ZakatSummary } from '../types';
import { formatHijriDate, getCurrentHijriDate, daysUntilHawlCompletion } from '../utils/hijri';

export async function sendZakatReminder(
  connectionString: string,
  senderAddress: string,
  to: string,
  summary: ZakatSummary
): Promise<boolean> {
  try {
    const client = new EmailClient(connectionString);

    const zakatableAssets = summary.assets.filter(a => !a.excludedFromZakat);
    const excludedAssets = summary.assets.filter(a => a.excludedFromZakat);

    const makeAssetRows = (assets: typeof summary.assets) =>
      assets
        .map(
          a =>
            `<tr>
              <td style="padding:8px;border:1px solid #ddd">${a.asset.description}</td>
              <td style="padding:8px;border:1px solid #ddd">${a.asset.type}</td>
              <td style="padding:8px;border:1px solid #ddd">${(a.asset.type === 'stock' && a.asset.quantity ? (a.asset.quantity * a.asset.amount).toLocaleString() : a.asset.amount.toLocaleString())} ${a.asset.currency}</td>
              <td style="padding:8px;border:1px solid #ddd">${a.amountEGP.toLocaleString()} EGP</td>
            </tr>`
        )
        .join('');

    const daysRemaining = summary.hawlComplete
      ? 0
      : summary.hawlCompletionDateRaw
        ? daysUntilHawlCompletion(summary.hawlCompletionDateRaw)
        : null;

    const hawlStatusText = summary.hawlComplete
      ? '✅ Hawl is complete — Zakat is due now.'
      : daysRemaining !== null
        ? `⏳ ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining until Hawl completion (${summary.hawlCompletionDate}).`
        : 'Hawl has not started yet.';

    const tableHeader = `
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr style="background:#1a7a4c;color:white">
            <th style="padding:8px;border:1px solid #ddd">Description</th>
            <th style="padding:8px;border:1px solid #ddd">Type</th>
            <th style="padding:8px;border:1px solid #ddd">Value</th>
            <th style="padding:8px;border:1px solid #ddd">Value (EGP)</th>
          </tr>
        </thead>`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a7a4c">🕌 Zakat Payment Reminder</h2>
        <p>Assalamu Alaikum,</p>
        <p>This is a reminder that your Zakat is due. Based on your recorded assets, here is your Zakat summary:</p>

        <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0">
          <p><strong>Current Hijri Date:</strong> ${formatHijriDate(getCurrentHijriDate())}</p>
          <p><strong>Total Wealth:</strong> ${summary.totalWealthEGP.toLocaleString()} EGP</p>
          <p><strong>Nisab Threshold:</strong> ${summary.nisabThresholdEGP.toLocaleString()} EGP</p>
          <p><strong>Hawl Started:</strong> ${summary.hawlStartDate || 'N/A'}</p>
          <p><strong>Hawl Status:</strong> ${hawlStatusText}</p>
          <p><strong>Total Zakat Due:</strong> <span style="color:#1a7a4c;font-size:1.2em"><strong>${summary.totalZakatDue.toFixed(2)} EGP</strong></span></p>
        </div>

        <h3>Assets Due This Hawl (${zakatableAssets.length})</h3>
        ${zakatableAssets.length > 0 ? `
          ${tableHeader}
            <tbody>${makeAssetRows(zakatableAssets)}</tbody>
          </table>
        ` : '<p style="color:#666">No assets due this Hawl.</p>'}

        ${excludedAssets.length > 0 ? `
          <h3 style="margin-top:20px">Assets Excluded from This Hawl (${excludedAssets.length})</h3>
          <p style="color:#666;font-size:0.9em">These assets were acquired after the Hawl completion date and will be included in the next cycle.</p>
          ${tableHeader}
            <tbody>${makeAssetRows(excludedAssets)}</tbody>
          </table>
        ` : ''}

        <p style="margin-top:16px;color:#666;font-size:0.9em">
          Zakat is calculated at 2.5% of total wealth once it has exceeded the Nisab threshold
          (85 grams of gold equivalent) for one full Hijri year (hawl).
        </p>

        <p>May Allah accept your Zakat. Jazakallahu Khairan.</p>
      </div>
    `;

    const poller = await client.beginSend({
      senderAddress,
      content: {
        subject: `Zakat Reminder - ${summary.totalZakatDue.toFixed(2)} EGP Due`,
        html,
      },
      recipients: {
        to: [{ address: to }],
      },
    });

    const result = await poller.pollUntilDone();
    return result.status === 'Succeeded';
  } catch (error) {
    console.error('Failed to send email via Azure Communication Services:', error);
    return false;
  }
}
