import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { calculateZakat, generateZakatRecords } from '../services/zakatService';
import { sendZakatReminder } from '../services/emailService';
import * as zakatModel from '../models/zakatModel';
import { getAllAssets, updateAsset } from '../models/assetModel';
import { getCurrentHijriDate } from '../utils/hijri';

const router = Router();

async function fetchGoldPriceFromApi(): Promise<number | null> {
  try {
    const goldRes = await fetch('https://api.gold-api.com/price/XAU');
    if (!goldRes.ok) return null;
    const goldData: any = await goldRes.json();
    const goldPerOzUSD = goldData?.price;
    if (!goldPerOzUSD) return null;

    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!fxRes.ok) return null;
    const fxData: any = await fxRes.json();
    const usdToEgp = fxData.rates?.EGP;
    if (!usdToEgp) return null;

    return Math.round((goldPerOzUSD / 31.1035) * usdToEgp * 100) / 100;
  } catch {
    return null;
  }
}

async function fetchExchangeRateFromApi(): Promise<number | null> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) return null;
    const data: any = await response.json();
    const rate = data.rates?.EGP;
    return rate ? Math.round(rate * 100) / 100 : null;
  } catch {
    return null;
  }
}

async function fetchStockPriceFromApi(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? Math.round(price * 1000) / 1000 : null;
  } catch {
    return null;
  }
}

async function updateStockPricesIfAuto(): Promise<void> {
  const mode = (await zakatModel.getSetting('stock_price_mode')) || 'manual';
  if (mode !== 'auto') return;

  const assets = await getAllAssets();
  const stocks = assets.filter(a => a.type === 'stock' && a.ticker);

  for (const stock of stocks) {
    const price = await fetchStockPriceFromApi(stock.ticker!);
    if (price !== null && stock.id) {
      await updateAsset(stock.id, { amount: price });
    }
  }
}

async function getZakatParams() {
  const goldPriceMode = (await zakatModel.getSetting('gold_price_mode')) || 'manual';
  const usdEgpMode = (await zakatModel.getSetting('usd_egp_mode')) || 'manual';

  let goldPriceEGP = parseFloat((await zakatModel.getSetting('gold_price_per_gram_egp')) || '3750');
  let usdToEgp = parseFloat((await zakatModel.getSetting('usd_to_egp_rate')) || '50');

  if (goldPriceMode === 'auto') {
    const fetched = await fetchGoldPriceFromApi();
    if (fetched !== null) {
      goldPriceEGP = fetched;
      await zakatModel.setSetting('gold_price_per_gram_egp', fetched.toString());
    }
  }

  if (usdEgpMode === 'auto') {
    const fetched = await fetchExchangeRateFromApi();
    if (fetched !== null) {
      usdToEgp = fetched;
      await zakatModel.setSetting('usd_to_egp_rate', fetched.toString());
    }
  }

  return { goldPriceEGP, usdToEgp };
}

// GET Zakat summary/calculation
router.get('/summary', async (_req: Request, res: Response) => {
  await updateStockPricesIfAuto();
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
  await updateStockPricesIfAuto();
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

  const connectionString = process.env.ACS_CONNECTION_STRING || '';
  const senderAddress = process.env.ACS_SENDER_ADDRESS || '';
  if (!connectionString || !senderAddress) {
    res.status(400).json({ error: 'Azure Communication Services not configured' });
    return;
  }

  const sent = await sendZakatReminder(
    connectionString,
    senderAddress,
    emailTo,
    summary
  );

  res.json({ success: sent, message: sent ? 'Reminder sent' : 'Failed to send reminder' });
});

// GET fetch stock price by ticker
router.get(
  '/fetch-stock-price/:ticker',
  param('ticker').isString().trim().notEmpty(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const price = await fetchStockPriceFromApi(req.params.ticker);
    if (price === null) {
      res.status(502).json({ error: `Failed to fetch price for ${req.params.ticker}. Please enter manually.` });
      return;
    }
    res.json({ ticker: req.params.ticker, price });
  }
);

