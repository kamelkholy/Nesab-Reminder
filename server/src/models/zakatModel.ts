import mongoose, { Schema } from 'mongoose';
import { ZakatRecord, ZakatPayment } from '../types';

interface IZakatRecord {
  hijri_year: string;
  amount_due: number;
  is_paid: boolean;
  reminder_sent: boolean;
  due_date_hijri: string;
  due_date_gregorian: string;
  created_at?: Date;
}

interface IZakatPayment {
  zakat_record_id: mongoose.Types.ObjectId;
  amount: number;
  date_hijri: string;
  date_gregorian: string;
  note?: string;
  created_at?: Date;
}

// --- Zakat Record Schema ---
const zakatRecordSchema = new Schema<IZakatRecord>(
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
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const ZakatRecordDoc = mongoose.model<IZakatRecord>('ZakatRecord', zakatRecordSchema);

// --- Zakat Payment Schema ---
const zakatPaymentSchema = new Schema<IZakatPayment>(
  {
    zakat_record_id: { type: Schema.Types.ObjectId, ref: 'ZakatRecord', required: true },
    amount: { type: Number, required: true },
    date_hijri: { type: String, required: true },
    date_gregorian: { type: String, required: true },
    note: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id.toString();
        ret.zakat_record_id = ret.zakat_record_id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const ZakatPaymentDoc = mongoose.model<IZakatPayment>('ZakatPayment', zakatPaymentSchema);

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
    { key: 'gold_price_mode', value: 'manual' },
    { key: 'usd_egp_mode', value: 'manual' },
    { key: 'stock_price_mode', value: 'manual' },
    { key: 'nisab_reached_date_hijri', value: '' },
    { key: 'cron_prev_above_nisab', value: 'false' },
    { key: 'cron_prev_hawl_start', value: '' },
    { key: 'cron_last_email_month', value: '' },
  ];
  for (const d of defaults) {
    const existing = await SettingDoc.findOne({ key: d.key });
    if (!existing) {
      await SettingDoc.create(d).catch(() => {});
    }
  }
}

// --- Zakat Record CRUD ---
async function getPaymentsForRecord(recordId: string): Promise<ZakatPayment[]> {
  const payments = await ZakatPaymentDoc.find({ zakat_record_id: recordId });
  return payments.map(p => p.toJSON() as unknown as ZakatPayment);
}

function enrichRecord(record: any, payments: ZakatPayment[]): ZakatRecord {
  const amount_paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return { ...record, amount_paid, payments };
}

export async function getZakatRecords(): Promise<ZakatRecord[]> {
  const records = await ZakatRecordDoc.find();
  const recordIds = records.map(r => r._id);
  const allPayments = await ZakatPaymentDoc.find({ zakat_record_id: { $in: recordIds } });
  const paymentsByRecord = new Map<string, ZakatPayment[]>();
  for (const p of allPayments) {
    const rid = p.zakat_record_id.toString();
    if (!paymentsByRecord.has(rid)) paymentsByRecord.set(rid, []);
    paymentsByRecord.get(rid)!.push(p.toJSON() as unknown as ZakatPayment);
  }
  return records.map(r => {
    const json = r.toJSON();
    const id = r._id.toString();
    return enrichRecord(json, paymentsByRecord.get(id) || []);
  });
}

export async function getZakatRecordByYear(hijriYear: string): Promise<ZakatRecord | undefined> {
  const doc = await ZakatRecordDoc.findOne({ hijri_year: hijriYear });
  if (!doc) return undefined;
  const json = doc.toJSON();
  const id = doc._id.toString();
  const payments = await getPaymentsForRecord(id);
  return enrichRecord(json, payments);
}

export async function createZakatRecord(record: Omit<ZakatRecord, 'id' | 'created_at' | 'amount_paid' | 'payments'>): Promise<ZakatRecord> {
  const doc = await ZakatRecordDoc.create(record);
  const json = doc.toJSON();
  return enrichRecord(json, []);
}

export async function getZakatRecordById(id: string): Promise<ZakatRecord | undefined> {
  const doc = await ZakatRecordDoc.findById(id);
  if (!doc) return undefined;
  const json = doc.toJSON();
  const docId = doc._id.toString();
  const payments = await getPaymentsForRecord(docId);
  return enrichRecord(json, payments);
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
  const unpaidRecords = await ZakatRecordDoc.find({ is_paid: false });
  for (const r of unpaidRecords) {
    await ZakatPaymentDoc.deleteMany({ zakat_record_id: r._id });
  }
  const result = await ZakatRecordDoc.deleteMany({ is_paid: false });
  return result.deletedCount;
}

export async function deleteZakatRecord(id: string): Promise<boolean> {
  await ZakatPaymentDoc.deleteMany({ zakat_record_id: id });
  const result = await ZakatRecordDoc.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

// --- Zakat Payment CRUD ---
export async function addZakatPayment(
  payment: Omit<ZakatPayment, 'id' | 'created_at'>
): Promise<ZakatPayment> {
  const doc = await ZakatPaymentDoc.create(payment);
  // Recompute is_paid status
  const record = await ZakatRecordDoc.findById(payment.zakat_record_id);
  if (record) {
    const payments = await ZakatPaymentDoc.find({ zakat_record_id: payment.zakat_record_id });
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    await ZakatRecordDoc.updateOne(
      { _id: payment.zakat_record_id },
      { is_paid: totalPaid >= record.amount_due }
    );
  }
  return doc.toJSON() as unknown as ZakatPayment;
}

export async function deleteZakatPayment(paymentId: string): Promise<boolean> {
  const payment = await ZakatPaymentDoc.findById(paymentId);
  if (!payment) return false;
  const recordId = payment.zakat_record_id;
  await ZakatPaymentDoc.deleteOne({ _id: paymentId });
  // Recompute is_paid status
  const record = await ZakatRecordDoc.findById(recordId);
  if (record) {
    const remaining = await ZakatPaymentDoc.find({ zakat_record_id: recordId });
    const totalPaid = remaining.reduce((sum, p) => sum + p.amount, 0);
    await ZakatRecordDoc.updateOne(
      { _id: recordId },
      { is_paid: totalPaid >= record.amount_due }
    );
  }
  return true;
}

export async function getPaymentsByRecordId(recordId: string): Promise<ZakatPayment[]> {
  return getPaymentsForRecord(recordId);
}

// --- Settings CRUD ---
export async function getSetting(key: string): Promise<string | undefined> {
  const doc = await SettingDoc.findOne({ key });
  return doc?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await SettingDoc.updateOne({ key }, { value }, { upsert: true });
}
