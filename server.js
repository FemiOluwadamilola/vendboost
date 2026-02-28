// server.js
require("dotenv").config({ quiet: true });
const express = require("express");
const DBConnection = require('./src/config/DBconfig');
// const cron = require("node-cron");
// const mongoose = require("mongoose");
const authRoute = require("./src/routers/authRouter");
const vendorRoute = require("./src/routers/vendorRouter");
// const { runFollowUpScheduler } = require("./cron/followUpScheduler");

const app = express();
DBConnection();

app.use(express.json());

// Every 5 minutes
// cron.schedule("*/5 * * * *", () => {
//   console.log("Running follow-up scheduler...");
//   runFollowUpScheduler();
// });

// Routes placeholder
app.use("/auth", authRoute);
app.use("/vendor", vendorRoute);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
