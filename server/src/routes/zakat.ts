import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { calculateZakat, generateZakatRecords } from '../services/zakatService';
import { sendZakatReminder } from '../services/emailService';
import * as zakatModel from '../models/zakatModel';
import { getCurrentHijriDate } from '../utils/hijri';

const router = Router();

async function getZakatParams() {
  const goldPriceEGP = parseFloat((await zakatModel.getSetting('gold_price_per_gram_egp')) || '3750');
  const usdToEgp = parseFloat((await zakatModel.getSetting('usd_to_egp_rate')) || '50');
  return { goldPriceEGP, usdToEgp };
}

// GET Zakat summary/calculation
router.get('/summary', async (_req: Request, res: Response) => {
  const { goldPriceEGP, usdToEgp } = await getZakatParams();
  const summary = await calculateZakat(goldPriceEGP, usdToEgp);
  res.json(summary);
});

// GET all zakat records
router.get('/records', async (_req: Request, res: Response) => {
  const records = await zakatModel.getZakatRecords();
  res.json(records);
});

// POST generate zakat records for current year
router.post('/generate', async (_req: Request, res: Response) => {
  const { goldPriceEGP, usdToEgp } = await getZakatParams();
  await generateZakatRecords(goldPriceEGP, usdToEgp);
  const records = await zakatModel.getZakatRecords();
  res.json({ success: true, records });
});

// POST mark zakat as paid
router.post('/pay/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const record = await zakatModel.getZakatRecordById(id);
  if (!record) {
    res.status(404).json({ error: 'Zakat record not found' });
    return;
  }
  await zakatModel.markZakatPaid(id);

  // Reset hawl: set nisab_reached_date to current date so a new cycle starts
  await zakatModel.setSetting('nisab_reached_date_hijri', getCurrentHijriDate());

  res.json({ success: true });
});

// DELETE unpaid zakat records
router.delete('/records/unpaid', async (_req: Request, res: Response) => {
  const deleted = await zakatModel.deleteUnpaidRecords();
  res.json({ success: true, deleted });
});

// DELETE a specific zakat record
router.delete('/records/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const record = await zakatModel.getZakatRecordById(id);
  if (!record) {
    res.status(404).json({ error: 'Zakat record not found' });
    return;
  }
  await zakatModel.deleteZakatRecord(id);
  res.json({ success: true });
});

// POST send email reminder
router.post('/remind', async (_req: Request, res: Response) => {
  const { goldPriceEGP, usdToEgp } = await getZakatParams();
  const summary = await calculateZakat(goldPriceEGP, usdToEgp);

  if (!summary.isAboveNisab || summary.totalZakatDue === 0) {
    res.json({ success: false, message: 'No Zakat due at this time' });
    return;
  }

  const emailTo = (await zakatModel.getSetting('email_to')) || process.env.EMAIL_TO || '';
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
router.get('/settings', async (_req: Request, res: Response) => {
  const emailTo = (await zakatModel.getSetting('email_to')) || '';
  const goldPriceEgp = (await zakatModel.getSetting('gold_price_per_gram_egp')) || '3750';
  const usdToEgpRate = (await zakatModel.getSetting('usd_to_egp_rate')) || '50';
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
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    if (req.body.email_to !== undefined) {
      await zakatModel.setSetting('email_to', req.body.email_to);
    }
    if (req.body.gold_price_per_gram_egp !== undefined) {
      await zakatModel.setSetting('gold_price_per_gram_egp', req.body.gold_price_per_gram_egp.toString());
    }
    if (req.body.usd_to_egp_rate !== undefined) {
      await zakatModel.setSetting('usd_to_egp_rate', req.body.usd_to_egp_rate.toString());
    }

    res.json({ success: true });
  }
);

export default router;
