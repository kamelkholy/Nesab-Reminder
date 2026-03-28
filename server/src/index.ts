import express from 'express';
import path from 'path';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import assetRoutes from './routes/assets';
import zakatRoutes from './routes/zakat';
import { authMiddleware } from './middleware/auth';
import { generateZakatRecords } from './services/zakatService';
import { calculateZakat } from './services/zakatService';
import { sendZakatReminder } from './services/emailService';
import { getSetting, setSetting, seedSettings } from './models/zakatModel';
import { getAllAssets, updateAsset } from './models/assetModel';
import { connectDb } from './database';

dotenv.config();

// Prevent any unhandled rejection from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));
app.use(express.json());

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/assets', authMiddleware, assetRoutes);
app.use('/api/zakat', authMiddleware, zakatRoutes);

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
        const fxData: any = await fxRes.json();
        const rate = fxData.rates?.EGP;
        if (rate && usdEgpMode === 'auto') {
          usdToEgp = Math.round(rate * 100) / 100;
          await setSetting('usd_to_egp_rate', usdToEgp.toString());
        }
        if (rate && goldPriceMode === 'auto') {
          const goldRes = await fetch('https://api.gold-api.com/price/XAU');
          if (goldRes.ok) {
            const goldData: any = await goldRes.json();
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
          const data: any = await res.json();
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

  const emailTo = (await getSetting('email_to')) || process.env.EMAIL_TO || '';
  if (!emailTo) return;

  const prevAboveNisab = (await getSetting('cron_prev_above_nisab')) === 'true';
  const prevHawlStart = (await getSetting('cron_prev_hawl_start')) || '';
  const lastEmailMonth = (await getSetting('cron_last_email_month')) || '';

  let shouldSendEmail = false;
  let reason = '';

  // 1. Send when wealth first reaches Nisab
  if (summary.isAboveNisab && !prevAboveNisab) {
    shouldSendEmail = true;
    reason = 'Wealth first reached Nisab';
  }

  // 2. Send when Hawl resets (new cycle started — hawl start date changed)
  const currentHawlStart = summary.hawlStartDate || '';
  if (currentHawlStart && prevHawlStart && currentHawlStart !== prevHawlStart) {
    shouldSendEmail = true;
    reason = 'Hawl cycle reset';
  }

  // 3. Send monthly when zakat is due (hawl complete & above nisab)
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  if (summary.isAboveNisab && summary.totalZakatDue > 0 && lastEmailMonth !== currentMonth) {
    shouldSendEmail = true;
    reason = 'Monthly Zakat reminder';
  }

  // Update tracked state
  await setSetting('cron_prev_above_nisab', summary.isAboveNisab.toString());
  await setSetting('cron_prev_hawl_start', currentHawlStart);

  if (shouldSendEmail) {
    await sendZakatReminder(
      process.env.ACS_CONNECTION_STRING || '',
      process.env.ACS_SENDER_ADDRESS || '',
      emailTo,
      summary
    );
    await setSetting('cron_last_email_month', currentMonth);
    console.log(`[Cron] Zakat reminder email sent. Reason: ${reason}`);
  } else {
    console.log('[Cron] No email needed today.');
  }
});

// Serve client build in production — check multiple possible locations
import fs from 'fs';
const candidates = [
  path.join(__dirname, '../../client/dist'),   // local dev (from server/dist/)
  path.join(__dirname, '../client/dist'),       // flat deploy
  path.join(__dirname, '../public'),            // alternative
];
const clientDist = candidates.find(p => fs.existsSync(p)) || candidates[0];
console.log(`Serving client from: ${clientDist}`);
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Start server immediately, then connect to DB
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    await connectDb();
    await seedSettings();
    console.log('Database ready');
  } catch (err) {
    console.error('Failed to connect to database:', err);
  }
});
