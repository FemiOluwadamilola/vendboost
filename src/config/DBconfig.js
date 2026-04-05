const mongoose = require("mongoose");
const log = require("../utils/logger");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });

async function dbConnection() {
  try {
    const mongoURI = process.env.MONGODB_URL;
    await mongoose.connect(mongoURI);
    log.info("MongoDB connected successfully!");
  } catch (error) {
    log.error("Error connecting to MongoDB:", error);
  }
}

module.exports = dbConnection;
