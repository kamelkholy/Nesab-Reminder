import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nesab-reminder';

export async function connectDb(): Promise<void> {
  console.log(`Connecting to MongoDB (URI length: ${MONGODB_URI.length}, host: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')?.match(/[@]([^/]+)/)?.[1] || 'localhost'})`);
  await mongoose.connect(MONGODB_URI, {
    dbName: 'nesab-reminder',
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });
  console.log('Connected to MongoDB');
}

export async function closeDb(): Promise<void> {
  await mongoose.connection.close();
}