// POST refresh all stock prices from API
router.post('/refresh-stock-prices', async (_req: Request, res: Response) => {
  const assets = await getAllAssets();
  const stocks = assets.filter(a => a.type === 'stock' && a.ticker);
  const results: { ticker: string; price: number | null; updated: boolean }[] = [];

  for (const stock of stocks) {
    const price = await fetchStockPriceFromApi(stock.ticker!);
    const updated = price !== null && stock.id ? !!(await updateAsset(stock.id, { amount: price })) : false;
    results.push({ ticker: stock.ticker!, price, updated });
  }

  res.json({ success: true, results });
});

// GET fetch latest USD to EGP exchange rate from API
router.get('/fetch-exchange-rate', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('API request failed');
    const data: any = await response.json();
    const rate = data.rates?.EGP;
    if (!rate) throw new Error('EGP rate not found in response');
    res.json({ rate: Math.round(rate * 100) / 100 });
  } catch {
    res.status(502).json({ error: 'Failed to fetch exchange rate. Please enter manually.' });
  }
});

// GET fetch latest gold price per gram in EGP from API
router.get('/fetch-gold-price', async (_req: Request, res: Response) => {
  try {
    // Fetch gold spot price in USD per troy ounce from gold-api.com
    const goldRes = await fetch('https://api.gold-api.com/price/XAU');
    if (!goldRes.ok) throw new Error('Gold API request failed');
    const goldData: any = await goldRes.json();
    const goldPerOzUSD = goldData?.price;
    if (!goldPerOzUSD) throw new Error('Gold price not found in response');

    // Fetch USD to EGP rate
    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!fxRes.ok) throw new Error('Exchange rate API failed');
    const fxData: any = await fxRes.json();
    const usdToEgp = fxData.rates?.EGP;
    if (!usdToEgp) throw new Error('EGP rate not found');

    // 1 troy ounce = 31.1035 grams
    const goldPerGramEGP = (goldPerOzUSD / 31.1035) * usdToEgp;
    res.json({
      price_per_gram_egp: Math.round(goldPerGramEGP * 100) / 100,
      gold_per_oz_usd: goldPerOzUSD,
      usd_to_egp: Math.round(usdToEgp * 100) / 100,
    });
  } catch {
    res.status(502).json({ error: 'Failed to fetch gold price. Please enter manually.' });
  }
});

// GET settings
router.get('/settings', async (_req: Request, res: Response) => {
  const emailTo = (await zakatModel.getSetting('email_to')) || '';
  const goldPriceEgp = (await zakatModel.getSetting('gold_price_per_gram_egp')) || '3750';
  const usdToEgpRate = (await zakatModel.getSetting('usd_to_egp_rate')) || '50';
  const goldPriceMode = (await zakatModel.getSetting('gold_price_mode')) || 'manual';
  const usdEgpMode = (await zakatModel.getSetting('usd_egp_mode')) || 'manual';
  const stockPriceMode = (await zakatModel.getSetting('stock_price_mode')) || 'manual';
  res.json({
    email_to: emailTo,
    gold_price_per_gram_egp: goldPriceEgp,
    usd_to_egp_rate: usdToEgpRate,
    gold_price_mode: goldPriceMode,
    usd_egp_mode: usdEgpMode,
    stock_price_mode: stockPriceMode,
  });
});

// PUT update settings
router.put(
  '/settings',
  [
    body('email_to').optional().isEmail().normalizeEmail(),
    body('gold_price_per_gram_egp').optional().isFloat({ min: 0 }),
    body('usd_to_egp_rate').optional().isFloat({ min: 0 }),
    body('gold_price_mode').optional().isIn(['manual', 'auto']),
    body('usd_egp_mode').optional().isIn(['manual', 'auto']),
    body('stock_price_mode').optional().isIn(['manual', 'auto']),
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
    if (req.body.gold_price_mode !== undefined) {
      await zakatModel.setSetting('gold_price_mode', req.body.gold_price_mode);
    }
    if (req.body.usd_egp_mode !== undefined) {
      await zakatModel.setSetting('usd_egp_mode', req.body.usd_egp_mode);
    }
    if (req.body.stock_price_mode !== undefined) {
      await zakatModel.setSetting('stock_price_mode', req.body.stock_price_mode);
    }

    res.json({ success: true });
  }
);

export default router;
