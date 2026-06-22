import dns from 'node:dns';
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    if (process.env.MONGODB_DNS_SERVERS) {
      dns.setServers(
        process.env.MONGODB_DNS_SERVERS
          .split(',')
          .map((server) => server.trim())
          .filter(Boolean)
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;

