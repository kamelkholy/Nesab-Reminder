import mongoose, { Schema } from 'mongoose';
import { Asset } from '../types';
import { gregorianToHijri } from '../utils/hijri';

const assetSchema = new Schema(
  {
    type: { type: String, required: true, enum: ['cash', 'investment', 'stock'] },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, enum: ['USD', 'EGP'], default: 'EGP' },
    quantity: { type: Number, default: null },
    ticker: { type: String, default: null },
    acquisition_date: { type: String, required: true },
    hijri_date: { type: String, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const AssetDoc = mongoose.model('Asset', assetSchema);

export async function getAllAssets(): Promise<Asset[]> {
  const assets = await AssetDoc.find().sort({ created_at: -1 });
  return assets.map(a => a.toJSON() as Asset);
}

export async function getAssetById(id: string): Promise<Asset | undefined> {
  const asset = await AssetDoc.findById(id);
  return asset ? (asset.toJSON() as Asset) : undefined;
}

export async function createAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'hijri_date'>): Promise<Asset> {
  const hijriDate = gregorianToHijri(asset.acquisition_date);
  const doc = await AssetDoc.create({ ...asset, hijri_date: hijriDate });
  return doc.toJSON() as Asset;
}

export async function updateAsset(id: string, asset: Partial<Omit<Asset, 'id' | 'created_at'>>): Promise<Asset | undefined> {
  const updateData: any = { ...asset };
  if (asset.acquisition_date) {
    updateData.hijri_date = gregorianToHijri(asset.acquisition_date);
  }
  const doc = await AssetDoc.findByIdAndUpdate(id, updateData, { new: true });
  return doc ? (doc.toJSON() as Asset) : undefined;
}

export async function updateAssetDates(id: string, acquisitionDate: string, hijriDate: string): Promise<void> {
  await AssetDoc.findByIdAndUpdate(id, { acquisition_date: acquisitionDate, hijri_date: hijriDate });
}

export async function deleteAsset(id: string): Promise<boolean> {
  const result = await AssetDoc.findByIdAndDelete(id);
  return !!result;
}
