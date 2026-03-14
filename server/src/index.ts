import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import assetRoutes from './routes/assets';
import zakatRoutes from './routes/zakat';
import { generateZakatRecords } from './services/zakatService';
import { calculateZakat } from './services/zakatService';
import { sendZakatReminder } from './services/emailService';
import { getSetting } from './models/zakatModel';
import { ensureDb } from './database';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));
app.use(express.json());

// Routes
app.use('/api/assets', assetRoutes);
app.use('/api/zakat', zakatRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Cron job: Check zakat daily at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  console.log('[Cron] Running daily zakat check...');
  const goldPriceEGP = parseFloat(getSetting('gold_price_per_gram_egp') || '3750');
  const usdToEgp = parseFloat(getSetting('usd_to_egp_rate') || '50');

  generateZakatRecords(goldPriceEGP, usdToEgp);
  const summary = calculateZakat(goldPriceEGP, usdToEgp);

  if (summary.isAboveNisab && summary.totalZakatDue > 0) {
    const emailTo = getSetting('email_to') || process.env.EMAIL_TO || '';
    if (emailTo) {
      await sendZakatReminder(
        {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
        emailTo,
        summary
      );
      console.log('[Cron] Zakat reminder email sent.');
    }
  }
});

// Start server after DB is ready
ensureDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
