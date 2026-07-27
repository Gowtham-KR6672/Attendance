import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || 'attendance_admin';
  if (!uri) throw new Error('MONGO_URI not set');

  try {
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 5000, // fail fast if mongod not running
    });
    console.log('✅ MongoDB connected:', mongoose.connection.host);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};
