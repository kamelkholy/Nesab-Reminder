import mongoose, { Schema } from 'mongoose';
import { ZakatRecord } from '../types';

// --- Zakat Record Schema ---
const zakatRecordSchema = new Schema(
  {
    hijri_year: { type: String, required: true },
    amount_due: { type: Number, required: true },
    is_paid: { type: Boolean, default: false },
    reminder_sent: { type: Boolean, default: false },
    due_date_hijri: { type: String, required: true },
    due_date_gregorian: { type: String, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
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

export const ZakatRecordDoc = mongoose.model('ZakatRecord', zakatRecordSchema);

// --- Settings Schema ---
const settingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
});

const SettingDoc = mongoose.model('Setting', settingSchema);

// --- Seed default settings ---
export async function seedSettings(): Promise<void> {
  const defaults = [
    { key: 'email_to', value: '' },
    { key: 'gold_price_per_gram_egp', value: '3750' },
    { key: 'usd_to_egp_rate', value: '50' },
    { key: 'nisab_reached_date_hijri', value: '' },
  ];
  for (const d of defaults) {
    await SettingDoc.updateOne({ key: d.key }, { $setOnInsert: d }, { upsert: true });
  }
}

// --- Zakat Record CRUD ---
export async function getZakatRecords(): Promise<ZakatRecord[]> {
  const records = await ZakatRecordDoc.find().sort({ created_at: -1 });
  return records.map(r => r.toJSON() as ZakatRecord);
}

export async function getZakatRecordByYear(hijriYear: string): Promise<ZakatRecord | undefined> {
  const doc = await ZakatRecordDoc.findOne({ hijri_year: hijriYear });
  return doc ? (doc.toJSON() as ZakatRecord) : undefined;
}

export async function createZakatRecord(record: Omit<ZakatRecord, 'id' | 'created_at'>): Promise<ZakatRecord> {
  const doc = await ZakatRecordDoc.create(record);
  return doc.toJSON() as ZakatRecord;
}

export async function getZakatRecordById(id: string): Promise<ZakatRecord | undefined> {
  const doc = await ZakatRecordDoc.findById(id);
  return doc ? (doc.toJSON() as ZakatRecord) : undefined;
}

export async function markZakatPaid(id: string): Promise<boolean> {
  const result = await ZakatRecordDoc.updateOne({ _id: id }, { is_paid: true });
  return result.modifiedCount > 0;
}

export async function markReminderSent(id: string): Promise<boolean> {
  const result = await ZakatRecordDoc.updateOne({ _id: id }, { reminder_sent: true });
  return result.modifiedCount > 0;
}

export async function deleteUnpaidRecords(): Promise<number> {
  const result = await ZakatRecordDoc.deleteMany({ is_paid: false });
  return result.deletedCount;
}

// --- Settings CRUD ---
export async function getSetting(key: string): Promise<string | undefined> {
  const doc = await SettingDoc.findOne({ key });
  return doc?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await SettingDoc.updateOne({ key }, { value }, { upsert: true });
}
