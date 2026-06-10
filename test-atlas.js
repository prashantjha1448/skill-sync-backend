require('dotenv').config();
const mongoose = require('mongoose');

const testConnection = async () => {
  console.log('Connecting to MongoDB Atlas...');
  console.log('URI:', process.env.MONGO_URI);

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected successfully to Atlas cloud!');
    
    // Check list of collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:');
    collections.forEach(c => console.log(' -', c.name));
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ MongoDB Connection failed:', error);
  }
};

testConnection();
