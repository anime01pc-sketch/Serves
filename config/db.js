const mongoose = require('mongoose');

const connectDB = async () => {
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) {
        console.error('MONGO_URL not set');
        process.exit(1);
    }
    await mongoose.connect(mongoUrl);
    console.log('MongoDB connected');
};

module.exports = connectDB;