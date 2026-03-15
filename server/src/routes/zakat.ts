import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { calculateZakat, generateZakatRecords } from '../services/zakatService';
import { sendZakatReminder } from '../services/emailService';
import * as zakatModel from '../models/zakatModel';
import { getAssetById, updateAssetDates } from '../models/assetModel';
import { getCurrentHijriDate, hijriToGregorian } from '../utils/hijri';

const router = Router();

function getZakatParams() {
  const goldPriceEGP = parseFloat(zakatModel.getSetting('gold_price_per_gram_egp') || '3750');
  const usdToEgp = parseFloat(zakatModel.getSetting('usd_to_egp_rate') || '50');
  return { goldPriceEGP, usdToEgp };
}

// GET Zakat summary/calculation
router.get('/summary', (_req: Request, res: Response) => {
  const { goldPriceEGP, usdToEgp } = getZakatParams();
  const summary = calculateZakat(goldPriceEGP, usdToEgp);
  res.json(summary);
});

// GET all zakat records
router.get('/records', (_req: Request, res: Response) => {
  const records = zakatModel.getZakatRecords();
  res.json(records);
});

// POST generate zakat records for current year
router.post('/generate', (_req: Request, res: Response) => {
  const { goldPriceEGP, usdToEgp } = getZakatParams();
  generateZakatRecords(goldPriceEGP, usdToEgp);
  const records = zakatModel.getZakatRecords();
  res.json({ success: true, records });
});

// POST mark zakat as paid
router.post('/pay/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const record = zakatModel.getZakatRecordById(id);
  if (!record) {
    res.status(404).json({ error: 'Zakat record not found' });
    return;
  }
  zakatModel.markZakatPaid(id);

  // Advance the asset's hijri_date to current Hijri year (same month/day)
  // so hawl completion becomes current Hijri year + 1
  const asset = getAssetById(record.asset_id);
  if (asset) {
    const currentHijri = getCurrentHijriDate();
    const currentYear = parseInt(currentHijri.split('/')[0]);
    const parts = asset.hijri_date.split('/');
    const newHijriDate = `${currentYear}/${parts[1]}/${parts[2]}`;
    const newGregorianDate = hijriToGregorian(newHijriDate);
    updateAssetDates(asset.id!, newGregorianDate, newHijriDate);
  }

  res.json({ success: true });
});

// DELETE unpaid zakat records
router.delete('/records/unpaid', (_req: Request, res: Response) => {
  const deleted = zakatModel.deleteUnpaidRecords();
  res.json({ success: true, deleted });
});

// POST send email reminder
router.post('/remind', async (_req: Request, res: Response) => {
  const { goldPriceEGP, usdToEgp } = getZakatParams();
  const summary = calculateZakat(goldPriceEGP, usdToEgp);

  if (!summary.isAboveNisab || summary.totalZakatDue === 0) {
    res.json({ success: false, message: 'No Zakat due at this time' });
    return;
  }

  const emailTo = zakatModel.getSetting('email_to') || process.env.EMAIL_TO || '';
  if (!emailTo) {
    res.status(400).json({ error: 'Email recipient not configured' });
    return;
  }

  const sent = await sendZakatReminder(
    {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    emailTo,
    summary
  );

  res.json({ success: sent, message: sent ? 'Reminder sent' : 'Failed to send reminder' });
});

// GET settings
router.get('/settings', (_req: Request, res: Response) => {
  const emailTo = zakatModel.getSetting('email_to') || '';
  const goldPriceEgp = zakatModel.getSetting('gold_price_per_gram_egp') || '3750';
  const usdToEgpRate = zakatModel.getSetting('usd_to_egp_rate') || '50';
  res.json({ email_to: emailTo, gold_price_per_gram_egp: goldPriceEgp, usd_to_egp_rate: usdToEgpRate });
});

// PUT update settings
router.put(
  '/settings',
  [
    body('email_to').optional().isEmail().normalizeEmail(),
    body('gold_price_per_gram_egp').optional().isFloat({ min: 0 }),
    body('usd_to_egp_rate').optional().isFloat({ min: 0 }),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    if (req.body.email_to !== undefined) {
      zakatModel.setSetting('email_to', req.body.email_to);
    }
    if (req.body.gold_price_per_gram_egp !== undefined) {
      zakatModel.setSetting('gold_price_per_gram_egp', req.body.gold_price_per_gram_egp.toString());
    }
    if (req.body.usd_to_egp_rate !== undefined) {
      zakatModel.setSetting('usd_to_egp_rate', req.body.usd_to_egp_rate.toString());
    }

    res.json({ success: true });
  }
);

export default router;
