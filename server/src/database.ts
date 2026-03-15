import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nesab-reminder';

export async function connectDb(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}

export async function closeDb(): Promise<void> {
  await mongoose.connection.close();
}
