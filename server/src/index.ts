import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import assetRoutes from './routes/assets';
import zakatRoutes from './routes/zakat';
import { generateZakatRecords } from './services/zakatService';
import { calculateZakat } from './services/zakatService';
import { sendZakatReminder } from './services/emailService';
import { getSetting, setSetting, seedSettings } from './models/zakatModel';
import { getAllAssets, updateAsset } from './models/assetModel';
import { connectDb } from './database';

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

  const goldPriceMode = (await getSetting('gold_price_mode')) || 'manual';
  const usdEgpMode = (await getSetting('usd_egp_mode')) || 'manual';

  let goldPriceEGP = parseFloat((await getSetting('gold_price_per_gram_egp')) || '3750');
  let usdToEgp = parseFloat((await getSetting('usd_to_egp_rate')) || '50');

  if (goldPriceMode === 'auto' || usdEgpMode === 'auto') {
    try {
      const fxRes = await fetch('https://open.er-api.com/v6/latest/USD');
      if (fxRes.ok) {
        const fxData = await fxRes.json();
        const rate = fxData.rates?.EGP;
        if (rate && usdEgpMode === 'auto') {
          usdToEgp = Math.round(rate * 100) / 100;
          await setSetting('usd_to_egp_rate', usdToEgp.toString());
        }
        if (rate && goldPriceMode === 'auto') {
          const goldRes = await fetch('https://api.gold-api.com/price/XAU');
          if (goldRes.ok) {
            const goldData = await goldRes.json();
            if (goldData?.price) {
              goldPriceEGP = Math.round((goldData.price / 31.1035) * rate * 100) / 100;
              await setSetting('gold_price_per_gram_egp', goldPriceEGP.toString());
            }
          }
        }
      }
    } catch (err) {
      console.error('[Cron] Failed to fetch live rates, using stored values:', err);
    }
  }

  // Auto-fetch stock prices
  const stockPriceMode = (await getSetting('stock_price_mode')) || 'manual';
  if (stockPriceMode === 'auto') {
    try {
      const assets = await getAllAssets();
      const stocks = assets.filter(a => a.type === 'stock' && a.ticker);
      for (const stock of stocks) {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(stock.ticker!)}?range=1d&interval=1d`
        );
        if (res.ok) {
          const data = await res.json();
          const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (typeof price === 'number' && stock.id) {
            await updateAsset(stock.id, { amount: Math.round(price * 1000) / 1000 });
          }
        }
      }
    } catch (err) {
      console.error('[Cron] Failed to fetch stock prices:', err);
    }
  }

  await generateZakatRecords(goldPriceEGP, usdToEgp);
  const summary = await calculateZakat(goldPriceEGP, usdToEgp);

  if (summary.isAboveNisab && summary.totalZakatDue > 0) {
    const emailTo = (await getSetting('email_to')) || process.env.EMAIL_TO || '';
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
connectDb().then(async () => {
  await seedSettings();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
