import nodemailer from 'nodemailer';
import { ZakatSummary } from '../types';
import { formatHijriDate, getCurrentHijriDate } from '../utils/hijri';

interface EmailOptions {
  host: string;
  port: number;
  user: string;
  pass: string;
}

function createTransporter(options: EmailOptions) {
  return nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.port === 465,
    auth: {
      user: options.user,
      pass: options.pass,
    },
  });
}

export async function sendZakatReminder(
  emailOptions: EmailOptions,
  to: string,
  summary: ZakatSummary
): Promise<boolean> {
  try {
    const transporter = createTransporter(emailOptions);

    const assetList = summary.assets
      .map(
        a =>
          `<tr>
            <td style="padding:8px;border:1px solid #ddd">${a.asset.description}</td>
            <td style="padding:8px;border:1px solid #ddd">${a.asset.type}</td>
            <td style="padding:8px;border:1px solid #ddd">${a.asset.amount.toLocaleString()} ${a.asset.currency}</td>
            <td style="padding:8px;border:1px solid #ddd">${a.amountEGP.toLocaleString()} EGP</td>
          </tr>`
      )
      .join('');

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
          <p><strong>Total Zakat Due:</strong> <span style="color:#1a7a4c;font-size:1.2em"><strong>${summary.totalZakatDue.toFixed(2)} EGP</strong></span></p>
        </div>

        <h3>Your Assets:</h3>
        <table style="border-collapse:collapse;width:100%">
          <thead>
            <tr style="background:#1a7a4c;color:white">
              <th style="padding:8px;border:1px solid #ddd">Description</th>
              <th style="padding:8px;border:1px solid #ddd">Type</th>
              <th style="padding:8px;border:1px solid #ddd">Value</th>
              <th style="padding:8px;border:1px solid #ddd">Value (EGP)</th>
            </tr>
          </thead>
          <tbody>
            ${assetList}
          </tbody>
        </table>

        <p style="margin-top:16px;color:#666;font-size:0.9em">
          Zakat is calculated at 2.5% of total wealth once it has exceeded the Nisab threshold
          (85 grams of gold equivalent) for one full Hijri year (hawl).
        </p>

        <p>May Allah accept your Zakat. Jazakallahu Khairan.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Nesab Reminder" <${emailOptions.user}>`,
      to,
      subject: `Zakat Reminder - ${summary.totalZakatDue.toFixed(2)} EGP Due`,
      html,
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}
