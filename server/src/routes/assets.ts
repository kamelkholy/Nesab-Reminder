import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import * as assetModel from '../models/assetModel';

const router = Router();

// GET all assets
router.get('/', async (_req: Request, res: Response) => {
  const assets = await assetModel.getAllAssets();
  res.json(assets);
});

// GET single asset
router.get('/:id', param('id').isMongoId(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  const asset = await assetModel.getAssetById(req.params.id);
  if (!asset) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }
  res.json(asset);
});

// POST create asset
router.post(
  '/',
  [
    body('type').isIn(['cash', 'investment', 'stock']),
    body('description').isString().trim().notEmpty().escape(),
    body('amount').isFloat({ min: 0 }),
    body('currency').isIn(['USD', 'EGP']),
    body('quantity').optional().isFloat({ min: 0 }),
    body('ticker').optional().isString().trim().escape(),
    body('acquisition_date').isISO8601(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const asset = await assetModel.createAsset({
      type: req.body.type,
      description: req.body.description,
      amount: req.body.amount,
      currency: req.body.currency,
      quantity: req.body.quantity,
      ticker: req.body.ticker,
      acquisition_date: req.body.acquisition_date,
    });

    if (!asset) {
      res.status(500).json({ error: 'Failed to create asset' });
      return;
    }
    res.status(201).json(asset);
  }
);

// PUT update asset
router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('type').optional().isIn(['cash', 'investment', 'stock']),
    body('description').optional().isString().trim().notEmpty().escape(),
    body('amount').optional().isFloat({ min: 0 }),
    body('currency').optional().isIn(['USD', 'EGP']),
    body('quantity').optional().isFloat({ min: 0 }),
    body('ticker').optional().isString().trim().escape(),
    body('acquisition_date').optional().isISO8601(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const asset = await assetModel.updateAsset(req.params.id, req.body);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    res.json(asset);
  }
);

// DELETE asset
router.delete('/:id', param('id').isMongoId(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const deleted = await assetModel.deleteAsset(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
